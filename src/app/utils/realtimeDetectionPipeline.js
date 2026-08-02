import { addPrediction, createBlockAggregator } from './blockAggregator';
import { createDetectionState, ingestCompletedBlock } from './detectionEngine';
import { decodeHistogramPayload } from './frameDecoder';
import { processFrame } from './concentrationPredictor';

export function createRealtimePipeline() {
  return {
    aggregator: createBlockAggregator(),
    detection: createDetectionState(),
    invalidFrameCount: 0,
  };
}

export function processRealtimePayload(state, payload, activeElapsedMs) {
  const bins = decodeHistogramPayload(payload);
  if (bins === null) {
    return {
      state: { ...state, invalidFrameCount: state.invalidFrameCount + 1 },
      status: 'invalid_frame',
      bins: null,
      prediction: null,
      completedEvents: [],
    };
  }

  const prediction = processFrame(bins);
  if (prediction.status !== 'valid') {
    return {
      state: { ...state, invalidFrameCount: state.invalidFrameCount + 1 },
      status: prediction.status === 'invalid' ? 'invalid_frame' : 'out_of_range',
      bins,
      prediction,
      completedEvents: [],
    };
  }

  const aggregation = addPrediction(
    state.aggregator,
    prediction.concentration,
    activeElapsedMs,
  );
  let detection = state.detection;
  const completedEvents = aggregation.completedBlocks.map((block) => {
    const event = ingestCompletedBlock(detection, block);
    detection = event.state;
    return event;
  });

  return {
    state: { ...state, aggregator: aggregation.state, detection },
    status: 'valid',
    bins,
    prediction,
    completedEvents,
  };
}
