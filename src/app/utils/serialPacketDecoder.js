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
    if (buffer.length < 6) break;

    const payloadLength = buffer[4] | (buffer[5] << 8);
    const packetLength = 6 + payloadLength;
    if (buffer.length < packetLength) break;

    histogramPayloads.push(buffer.slice(6, packetLength));
    buffer = buffer.slice(packetLength);
  }

  return { buffer, histogramPayloads, malformedPacketCount };
}
