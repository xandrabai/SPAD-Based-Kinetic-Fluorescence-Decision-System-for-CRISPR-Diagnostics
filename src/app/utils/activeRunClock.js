export function createActiveRunClock(nowMs) {
  return { startedAtMs: nowMs, pausedAtMs: null, pausedTotalMs: 0 };
}

export function pauseActiveRunClock(clock, nowMs) {
  return clock.pausedAtMs === null ? { ...clock, pausedAtMs: nowMs } : clock;
}

export function resumeActiveRunClock(clock, nowMs) {
  if (clock.pausedAtMs === null) return clock;
  return {
    ...clock,
    pausedAtMs: null,
    pausedTotalMs: clock.pausedTotalMs + (nowMs - clock.pausedAtMs),
  };
}

export function elapsedActiveMs(clock, nowMs) {
  const endMs = clock.pausedAtMs ?? nowMs;
  return Math.max(0, endMs - clock.startedAtMs - clock.pausedTotalMs);
}
