import { BLOCK_DURATION_MS } from './config';

export function createBlockAggregator() {
  return { blockIndex: null, sum: 0, count: 0 };
}

export function addPrediction(state, concentration, activeElapsedMs) {
  if (!Number.isFinite(concentration) || !Number.isFinite(activeElapsedMs) || activeElapsedMs < 0) {
    return { state, completedBlocks: [] };
  }

  const blockIndex = Math.floor(activeElapsedMs / BLOCK_DURATION_MS);
  if (state.blockIndex === null) {
    return {
      state: { blockIndex, sum: concentration, count: 1 },
      completedBlocks: [],
    };
  }

  if (blockIndex < state.blockIndex) return { state, completedBlocks: [] };
  if (blockIndex === state.blockIndex) {
    return {
      state: { ...state, sum: state.sum + concentration, count: state.count + 1 },
      completedBlocks: [],
    };
  }

  const completed = {
    timeMs: (state.blockIndex + 1) * BLOCK_DURATION_MS,
    concentration: state.sum / state.count,
    frameCount: state.count,
  };
  return {
    state: { blockIndex, sum: concentration, count: 1 },
    completedBlocks: [completed],
  };
}
