import { describe, expect, it } from 'vitest';
import {
  HISTOGRAM_PAYLOAD_BYTES,
  decodeHistogramPayload,
} from './frameDecoder';

describe('decodeHistogramPayload', () => {
  it('rejects partial payloads', () => {
    expect(decodeHistogramPayload(new Uint8Array(HISTOGRAM_PAYLOAD_BYTES - 1))).toBeNull();
  });

  it('decodes two unsigned 12-bit bins per little-endian word', () => {
    const payload = new Uint8Array(HISTOGRAM_PAYLOAD_BYTES);
    new DataView(payload.buffer).setUint32(0, 0x80abc123, true);
    const bins = decodeHistogramPayload(payload);
    expect(bins[0]).toBe(0x123);
    expect(bins[1]).toBe(0xabc);
    expect(bins).toHaveLength(3840);
  });
});
