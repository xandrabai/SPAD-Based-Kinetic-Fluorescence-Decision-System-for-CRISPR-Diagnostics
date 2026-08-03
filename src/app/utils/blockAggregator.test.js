import { describe, expect, it } from 'vitest';
import { addPrediction, createBlockAggregator } from './blockAggregator';

describe('two-second block aggregation', () => {
  it('uses half-open blocks and emits one mean per non-empty completed block', () => {
    let state = createBlockAggregator();
    ({ state } = addPrediction(state, 10, 0));
    ({ state } = addPrediction(state, 14, 1_999));
    const transition = addPrediction(state, 20, 2_000);
    expect(transition.completedBlocks).toEqual([
      { timeMs: 2_000, concentration: 12, frameCount: 2 },
    ]);
    expect(transition.state.blockIndex).toBe(1);
  });

  it('skips empty periods and reset discards a partial block', () => {
    let state = createBlockAggregator();
    ({ state } = addPrediction(state, 10, 0));
    const transition = addPrediction(state, 30, 6_100);
    expect(transition.completedBlocks).toHaveLength(1);
    state = createBlockAggregator();
    expect(state).toEqual({ blockIndex: null, sum: 0, count: 0 });
  });

  it('does not advance when active time is unchanged during pause', () => {
    let state = createBlockAggregator();
    ({ state } = addPrediction(state, 20, 1_500));
    const transition = addPrediction(state, 22, 1_500);
    expect(transition.completedBlocks).toEqual([]);
    expect(transition.state.count).toBe(2);
  });
});
