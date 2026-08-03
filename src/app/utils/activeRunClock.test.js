import { expect, it } from 'vitest';
import {
  createActiveRunClock,
  elapsedActiveMs,
  pauseActiveRunClock,
  resumeActiveRunClock,
} from './activeRunClock';

it('excludes paused wall time from active time', () => {
  let clock = createActiveRunClock(1_000);
  expect(elapsedActiveMs(clock, 4_000)).toBe(3_000);
  clock = pauseActiveRunClock(clock, 4_000);
  expect(elapsedActiveMs(clock, 9_000)).toBe(3_000);
  clock = resumeActiveRunClock(clock, 9_000);
  expect(elapsedActiveMs(clock, 11_000)).toBe(5_000);
});
