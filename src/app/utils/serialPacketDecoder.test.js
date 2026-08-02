import { describe, expect, it } from 'vitest';
import { consumeSerialBytes, HISTOGRAM_OPCODE } from './serialPacketDecoder';

function packet(opcode, payload, corruptChecksum = false) {
  const bytes = new Uint8Array(7 + payload.length);
  bytes.set([0x7e, 0xe7, opcode & 0xff, opcode >> 8, payload.length & 0xff, payload.length >> 8]);
  bytes.set(payload, 6);
  bytes[bytes.length - 1] = bytes
    .slice(0, -1)
    .reduce((sum, value) => (sum + value) & 0xff, 0);
  if (corruptChecksum) bytes[bytes.length - 1] ^= 0xff;
  return bytes;
}

describe('consumeSerialBytes', () => {
  it('retains partial packets and emits a complete histogram', () => {
    const frame = packet(HISTOGRAM_OPCODE, new Uint8Array([1, 2, 3]));
    const partial = consumeSerialBytes(new Uint8Array(), frame.slice(0, 5));
    expect(partial.histogramPayloads).toHaveLength(0);
    expect(partial.buffer).toHaveLength(5);

    const complete = consumeSerialBytes(partial.buffer, frame.slice(5));
    expect(Array.from(complete.histogramPayloads[0])).toEqual([1, 2, 3]);
    expect(complete.buffer).toHaveLength(0);
  });

  it('ignores valid non-histogram packets and counts checksum failures', () => {
    const other = packet(0x1001, new Uint8Array([4]));
    const bad = packet(HISTOGRAM_OPCODE, new Uint8Array([5]), true);
    const decoded = consumeSerialBytes(new Uint8Array(), new Uint8Array([...other, ...bad]));
    expect(decoded.histogramPayloads).toHaveLength(0);
    expect(decoded.malformedPacketCount).toBe(1);
  });
});
