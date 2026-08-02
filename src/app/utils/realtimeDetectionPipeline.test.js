import { expect, it } from 'vitest';
import { payloadForConcentration } from '../../test/spadFixtures';
import { createRealtimePipeline, processRealtimePayload } from './realtimeDetectionPipeline';

it('crosses after ten variable high blocks and keeps updating afterward', () => {
  let state = createRealtimePipeline();
  const concentrations = [
    49, 50, 51, 50, 49, 51, 50, 49, 51, 50,
    ...Array(14).fill(70),
  ];
  const events = [];
  concentrations.forEach((concentration, index) => {
    const transition = processRealtimePayload(
      state,
      payloadForConcentration(concentration),
      index * 2_000,
    );
    state = transition.state;
    events.push(...transition.completedEvents);
  });
  const positive = events.find((event) => event.positiveJustLatched);
  expect(positive).toBeDefined();
  expect(positive.timeToPositiveMs).toBe(20_000);
  const laterRecord = events.at(-1).lowerBoundUpdate;
  expect(laterRecord.concentration).toBeGreaterThan(positive.lowerBoundUpdate.concentration);
  expect(events.at(-1).timeToPositiveMs).toBe(20_000);
});

it('rejects malformed and out-of-range payloads', () => {
  let state = createRealtimePipeline();
  let transition = processRealtimePayload(state, new Uint8Array(2), 0);
  expect(transition.status).toBe('invalid_frame');
  expect(transition.state.malformedFrameCount).toBe(1);
  expect(transition.state.outOfRangeFrameCount).toBe(0);

  state = transition.state;
  transition = processRealtimePayload(state, payloadForConcentration(95), 0);
  expect(transition.status).toBe('out_of_range');
  expect(transition.state.malformedFrameCount).toBe(1);
  expect(transition.state.outOfRangeFrameCount).toBe(1);
});
