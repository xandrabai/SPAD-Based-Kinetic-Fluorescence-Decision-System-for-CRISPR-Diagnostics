export const HISTOGRAM_OPCODE = 0x4005;

function joinBytes(left, right) {
  const joined = new Uint8Array(left.length + right.length);
  joined.set(left);
  joined.set(right, left.length);
  return joined;
}

export function consumeSerialBytes(previousBuffer, chunk) {
  let buffer = joinBytes(previousBuffer, chunk);
  const histogramPayloads = [];
  let malformedPacketCount = 0;

  while (buffer.length >= 2) {
    if (buffer[0] !== 0x7e || buffer[1] !== 0xe7) {
      buffer = buffer.slice(1);
      continue;
    }
    if (buffer.length < 7) break;

    const opcode = buffer[2] | (buffer[3] << 8);
    const payloadLength = buffer[4] | (buffer[5] << 8);
    const packetLength = 7 + payloadLength;
    if (buffer.length < packetLength) break;

    const packet = buffer.slice(0, packetLength);
    let expectedChecksum = 0;
    for (let index = 0; index < packet.length - 1; index += 1) {
      expectedChecksum = (expectedChecksum + packet[index]) & 0xff;
    }

    if (packet[packet.length - 1] !== expectedChecksum) {
      malformedPacketCount += 1;
    } else if (opcode === HISTOGRAM_OPCODE) {
      histogramPayloads.push(packet.slice(6, packet.length - 1));
    }
    buffer = buffer.slice(packetLength);
  }

  return { buffer, histogramPayloads, malformedPacketCount };
}
