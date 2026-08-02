import { afterEach, expect, it, vi } from 'vitest';
import { replayEnabled, startPositiveReplay } from './replaySource';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('is enabled only for the explicit positive replay query', () => {
  expect(replayEnabled('?replay=positive')).toBe(true);
  expect(replayEnabled('?replay=negative')).toBe(false);
  expect(replayEnabled('')).toBe(false);
});

it('emits the complete deterministic sequence and can be stopped', () => {
  vi.useFakeTimers();
  const onPayload = vi.fn();
  const onComplete = vi.fn();
  const stop = startPositiveReplay(onPayload, onComplete);
  vi.advanceTimersByTime(48_000);
  expect(onPayload).toHaveBeenCalledTimes(24);
  expect(onComplete).toHaveBeenCalledOnce();
  stop();
  vi.advanceTimersByTime(10_000);
  expect(onPayload).toHaveBeenCalledTimes(24);
});
