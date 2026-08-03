import { describe, expect, it } from 'vitest';
import {
  calculateIntegratedSignal,
  getCalibrationInfo,
  predictConcentration,
  processFrame,
} from './concentrationPredictor';
import { DETECTION_THRESHOLD_UG_ML } from './config';

describe('calibration contract', () => {
  it('uses one 30 ug/mL operational threshold', () => {
    expect(DETECTION_THRESHOLD_UG_ML).toBe(30);
    expect(getCalibrationInfo().unit).toBe('ug/mL');
  });

  it('inverts the JSON linear calibration', () => {
    const { slope, intercept } = getCalibrationInfo().model;
    expect(slope).toBeCloseTo(1.8989778571707154, 12);
    expect(intercept).toBeCloseTo(149.32508214196258, 12);
    expect(getCalibrationInfo().validRange).toEqual({ min: 0, max: 290 });
    expect(predictConcentration(slope * 30 + intercept)).toBeCloseTo(30, 10);
  });

  it('rejects malformed and non-finite frames', () => {
    expect(calculateIntegratedSignal(new Float64Array(10))).toBeNull();
    const bins = new Float64Array(getCalibrationInfo().nBins);
    bins[0] = Number.NaN;
    expect(processFrame(bins)).toEqual({
      concentration: null,
      signal: null,
      status: 'invalid',
    });
  });

  it('labels predictions outside the calibration range', () => {
    const { slope, intercept } = getCalibrationInfo().model;
    expect(processFrameFromSignal(slope * -1 + intercept).status).toBe('below_range');
    expect(processFrameFromSignal(intercept).status).toBe('valid');
    expect(processFrameFromSignal(slope * 295 + intercept).status).toBe('above_range');
    expect(processFrameFromSignal(slope * 290 + intercept).status).toBe('valid');
  });
});

function processFrameFromSignal(signal) {
  const info = getCalibrationInfo();
  const bins = new Float64Array(info.nBins);
  bins[info.windowRange[0]] = signal;
  return processFrame(bins);
}
