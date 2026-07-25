/**
 * Concentration Prediction Utility
 * 
 * Ported from predict_concentration.py
 * Uses calibration model to predict concentration from raw SPAD histogram frames
 */

// Load calibration parameters from model_equations.json
const CALIBRATION = {
  signal_processing: {
    window_start: 1924,
    window_end: 1964,
    background_start: 2600,
    n_bins: 3840
  },
  model: {
    // Using linear regression model
    slope: 2.3528371055785264,
    intercept: 139.0762490173631,
    equation: "y = 2.35284x + 139.076"
  },
  valid_range: {
    min: 10.0,
    max: 90.0
  }
};

/**
 * Calculate background-corrected window sum from a histogram frame
 * @param {Float64Array|Array} bins - Array of histogram bin counts (length 3840)
 * @returns {number} Background-corrected integrated signal
 */
export function calculateIntegratedSignal(bins) {
  const { window_start, window_end, background_start, n_bins } = CALIBRATION.signal_processing;
  
  // Validate bin array
  if (!bins || bins.length !== n_bins) {
    console.warn(`Expected ${n_bins} bins, got ${bins?.length || 0}`);
    return 0;
  }

  // Calculate window sum (bins 1924 to 1964, inclusive)
  let windowSum = 0;
  for (let i = window_start; i <= window_end; i++) {
    windowSum += bins[i] || 0;
  }

  // Calculate background baseline (average from bin 2600 onwards)
  let backgroundSum = 0;
  let backgroundCount = 0;
  for (let i = background_start; i < n_bins; i++) {
    backgroundSum += bins[i] || 0;
    backgroundCount++;
  }
  
  const backgroundMean = backgroundCount > 0 ? backgroundSum / backgroundCount : 0;
  
  // Number of bins in the window
  const windowBinCount = window_end - window_start + 1;
  
  // Background-corrected signal: window sum minus (background per bin * number of bins)
  const correctedSignal = windowSum - (backgroundMean * windowBinCount);
  
  return correctedSignal;
}

/**
 * Predict concentration from integrated signal using linear model
 * @param {number} signal - Background-corrected integrated counts
 * @returns {number|null} Predicted concentration in µg/ml, or null if out of range
 */
export function predictConcentration(signal) {
  const { slope, intercept } = CALIBRATION.model;
  
  // Invert the linear equation: y = slope * x + intercept
  // Solving for x: x = (y - intercept) / slope
  // where y is the signal and x is the concentration
  const concentration = (signal - intercept) / slope;
  
  return concentration;
}

/**
 * Complete frame-to-concentration pipeline
 * @param {Float64Array|Array} bins - Raw histogram bins from a single frame
 * @returns {Object} { concentration, signal, status }
 */
export function processFrame(bins) {
  const signal = calculateIntegratedSignal(bins);
  const concentration = predictConcentration(signal);
  
  // Determine status based on valid calibration range
  let status = 'valid';
  if (concentration < CALIBRATION.valid_range.min) {
    status = 'below_range';
  } else if (concentration > CALIBRATION.valid_range.max) {
    status = 'above_range';
  }
  
  return {
    // Keep the direct inverse-model result so this is exactly
    // x = (signal - 139.076249) / 2.352837.
    concentration,
    signal,
    status,
    timestamp: Date.now()
  };
}

/**
 * Get calibration info for display
 */
export function getCalibrationInfo() {
  return {
    equation: CALIBRATION.model.equation,
    validRange: CALIBRATION.valid_range,
    windowRange: [CALIBRATION.signal_processing.window_start, CALIBRATION.signal_processing.window_end],
    backgroundStart: CALIBRATION.signal_processing.background_start
  };
}
