import React, { createRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Plotly from 'plotly.js-dist-min';
import { payloadForConcentration } from '../../test/spadFixtures';
import SpadHistogram from './SpadHistogram';

vi.mock('plotly.js-dist-min', () => ({
  default: {
    newPlot: vi.fn().mockResolvedValue(undefined),
    relayout: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}));

function framed(payload, opCode = 0x4005) {
  const frame = new Uint8Array(7 + payload.byteLength);
  frame[0] = 0x7e;
  frame[1] = 0xe7;
  frame[2] = opCode & 0xff;
  frame[3] = opCode >>> 8;
  frame[4] = payload.byteLength & 0xff;
  frame[5] = payload.byteLength >>> 8;
  frame.set(payload, 6);
  frame[frame.length - 1] = frame
    .subarray(0, frame.length - 1)
    .reduce((sum, value) => (sum + value) & 0xff, 0);
  return frame;
}

function fakePortForFrames(chunks, clock) {
  let readable = true;
  const reader = {
    read: vi.fn(async () => {
      if (chunks.length === 0) {
        readable = false;
        return { value: undefined, done: true };
      }
      clock.now += 2_000;
      return { value: chunks.shift(), done: false };
    }),
    releaseLock: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const port = {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(port, 'readable', {
    get: () => (readable ? { getReader: () => reader } : null),
  });
  return port;
}

describe('SpadHistogram run integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Plotly.newPlot.mockResolvedValue(undefined);
    Plotly.relayout.mockResolvedValue(undefined);
    Plotly.update.mockResolvedValue(undefined);
  });

  it('stays live and emits higher records after positivity', async () => {
    const clock = { now: 0 };
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
    const concentrations = [
      49, 50, 51, 50, 49, 51, 50, 49, 51, 50,
      ...Array(14).fill(70),
    ];
    const port = fakePortForFrames(
      concentrations.map((concentration) => framed(payloadForConcentration(concentration))),
      clock,
    );
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: { requestPort: vi.fn().mockResolvedValue(port) },
    });
    const onDetectionUpdate = vi.fn();
    const onConcentrationPoint = vi.fn();
    const onTransportChange = vi.fn();
    const ref = createRef();
    render(
      <SpadHistogram
        ref={ref}
        onDetectionUpdate={onDetectionUpdate}
        onConcentrationPoint={onConcentrationPoint}
        onTransportChange={onTransportChange}
        onActiveTimeChange={vi.fn()}
      />,
    );

    await act(async () => ref.current.startConnection());
    await waitFor(() => {
      expect(onDetectionUpdate.mock.calls.some(([event]) => event.positiveJustLatched)).toBe(true);
    });

    const positiveCall = onDetectionUpdate.mock.calls
      .map(([event]) => event)
      .find((event) => event.positiveJustLatched);
    const laterRecords = onDetectionUpdate.mock.calls
      .map(([event]) => event)
      .filter((event) => event.lowerBoundUpdate)
      .filter((event) => event.block.timeMs > positiveCall.block.timeMs);
    expect(onTransportChange).toHaveBeenNthCalledWith(1, 'connecting');
    expect(onTransportChange).toHaveBeenCalledWith('live');
    expect(onConcentrationPoint).toHaveBeenCalledTimes(concentrations.length);
    expect(onConcentrationPoint).toHaveBeenLastCalledWith(expect.objectContaining({
      time: expect.any(Number),
      concentration: expect.any(Number),
    }));
    expect(laterRecords.at(-1).lowerBoundUpdate.concentration)
      .toBeGreaterThan(positiveCall.lowerBoundUpdate.concentration);
    expect(laterRecords.at(-1).timeToPositiveMs).toBe(positiveCall.timeToPositiveMs);
  });

  it('separates malformed packets from out-of-range predictions', async () => {
    const clock = { now: 0 };
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
    const malformed = framed(payloadForConcentration(50));
    malformed[malformed.length - 1] ^= 0xff;
    const controlPacket = framed(new Uint8Array([1, 2, 3]), 0x1001);
    const port = fakePortForFrames([
      malformed,
      controlPacket,
      framed(payloadForConcentration(95)),
    ], clock);
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: { requestPort: vi.fn().mockResolvedValue(port) },
    });
    const ref = createRef();
    render(
      <SpadHistogram
        ref={ref}
        onDetectionUpdate={vi.fn()}
        onTransportChange={vi.fn()}
        onActiveTimeChange={vi.fn()}
      />,
    );

    await act(async () => ref.current.startConnection());
    await waitFor(() => {
      expect(screen.getByText('Malformed packets: 1')).toBeInTheDocument();
      expect(screen.getByText('Out-of-range predictions: 1')).toBeInTheDocument();
    });
  });

  it('reports an error when the port request fails', async () => {
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: { requestPort: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const onTransportChange = vi.fn();
    const ref = createRef();
    render(
      <SpadHistogram
        ref={ref}
        onDetectionUpdate={vi.fn()}
        onTransportChange={onTransportChange}
        onActiveTimeChange={vi.fn()}
      />,
    );
    await act(async () => ref.current.startConnection());
    expect(onTransportChange).toHaveBeenLastCalledWith('error');
  });
});
