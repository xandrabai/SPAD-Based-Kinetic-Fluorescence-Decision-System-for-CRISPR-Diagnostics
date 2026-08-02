import { getCalibrationInfo } from './concentrationPredictor';
import { HISTOGRAM_BYTES } from './frameDecoder';

export function payloadForConcentration(concentration) {
  const info = getCalibrationInfo();
  const bins = new Uint16Array(info.nBins);
  const signal = Math.round(info.model.slope * concentration + info.model.intercept);
  bins[info.windowRange[0]] = signal;
  const payload = new Uint8Array(HISTOGRAM_BYTES);
  const view = new DataView(payload.buffer);
  for (let pair = 0; pair < bins.length / 2; pair += 1) {
    const word = bins[pair * 2] | (bins[pair * 2 + 1] << 12);
    view.setUint32(pair * 4, word >>> 0, true);
  }
  return payload;
}
