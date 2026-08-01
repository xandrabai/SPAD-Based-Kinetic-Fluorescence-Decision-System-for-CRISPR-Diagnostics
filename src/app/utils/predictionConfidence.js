/**
 * Prediction Confidence Gate
 *
 * Wraps the existing regression model (concentrationPredictor.js, untouched)
 * with a one-sided one-sample t-test: is the mean of the concentration
 * predictions collected so far statistically significantly greater than
 * QPCR_THRESHOLD_CONCENTRATION? If so, the lower confidence bound of that
 * mean is used as the gate for updating the UI.
 *
 * All thresholds live in config.js — see that file to retune behavior.
 */
import {
  QPCR_THRESHOLD_CONCENTRATION,
  P_VALUE_THRESHOLD,
  CONFIDENCE_LEVEL,
  MIN_SAMPLES_FOR_DECISION,
} from './config';

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sampleStdDev(values, avg) {
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// log(Gamma(x)) — Lanczos approximation.
function logGamma(x) {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued fraction for the regularized incomplete beta function (Numerical Recipes betacf).
function betacf(x, a, b) {
  const MAXIT = 200;
  const EPS = 3e-9;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a;
  }
  return 1 - (bt * betacf(1 - x, b, a)) / b;
}

// Two-tailed-safe Student's t CDF: P(T <= t) for `df` degrees of freedom.
function studentTCDF(t, df) {
  const x = df / (df + t * t);
  const ib = regularizedIncompleteBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

// Quantile function (inverse CDF) found by bisection, since studentTCDF is monotonic.
function studentTQuantile(p, df) {
  let lo = -100;
  let hi = 100;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCDF(mid, df) < p) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Evaluate whether a set of regression-predicted concentrations is
 * statistically significantly above QPCR_THRESHOLD_CONCENTRATION.
 *
 * @param {number[]} predictionSamples - concentrations from processFrame(), one per sample
 * @returns {{
 *   isSignificant: boolean,
 *   mean: number,
 *   lowerBound: number,
 *   pValue: number,
 *   n: number,
 * } | { isSignificant: false }}
 */
export function evaluateConfidence(predictionSamples) {
  const n = predictionSamples.length;
  if (n < MIN_SAMPLES_FOR_DECISION) {
    return { isSignificant: false, n };
  }

  const avg = mean(predictionSamples);
  const sd = sampleStdDev(predictionSamples, avg);
  const df = n - 1;

  if (sd === 0) {
    // No variance across samples: fall back to a direct comparison.
    const isSignificant = avg > QPCR_THRESHOLD_CONCENTRATION;
    return { isSignificant, mean: avg, lowerBound: avg, pValue: isSignificant ? 0 : 1, n };
  }

  const se = sd / Math.sqrt(n);
  const t = (avg - QPCR_THRESHOLD_CONCENTRATION) / se;
  const pValue = 1 - studentTCDF(t, df);
  const isStatisticallySignificant = pValue < P_VALUE_THRESHOLD;

  const tCrit = studentTQuantile(CONFIDENCE_LEVEL, df);
  const lowerBound = avg - tCrit * se;

  return {
    isSignificant: isStatisticallySignificant && lowerBound > QPCR_THRESHOLD_CONCENTRATION,
    mean: avg,
    lowerBound,
    pValue,
    n,
  };
}
