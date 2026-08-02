import {
  DETECTION_THRESHOLD_UG_ML,
  MIN_BLOCKS_FOR_DECISION,
  RUN_ALPHA,
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

export function alphaForLook(lookNumber) {
  if (!Number.isInteger(lookNumber) || lookNumber < 1) return 0;
  return RUN_ALPHA / (lookNumber * (lookNumber + 1));
}

export function evaluateSequentialConfidence(blockMeans, lookNumber) {
  const n = blockMeans.length;
  if (n < MIN_BLOCKS_FOR_DECISION) {
    return { status: 'insufficient', n, lookNumber };
  }
  if (!blockMeans.every(Number.isFinite)) {
    return { status: 'invalid', n, lookNumber };
  }

  const avg = mean(blockMeans);
  const sd = sampleStdDev(blockMeans, avg);
  if (!Number.isFinite(sd) || sd === 0) {
    return { status: 'zero_variance', n, lookNumber, mean: avg };
  }

  const df = n - 1;
  const standardError = sd / Math.sqrt(n);
  const tStatistic = (avg - DETECTION_THRESHOLD_UG_ML) / standardError;
  const pValue = 1 - studentTCDF(tStatistic, df);
  const alphaAtLook = alphaForLook(lookNumber);
  const criticalT = studentTQuantile(1 - alphaAtLook, df);
  const lowerBound = avg - criticalT * standardError;

  return {
    status: 'valid',
    n,
    lookNumber,
    mean: avg,
    standardDeviation: sd,
    standardError,
    pValue,
    alphaAtLook,
    lowerBound,
    isPositive: pValue < alphaAtLook && lowerBound > DETECTION_THRESHOLD_UG_ML,
  };
}
