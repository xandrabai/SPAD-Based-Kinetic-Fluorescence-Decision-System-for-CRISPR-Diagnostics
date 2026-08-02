import calibrationBundle from '../../../model_equations.json';

const [minConcentration, maxConcentration] =
  calibrationBundle.valid_concentration_range_ug_ml;
const linearModel = calibrationBundle.models.linear;
const processing = calibrationBundle.signal_processing;

export function calculateIntegratedSignal(bins) {
  if (!bins || bins.length !== processing.n_bins) return null;

  for (const value of bins) {
    if (!Number.isFinite(value)) return null;
  }

  let windowSum = 0;
  for (let index = processing.window_start; index <= processing.window_end; index += 1) {
    windowSum += bins[index];
  }

  let backgroundSum = 0;
  for (let index = processing.background_start; index < processing.n_bins; index += 1) {
    backgroundSum += bins[index];
  }

  const backgroundCount = processing.n_bins - processing.background_start;
  const backgroundMean = backgroundSum / backgroundCount;
  const windowBinCount = processing.window_end - processing.window_start + 1;
  const signal = windowSum - backgroundMean * windowBinCount;

  return Number.isFinite(signal) ? signal : null;
}

export function predictConcentration(signal) {
  if (!Number.isFinite(signal) || !Number.isFinite(linearModel.slope) || linearModel.slope === 0) {
    return null;
  }

  const concentration = (signal - linearModel.intercept) / linearModel.slope;
  return Number.isFinite(concentration) ? concentration : null;
}

export function processFrame(bins) {
  const signal = calculateIntegratedSignal(bins);
  const concentration = predictConcentration(signal);

  if (signal === null || concentration === null) {
    return { concentration: null, signal: null, status: 'invalid' };
  }

  let status = 'valid';
  if (concentration < minConcentration) status = 'below_range';
  if (concentration > maxConcentration) status = 'above_range';

  return { concentration, signal, status };
}

export function getCalibrationInfo() {
  return {
    unit: calibrationBundle.concentration_unit,
    model: linearModel,
    validRange: { min: minConcentration, max: maxConcentration },
    windowRange: [processing.window_start, processing.window_end],
    backgroundStart: processing.background_start,
    nBins: processing.n_bins,
  };
}
