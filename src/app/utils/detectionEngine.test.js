import { describe, expect, it, vi } from 'vitest';
import { createDetectionState, ingestCompletedBlock } from './detectionEngine';

describe('detection engine', () => {
  it('publishes record highs, latches positivity once, and continues afterward', () => {
    const evaluations = [
      { status: 'valid', lowerBound: 29, isPositive: false },
      { status: 'valid', lowerBound: 28, isPositive: false },
      { status: 'valid', lowerBound: 31, isPositive: true },
      { status: 'valid', lowerBound: 33, isPositive: true },
      { status: 'valid', lowerBound: 30, isPositive: false },
    ];
    const evaluator = vi.fn(() => evaluations.shift());
    let state = createDetectionState();

    for (let index = 0; index < 9; index += 1) {
      ({ state } = ingestCompletedBlock(
        state,
        { timeMs: (index + 1) * 2_000, concentration: 25 + index, frameCount: 10 },
        evaluator,
      ));
    }
    expect(evaluator).not.toHaveBeenCalled();

    let transition = ingestCompletedBlock(
      state,
      { timeMs: 20_000, concentration: 34, frameCount: 10 },
      evaluator,
    );
    state = transition.state;
    expect(transition.lowerBoundUpdate.concentration).toBe(29);
    expect(state.isPositive).toBe(false);

    transition = ingestCompletedBlock(state, { timeMs: 22_000, concentration: 35, frameCount: 10 }, evaluator);
    state = transition.state;
    expect(transition.lowerBoundUpdate).toBeNull();

    transition = ingestCompletedBlock(state, { timeMs: 24_000, concentration: 36, frameCount: 10 }, evaluator);
    state = transition.state;
    expect(transition.positiveJustLatched).toBe(true);
    expect(state.timeToPositiveMs).toBe(24_000);

    transition = ingestCompletedBlock(state, { timeMs: 26_000, concentration: 37, frameCount: 10 }, evaluator);
    state = transition.state;
    expect(transition.lowerBoundUpdate.concentration).toBe(33);
    expect(state.isPositive).toBe(true);
    expect(state.timeToPositiveMs).toBe(24_000);

    transition = ingestCompletedBlock(state, { timeMs: 28_000, concentration: 36, frameCount: 10 }, evaluator);
    expect(transition.state.isPositive).toBe(true);
    expect(transition.state.timeToPositiveMs).toBe(24_000);
    expect(transition.lowerBoundUpdate).toBeNull();
  });

  it('does not treat a lower bound equal to 30 as positive', () => {
    let state = createDetectionState();
    const evaluator = () => ({ status: 'valid', lowerBound: 30, isPositive: true });
    for (let index = 0; index < 10; index += 1) {
      ({ state } = ingestCompletedBlock(
        state,
        { timeMs: (index + 1) * 2_000, concentration: 30, frameCount: 1 },
        evaluator,
      ));
    }
    expect(state.isPositive).toBe(false);
  });
});
