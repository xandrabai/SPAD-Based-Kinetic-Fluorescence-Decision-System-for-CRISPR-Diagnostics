export const HISTOGRAM_BIN_COUNT = 3_840;
export const HISTOGRAM_PAYLOAD_BYTES = (HISTOGRAM_BIN_COUNT / 2) * 4;
export const SHORT_HISTOGRAM_BIN_COUNT = 256;
export const HISTOGRAM_BYTES = ((HISTOGRAM_BIN_COUNT + SHORT_HISTOGRAM_BIN_COUNT) / 2) * 4;

export function decodeHistogramPayload(payload) {
  if (!(payload instanceof Uint8Array) || payload.byteLength < HISTOGRAM_PAYLOAD_BYTES) {
    return null;
  }

  const bins = new Float64Array(HISTOGRAM_BIN_COUNT);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  for (let pair = 0; pair < HISTOGRAM_BIN_COUNT / 2; pair += 1) {
    const word = view.getUint32(pair * 4, true);
    bins[pair * 2] = word & 0xfff;
    bins[pair * 2 + 1] = (word >>> 12) & 0xfff;
  }
  return bins;
}
