import { describe, expect, it } from 'vitest';
import { consumeSerialBytes } from './serialPacketDecoder';

function packet(opcode, payload) {
  const bytes = new Uint8Array(6 + payload.length);
  bytes.set([0x7e, 0xe7, opcode & 0xff, opcode >> 8, payload.length & 0xff, payload.length >> 8]);
  bytes.set(payload, 6);
  return bytes;
}

describe('consumeSerialBytes', () => {
  it('retains partial packets and emits a complete histogram', () => {
    const frame = packet(0x4005, new Uint8Array([1, 2, 3]));
    const partial = consumeSerialBytes(new Uint8Array(), frame.slice(0, 5));
    expect(partial.histogramPayloads).toHaveLength(0);
    expect(partial.buffer).toHaveLength(5);

    const complete = consumeSerialBytes(partial.buffer, frame.slice(5));
    expect(Array.from(complete.histogramPayloads[0])).toEqual([1, 2, 3]);
    expect(complete.buffer).toHaveLength(0);
  });

  it('matches the working Vercel parser without opcode or checksum filtering', () => {
    const frame = packet(0x1001, new Uint8Array([4, 5]));
    const decoded = consumeSerialBytes(new Uint8Array(), frame);
    expect(decoded.histogramPayloads.map((payload) => Array.from(payload))).toEqual([[4, 5]]);
    expect(decoded.malformedPacketCount).toBe(0);
  });
});
