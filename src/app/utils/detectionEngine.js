import { DETECTION_THRESHOLD_UG_ML, MIN_BLOCKS_FOR_DECISION } from './config';
import { evaluateSequentialConfidence } from './predictionConfidence';

export function createDetectionState() {
  return {
    blockMeans: [],
    publishedLowerBound: null,
    isPositive: false,
    timeToPositiveMs: null,
    latestEvidence: null,
  };
}

export function ingestCompletedBlock(state, block, evaluator = evaluateSequentialConfidence) {
  const blockMeans = [...state.blockMeans, block.concentration];
  const lookNumber = Math.max(0, blockMeans.length - MIN_BLOCKS_FOR_DECISION + 1);
  const evidence = lookNumber === 0
    ? { status: 'insufficient', n: blockMeans.length, lookNumber }
    : evaluator(blockMeans, lookNumber);
  const hasBound = evidence.status === 'valid' && Number.isFinite(evidence.lowerBound);
  const isRecord = hasBound && (
    state.publishedLowerBound === null || evidence.lowerBound > state.publishedLowerBound
  );
  const crosses = hasBound
    && evidence.isPositive
    && evidence.lowerBound > DETECTION_THRESHOLD_UG_ML;
  const positiveJustLatched = !state.isPositive && crosses;
  const isPositive = state.isPositive || crosses;
  const timeToPositiveMs = positiveJustLatched ? block.timeMs : state.timeToPositiveMs;
  const publishedLowerBound = isRecord ? evidence.lowerBound : state.publishedLowerBound;

  const nextState = {
    blockMeans,
    publishedLowerBound,
    isPositive,
    timeToPositiveMs,
    latestEvidence: evidence,
  };
  return {
    state: nextState,
    block,
    blockCount: blockMeans.length,
    evidence,
    lowerBoundUpdate: isRecord
      ? { time: block.timeMs / 1_000, concentration: evidence.lowerBound }
      : null,
    positiveJustLatched,
    isPositive,
    timeToPositiveMs,
  };
}
