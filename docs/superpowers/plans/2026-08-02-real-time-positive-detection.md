# Real-Time Positive Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-side SPAD detection flow that publishes only sequentially adjusted record-high lower concentration bounds, latches POSITIVE above `30 ug/mL`, freezes time to positive once, and continues detecting afterward.

**Architecture:** Keep Web Serial transport in `SpadHistogram.jsx`, but move decoding, two-second aggregation, alpha-spending inference, and positivity latching into pure utilities. `App.tsx` renders transport and assay state separately; `model_equations.json` is the calibration source of truth, and all UI charts consume explicit block-mean or lower-bound event streams.

**Tech Stack:** React 18, TypeScript/JavaScript, Vite 6, Plotly, Recharts, Web Serial, Vitest 3, jsdom, Testing Library.

---

## File map

- Modify `package.json` and `package-lock.json`: add the test runner and deterministic test scripts.
- Modify `vite.config.ts`: configure Vitest with jsdom and a shared setup file.
- Create `src/test/setup.ts`: install DOM matchers and cleanup.
- Create `src/test/spadFixtures.js`: encode deterministic 3,840-bin SPAD payloads for tests and replay.
- Modify `model_equations.json`: declare the calibration unit explicitly.
- Modify `src/app/utils/config.js`: define the single `30 ug/mL` threshold, block duration, minimum block count, and run alpha.
- Modify `src/app/utils/concentrationPredictor.js`: import the JSON calibration and reject invalid inputs.
- Create `src/app/utils/frameDecoder.js`: validate and unpack one complete histogram payload.
- Create `src/app/utils/activeRunClock.js`: track active time while excluding pauses.
- Create `src/app/utils/blockAggregator.js`: reduce frame predictions into non-empty two-second means.
- Modify `src/app/utils/predictionConfidence.js`: calculate alpha-spent one-sided t bounds from block means.
- Create `src/app/utils/detectionEngine.js`: publish record-high bounds and latch positivity/time exactly once.
- Create `src/app/utils/realtimeDetectionPipeline.js`: compose decode -> predict -> block -> detect for live and replayed payloads.
- Modify `src/app/components/SpadHistogram.jsx`: use the pure pipeline, expose real transport state, and continue after positivity.
- Create `src/app/components/DetectionResultPanel.tsx`: render neutral/negative/positive states and frozen time to positive accessibly.
- Modify `src/app/components/ConcentrationTimeChart.jsx`: plot published lower bounds with a `30 ug/mL` reference line.
- Modify `src/app/App.tsx`: own the run UI state, active timer, lower-bound history, and all-block 30-second averages.
- Modify `src/styles/index.css`: add responsive layout, visible focus, and supported-browser/error presentation.
- Modify `README.md`: document the operational threshold, statistical meaning, and replay verification mode.
- Regenerate `dist/`: replace the stale simulated build after all verification passes.

### Task 1: Install and configure the test harness

**Files:**
- Modify: `package.json:6-9,68-73`
- Modify: `package-lock.json`
- Modify: `vite.config.ts:19-36`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install compatible test dependencies**

Run:

```bash
npm install --save-dev vitest@3.2.4 jsdom@26.1.0 @testing-library/react@16.3.0 @testing-library/jest-dom@6.6.3 @testing-library/user-event@14.6.1
```

Expected: exit 0; `package-lock.json` records the five packages.

- [ ] **Step 2: Add test scripts and Vitest configuration**

Set the `scripts` object in `package.json` to:

```json
{
  "build": "vite build",
  "dev": "vite",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Change the first import in `vite.config.ts` to `import { defineConfig } from 'vitest/config'`, then add the following sibling to `resolve`:

```ts
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    restoreMocks: true,
    clearMocks: true,
  },
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

- [ ] **Step 3: Prove the harness runs**

Run:

```bash
npm test -- --passWithNoTests
```

Expected: exit 0 and `No test files found` or `0 tests`.

- [ ] **Step 4: Commit the harness**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts
git commit -m "test: add frontend test harness"
```

### Task 2: Make calibration and units a single tested contract

**Files:**
- Modify: `model_equations.json:1-37`
- Modify: `src/app/utils/config.js:1-18`
- Modify: `src/app/utils/concentrationPredictor.js:1-120`
- Create: `src/app/utils/concentrationPredictor.test.js`

- [ ] **Step 1: Write failing calibration and predictor tests**

Create `src/app/utils/concentrationPredictor.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  calculateIntegratedSignal,
  getCalibrationInfo,
  predictConcentration,
  processFrame,
} from './concentrationPredictor';
import { DETECTION_THRESHOLD_UG_ML } from './config';

describe('calibration contract', () => {
  it('uses one 30 ug/mL operational threshold', () => {
    expect(DETECTION_THRESHOLD_UG_ML).toBe(30);
    expect(getCalibrationInfo().unit).toBe('ug/mL');
  });

  it('inverts the JSON linear calibration', () => {
    const { slope, intercept } = getCalibrationInfo().model;
    expect(predictConcentration(slope * 30 + intercept)).toBeCloseTo(30, 10);
  });

  it('rejects malformed and non-finite frames', () => {
    expect(calculateIntegratedSignal(new Float64Array(10))).toBeNull();
    const bins = new Float64Array(getCalibrationInfo().nBins);
    bins[0] = Number.NaN;
    expect(processFrame(bins)).toEqual({
      concentration: null,
      signal: null,
      status: 'invalid',
    });
  });

  it('labels predictions outside the calibration range', () => {
    const { slope, intercept } = getCalibrationInfo().model;
    expect(processFrameFromSignal(slope * 5 + intercept).status).toBe('below_range');
    expect(processFrameFromSignal(slope * 95 + intercept).status).toBe('above_range');
  });
});

function processFrameFromSignal(signal) {
  const info = getCalibrationInfo();
  const bins = new Float64Array(info.nBins);
  bins[info.windowRange[0]] = signal;
  return processFrame(bins);
}
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- src/app/utils/concentrationPredictor.test.js
```

Expected: FAIL because `DETECTION_THRESHOLD_UG_ML`, JSON-backed metadata, `unit`, and invalid-frame behavior do not exist.

- [ ] **Step 3: Add the explicit unit and threshold configuration**

Add this top-level JSON property after `calibration_mode` in `model_equations.json`:

```json
"concentration_unit": "ug/mL",
```

Replace `src/app/utils/config.js` with:

```js
export const DETECTION_THRESHOLD_UG_ML = 30;
export const BLOCK_DURATION_MS = 2_000;
export const MIN_BLOCKS_FOR_DECISION = 10;
export const RUN_ALPHA = 0.05;
```

Replace the hand-copied calibration object and exported functions in `concentrationPredictor.js` with:

```js
import calibrationBundle from '../../../model_equations.json';

const [minConcentration, maxConcentration] =
  calibrationBundle.valid_concentration_range_ug_ml;
const linearModel = calibrationBundle.models.linear;
const processing = calibrationBundle.signal_processing;

export function calculateIntegratedSignal(bins) {
  if (!bins || bins.length !== processing.n_bins) return null;
  for (const value of bins) {
    if (!Number.isFinite(value)) return null;
  }

  let windowSum = 0;
  for (let index = processing.window_start; index <= processing.window_end; index += 1) {
    windowSum += bins[index];
  }

  let backgroundSum = 0;
  for (let index = processing.background_start; index < processing.n_bins; index += 1) {
    backgroundSum += bins[index];
  }
  const backgroundCount = processing.n_bins - processing.background_start;
  const backgroundMean = backgroundSum / backgroundCount;
  const windowBins = processing.window_end - processing.window_start + 1;
  const signal = windowSum - backgroundMean * windowBins;
  return Number.isFinite(signal) ? signal : null;
}

export function predictConcentration(signal) {
  if (!Number.isFinite(signal)) return null;
  const concentration = (signal - linearModel.intercept) / linearModel.slope;
  return Number.isFinite(concentration) ? concentration : null;
}

export function processFrame(bins) {
  const signal = calculateIntegratedSignal(bins);
  const concentration = predictConcentration(signal);
  if (signal === null || concentration === null) {
    return { concentration: null, signal: null, status: 'invalid' };
  }
  if (concentration < minConcentration) {
    return { concentration, signal, status: 'below_range' };
  }
  if (concentration > maxConcentration) {
    return { concentration, signal, status: 'above_range' };
  }
  return { concentration, signal, status: 'valid' };
}

export function getCalibrationInfo() {
  return {
    unit: calibrationBundle.concentration_unit,
    model: linearModel,
    validRange: { min: minConcentration, max: maxConcentration },
    nBins: processing.n_bins,
    windowRange: [processing.window_start, processing.window_end],
    backgroundStart: processing.background_start,
  };
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npm test -- src/app/utils/concentrationPredictor.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit the calibration contract**

```bash
git add model_equations.json src/app/utils/config.js src/app/utils/concentrationPredictor.js src/app/utils/concentrationPredictor.test.js
git commit -m "fix: unify detection threshold and calibration units"
```

### Task 3: Validate SPAD payloads and active acquisition time

**Files:**
- Create: `src/app/utils/frameDecoder.js`
- Create: `src/app/utils/frameDecoder.test.js`
- Create: `src/app/utils/activeRunClock.js`
- Create: `src/app/utils/activeRunClock.test.js`

- [ ] **Step 1: Write failing decoder and clock tests**

Create `src/app/utils/frameDecoder.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  HISTOGRAM_PAYLOAD_BYTES,
  decodeHistogramPayload,
} from './frameDecoder';

describe('decodeHistogramPayload', () => {
  it('rejects partial payloads', () => {
    expect(decodeHistogramPayload(new Uint8Array(HISTOGRAM_PAYLOAD_BYTES - 1))).toBeNull();
  });

  it('decodes two unsigned 12-bit bins per little-endian word', () => {
    const payload = new Uint8Array(HISTOGRAM_PAYLOAD_BYTES);
    new DataView(payload.buffer).setUint32(0, 0x80abc123, true);
    const bins = decodeHistogramPayload(payload);
    expect(bins[0]).toBe(0x123);
    expect(bins[1]).toBe(0xabc);
    expect(bins).toHaveLength(3840);
  });
});
```

Create `src/app/utils/activeRunClock.test.js`:

```js
import { describe, expect, it } from 'vitest';
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
```

- [ ] **Step 2: Run both tests and verify RED**

Run:

```bash
npm test -- src/app/utils/frameDecoder.test.js src/app/utils/activeRunClock.test.js
```

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the decoder and active clock**

Create `src/app/utils/frameDecoder.js`:

```js
export const HISTOGRAM_BIN_COUNT = 3_840;
export const HISTOGRAM_PAYLOAD_BYTES = (HISTOGRAM_BIN_COUNT / 2) * 4;

export function decodeHistogramPayload(payload) {
  if (!(payload instanceof Uint8Array) || payload.byteLength !== HISTOGRAM_PAYLOAD_BYTES) {
    return null;
  }
  const bins = new Float64Array(HISTOGRAM_BIN_COUNT);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  for (let pair = 0; pair < HISTOGRAM_BIN_COUNT / 2; pair += 1) {
    const word = view.getUint32(pair * 4, true);
    bins[pair * 2] = word & 0xfff;
    bins[pair * 2 + 1] = (word >>> 12) & 0xfff;
  }
  return bins;
}
```

Create `src/app/utils/activeRunClock.js`:

```js
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
```

- [ ] **Step 4: Run both tests and verify GREEN**

Run:

```bash
npm test -- src/app/utils/frameDecoder.test.js src/app/utils/activeRunClock.test.js
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit decoder and clock**

```bash
git add src/app/utils/frameDecoder.js src/app/utils/frameDecoder.test.js src/app/utils/activeRunClock.js src/app/utils/activeRunClock.test.js
git commit -m "feat: validate SPAD frames and active run time"
```

### Task 4: Aggregate frames into two-second blocks

**Files:**
- Create: `src/app/utils/blockAggregator.js`
- Create: `src/app/utils/blockAggregator.test.js`

- [ ] **Step 1: Write failing block-boundary tests**

Create `src/app/utils/blockAggregator.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
npm test -- src/app/utils/blockAggregator.test.js
```

Expected: FAIL because `blockAggregator.js` is missing.

- [ ] **Step 3: Implement the pure aggregator**

Create `src/app/utils/blockAggregator.js`:

```js
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
```

- [ ] **Step 4: Run the tests and verify GREEN**

```bash
npm test -- src/app/utils/blockAggregator.test.js
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit block aggregation**

```bash
git add src/app/utils/blockAggregator.js src/app/utils/blockAggregator.test.js
git commit -m "feat: aggregate predictions into active-time blocks"
```

### Task 5: Replace repeated frame tests with alpha-spent sequential inference

**Files:**
- Modify: `src/app/utils/predictionConfidence.js:1-163`
- Create: `src/app/utils/predictionConfidence.test.js`

- [ ] **Step 1: Write failing sequential-statistics tests**

Create `src/app/utils/predictionConfidence.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { alphaForLook, evaluateSequentialConfidence } from './predictionConfidence';

describe('alpha-spent sequential confidence', () => {
  it('spends no more than alpha across an unbounded run', () => {
    const spent = Array.from({ length: 100_000 }, (_, index) => alphaForLook(index + 1))
      .reduce((sum, value) => sum + value, 0);
    expect(spent).toBeLessThan(0.05);
    expect(spent).toBeGreaterThan(0.049999);
  });

  it('publishes nothing before ten blocks', () => {
    expect(evaluateSequentialConfidence([40, 41, 42], 0).status).toBe('insufficient');
  });

  it('does not manufacture confidence for zero variance', () => {
    expect(evaluateSequentialConfidence(Array(10).fill(50), 1).status).toBe('zero_variance');
  });

  it('returns a positive lower bound for variable high data', () => {
    const result = evaluateSequentialConfidence([49, 50, 51, 50, 49, 51, 50, 49, 51, 50], 1);
    expect(result.status).toBe('valid');
    expect(result.alphaAtLook).toBe(0.025);
    expect(result.lowerBound).toBeGreaterThan(30);
    expect(result.isPositive).toBe(true);
  });

  it('keeps threshold-centered evidence negative', () => {
    const result = evaluateSequentialConfidence([29, 30, 31, 29, 30, 31, 29, 30, 31, 30], 1);
    expect(result.isPositive).toBe(false);
    expect(result.lowerBound).toBeLessThan(30);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
npm test -- src/app/utils/predictionConfidence.test.js
```

Expected: FAIL because the old module exposes only the accumulating-frame `evaluateConfidence` API.

- [ ] **Step 3: Keep the existing t CDF/quantile helpers and replace the public evaluator**

Change the imports to:

```js
import {
  DETECTION_THRESHOLD_UG_ML,
  MIN_BLOCKS_FOR_DECISION,
  RUN_ALPHA,
} from './config';
```

Export this alpha function and evaluator after the existing `studentTCDF` and `studentTQuantile` helpers:

```js
export function alphaForLook(lookNumber) {
  if (!Number.isInteger(lookNumber) || lookNumber < 1) return 0;
  return RUN_ALPHA / (lookNumber * (lookNumber + 1));
}

export function evaluateSequentialConfidence(blockMeans, lookNumber) {
  const n = blockMeans.length;
  if (n < MIN_BLOCKS_FOR_DECISION) {
    return { status: 'insufficient', n, lookNumber };
  }
  if (!blockMeans.every(Number.isFinite)) {
    return { status: 'invalid', n, lookNumber };
  }
  const avg = mean(blockMeans);
  const sd = sampleStdDev(blockMeans, avg);
  if (!Number.isFinite(sd) || sd === 0) {
    return { status: 'zero_variance', n, lookNumber, mean: avg };
  }
  const df = n - 1;
  const standardError = sd / Math.sqrt(n);
  const tStatistic = (avg - DETECTION_THRESHOLD_UG_ML) / standardError;
  const pValue = 1 - studentTCDF(tStatistic, df);
  const alphaAtLook = alphaForLook(lookNumber);
  const criticalT = studentTQuantile(1 - alphaAtLook, df);
  const lowerBound = avg - criticalT * standardError;
  return {
    status: 'valid',
    n,
    lookNumber,
    mean: avg,
    standardDeviation: sd,
    standardError,
    pValue,
    alphaAtLook,
    lowerBound,
    isPositive: pValue < alphaAtLook && lowerBound > DETECTION_THRESHOLD_UG_ML,
  };
}
```

Delete the old `evaluateConfidence` export and old threshold/confidence imports.

- [ ] **Step 4: Run the tests and verify GREEN**

```bash
npm test -- src/app/utils/predictionConfidence.test.js
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit sequential inference**

```bash
git add src/app/utils/predictionConfidence.js src/app/utils/predictionConfidence.test.js
git commit -m "feat: add alpha-spent sequential confidence bounds"
```

### Task 6: Latch positivity while continuing lower-bound updates

**Files:**
- Create: `src/app/utils/detectionEngine.js`
- Create: `src/app/utils/detectionEngine.test.js`

- [ ] **Step 1: Write failing state-machine tests**

Create `src/app/utils/detectionEngine.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
npm test -- src/app/utils/detectionEngine.test.js
```

Expected: FAIL because `detectionEngine.js` is missing.

- [ ] **Step 3: Implement the pure detection state machine**

Create `src/app/utils/detectionEngine.js`:

```js
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
  const evidence = lookNumber === 0 ? { status: 'insufficient', n: blockMeans.length, lookNumber } : evaluator(blockMeans, lookNumber);
  const hasBound = evidence.status === 'valid' && Number.isFinite(evidence.lowerBound);
  const isRecord = hasBound && (
    state.publishedLowerBound === null || evidence.lowerBound > state.publishedLowerBound
  );
  const crosses = hasBound && evidence.isPositive && evidence.lowerBound > DETECTION_THRESHOLD_UG_ML;
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
```

- [ ] **Step 4: Run the tests and verify GREEN**

```bash
npm test -- src/app/utils/detectionEngine.test.js
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit the detection engine**

```bash
git add src/app/utils/detectionEngine.js src/app/utils/detectionEngine.test.js
git commit -m "feat: latch positive detection without stopping updates"
```

### Task 7: Compose a replayable real-time pipeline

**Files:**
- Create: `src/app/utils/spadPayloadEncoder.js`
- Create: `src/test/spadFixtures.js`
- Create: `src/app/utils/realtimeDetectionPipeline.js`
- Create: `src/app/utils/realtimeDetectionPipeline.test.js`

- [ ] **Step 1: Write the fixture encoder and failing pipeline test**

Create `src/app/utils/spadPayloadEncoder.js`:

```js
import { getCalibrationInfo } from './concentrationPredictor';
import { HISTOGRAM_PAYLOAD_BYTES } from './frameDecoder';

export function payloadForConcentration(concentration) {
  const info = getCalibrationInfo();
  const bins = new Uint16Array(info.nBins);
  const signal = Math.round(info.model.slope * concentration + info.model.intercept);
  bins[info.windowRange[0]] = signal;
  const payload = new Uint8Array(HISTOGRAM_PAYLOAD_BYTES);
  const view = new DataView(payload.buffer);
  for (let pair = 0; pair < bins.length / 2; pair += 1) {
    const word = bins[pair * 2] | (bins[pair * 2 + 1] << 12);
    view.setUint32(pair * 4, word >>> 0, true);
  }
  return payload;
}
```

Create `src/test/spadFixtures.js` as a test-facing re-export:

```js
export { payloadForConcentration } from '../app/utils/spadPayloadEncoder';
```

Create `src/app/utils/realtimeDetectionPipeline.test.js`:

```js
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
  const state = createRealtimePipeline();
  expect(processRealtimePayload(state, new Uint8Array(2), 0).status).toBe('invalid_frame');
  expect(processRealtimePayload(state, payloadForConcentration(95), 0).status).toBe('out_of_range');
});
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
npm test -- src/app/utils/realtimeDetectionPipeline.test.js
```

Expected: FAIL because the pipeline module is missing.

- [ ] **Step 3: Implement the composed pipeline**

Create `src/app/utils/realtimeDetectionPipeline.js`:

```js
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
```

- [ ] **Step 4: Run the tests and verify GREEN**

```bash
npm test -- src/app/utils/realtimeDetectionPipeline.test.js
```

Expected: 2 tests pass, including continued record updates after positivity.

- [ ] **Step 5: Commit the replayable pipeline**

```bash
git add src/app/utils/spadPayloadEncoder.js src/test/spadFixtures.js src/app/utils/realtimeDetectionPipeline.js src/app/utils/realtimeDetectionPipeline.test.js
git commit -m "feat: compose replayable real-time detection pipeline"
```

### Task 8: Integrate the pipeline with Web Serial without stopping on positive

**Files:**
- Modify: `src/app/components/SpadHistogram.jsx:1-350`
- Create: `src/app/components/SpadHistogram.test.jsx`

- [ ] **Step 1: Write a failing integration test around the component contract**

Create `src/app/components/SpadHistogram.test.jsx`:

```jsx
import React, { createRef } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function framed(payload) {
  const frame = new Uint8Array(6 + payload.byteLength);
  frame[0] = 0x7e;
  frame[1] = 0xe7;
  frame[4] = payload.byteLength & 0xff;
  frame[5] = payload.byteLength >>> 8;
  frame.set(payload, 6);
  return frame;
}

function fakePortFor(payloads, clock) {
  const chunks = payloads.map(framed);
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
  beforeEach(() => vi.restoreAllMocks());

  it('stays live and emits higher records after positivity', async () => {
    const clock = { now: 0 };
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
    const concentrations = [
      49, 50, 51, 50, 49, 51, 50, 49, 51, 50,
      ...Array(14).fill(70),
    ];
    const port = fakePortFor(concentrations.map(payloadForConcentration), clock);
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: { requestPort: vi.fn().mockResolvedValue(port) },
    });
    const onDetectionUpdate = vi.fn();
    const onTransportChange = vi.fn();
    const ref = createRef();
    render(
      <SpadHistogram
        ref={ref}
        onDetectionUpdate={onDetectionUpdate}
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
    expect(laterRecords.at(-1).lowerBoundUpdate.concentration)
      .toBeGreaterThan(positiveCall.lowerBoundUpdate.concentration);
    expect(laterRecords.at(-1).timeToPositiveMs).toBe(positiveCall.timeToPositiveMs);
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
```

- [ ] **Step 2: Run the component test and verify RED**

```bash
npm test -- src/app/components/SpadHistogram.test.jsx
```

Expected: FAIL because the component still performs frame-level confidence testing, pauses on positive, and does not expose transport events.

- [ ] **Step 3: Replace frame-level statistical refs with pipeline and active-clock refs**

At the top of `SpadHistogram.jsx`, remove the old predictor/confidence/config imports and use:

```jsx
import {
  createRealtimePipeline,
  processRealtimePayload,
} from '../utils/realtimeDetectionPipeline';
import {
  createActiveRunClock,
  elapsedActiveMs,
  pauseActiveRunClock,
  resumeActiveRunClock,
} from '../utils/activeRunClock';
```

Change the component signature and refs to:

```jsx
const SpadHistogram = forwardRef(({
  onDetectionUpdate,
  onTransportChange,
  onActiveTimeChange,
}, ref) => {
  const pipelineRef = useRef(createRealtimePipeline());
  const clockRef = useRef(null);
  const [invalidFrameCount, setInvalidFrameCount] = useState(0);
  const [latestSignal, setLatestSignal] = useState(null);
  const [chartError, setChartError] = useState(null);
```

Replace the decoder/statistics section of `updatePlotWithFrame` with:

```jsx
const activeElapsedMs = clockRef.current
  ? elapsedActiveMs(clockRef.current, performance.now())
  : 0;
const transition = processRealtimePayload(
  pipelineRef.current,
  payloadBytes,
  activeElapsedMs,
);
pipelineRef.current = transition.state;
setInvalidFrameCount(transition.state.invalidFrameCount);
if (transition.bins === null) return;
const bins = transition.bins;
const algorithmicResult = processAlgorithm(bins);
if (transition.prediction?.signal !== null) setLatestSignal(transition.prediction.signal);
transition.completedEvents.forEach((event) => onDetectionUpdate?.(event));
```

Do not set `isPausedRef.current` when `event.isPositive` becomes true. Continue decoding all frames until the user pauses or resets.

- [ ] **Step 4: Tie transport and clock changes to actual serial operations**

Implement these transitions inside the existing imperative methods:

```jsx
const startConnection = async () => {
  onTransportChange?.('connecting');
  const beginRun = () => {
    pipelineRef.current = createRealtimePipeline();
    clockRef.current = createActiveRunClock(performance.now());
    keepReadingRef.current = true;
    isPausedRef.current = false;
    setInvalidFrameCount(0);
    setLatestSignal(null);
    onTransportChange?.('live');
  };
  if (portRef.current?.readable) {
    beginRun();
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate });
    portRef.current = port;
    setIsConnected(true);
    beginRun();
    void readLoop();
  } catch (error) {
    console.error(error);
    onTransportChange?.('error');
  }
};

const togglePause = (paused) => {
  isPausedRef.current = paused;
  if (!clockRef.current) return;
  clockRef.current = paused
    ? pauseActiveRunClock(clockRef.current, performance.now())
    : resumeActiveRunClock(clockRef.current, performance.now());
  onTransportChange?.(paused ? 'paused' : 'live');
};
```

Add this effect next to the existing FPS interval:

```jsx
useEffect(() => {
  const timer = window.setInterval(() => {
    onActiveTimeChange?.(
      clockRef.current ? elapsedActiveMs(clockRef.current, performance.now()) : 0,
    );
  }, 250);
  return () => window.clearInterval(timer);
}, [onActiveTimeChange]);
```

Use this reset implementation. It pauses the still-open reader so a new RUN can reuse the authorized port without mixing evidence:

```jsx
const resetData = async () => {
  isPausedRef.current = true;
  pipelineRef.current = createRealtimePipeline();
  clockRef.current = null;
  frameCountRef.current = 0;
  setInvalidFrameCount(0);
  setLatestSignal(null);
  setChartError(null);
  onActiveTimeChange?.(0);
  onTransportChange?.('ready');
  await Plotly.update(
    'react-spad-plot',
    { y: [new Array(numBins).fill(0)] },
    { 'yaxis.range': [0, 100] },
    [0],
  ).catch(() => setChartError('Signal chart unavailable'));
};
```

- [ ] **Step 5: Add accessible state to histogram controls**

Add `aria-pressed={view === 'raw'}` and `aria-pressed={view === 'norm'}` to the two view buttons. Replace the footer value with:

```jsx
<span>{latestSignal === null ? '--' : latestSignal.toFixed(2)}</span>
<span>Invalid frames: {invalidFrameCount}</span>
{chartError ? <span role="status">{chartError}</span> : null}
```

Remove the hard-coded `35.4k sp/s` from `App.tsx`; the histogram metadata bar's measured `FPS: {fps}` remains the live rate.

- [ ] **Step 6: Run the integration and utility tests**

```bash
npm test -- src/app/components/SpadHistogram.test.jsx src/app/utils
```

Expected: all focused tests pass; positive replay continues to emit later record-high bounds.

- [ ] **Step 7: Commit Web Serial integration**

```bash
git add src/app/components/SpadHistogram.jsx src/app/components/SpadHistogram.test.jsx
git commit -m "feat: keep SPAD detection live after positivity"
```

### Task 9: Render explicit assay states, frozen TTP, and corrected charts

**Files:**
- Create: `src/app/components/DetectionResultPanel.tsx`
- Create: `src/app/components/DetectionResultPanel.test.tsx`
- Create: `src/app/App.test.tsx`
- Modify: `src/app/components/ConcentrationTimeChart.jsx:21-180`
- Modify: `src/app/App.tsx:43-539`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write failing result-card tests**

Create `src/app/components/DetectionResultPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DetectionResultPanel from './DetectionResultPanel';

describe('DetectionResultPanel', () => {
  it('is neutral before a run', () => {
    render(<DetectionResultPanel result="neutral" lowerBound={null} blockCount={0} timeToPositive={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('shows negative and evidence progress before the first bound', () => {
    render(<DetectionResultPanel result="negative" lowerBound={null} blockCount={7} timeToPositive={null} />);
    expect(screen.getByText('NEGATIVE')).toBeInTheDocument();
    expect(screen.getByText('7 / 10 blocks')).toBeInTheDocument();
  });

  it('keeps a frozen positive time while rendering a newer bound', () => {
    const { rerender } = render(
      <DetectionResultPanel result="positive" lowerBound={31} blockCount={12} timeToPositive={24} />,
    );
    rerender(<DetectionResultPanel result="positive" lowerBound={35} blockCount={13} timeToPositive={24} />);
    expect(screen.getByText('35.00')).toBeInTheDocument();
    expect(screen.getByText('Time to positive: 00:24')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the result-card tests and verify RED**

```bash
npm test -- src/app/components/DetectionResultPanel.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Create the result card**

Implement `DetectionResultPanel.tsx` with this public contract:

```tsx
type Props = {
  result: 'neutral' | 'negative' | 'positive';
  lowerBound: number | null;
  blockCount: number;
  timeToPositive: number | null;
};

export default function DetectionResultPanel({
  result,
  lowerBound,
  blockCount,
  timeToPositive,
}: Props) {
  const label = result === 'neutral' ? '—' : result.toUpperCase();
  const stateColor = result === 'positive'
    ? '#00ffcc'
    : result === 'negative'
      ? '#ff8c42'
      : '#8fa1b5';
  const stateBackground = result === 'positive' ? '#0e1a14' : '#1a1114';
  return (
    <section
      aria-labelledby="detection-result-title"
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ background: '#111720', border: '1px solid #1e2a38' }}
    >
      <header className="border-b px-3 py-2" style={{ borderColor: '#1e2a38' }}>
        <h2 id="detection-result-title" className="text-xs font-semibold text-[#e2eaf4]">
          Detection Result
        </h2>
      </header>
      <div
        aria-live="polite"
        role="status"
        className="flex flex-1 flex-col items-center justify-center px-4 text-center"
        style={{ background: stateBackground }}
      >
        <strong className="text-sm tracking-wide" style={{ color: stateColor }}>{label}</strong>
        <p className="mt-2 font-mono leading-none">
          <span className="text-4xl font-bold" style={{ color: stateColor }}>
            {lowerBound === null ? '--' : lowerBound.toFixed(2)}
          </span>{' '}
          <span className="text-sm text-[#8fa1b5]">ug/mL</span>
        </p>
        <p className="mt-2 text-xs text-[#8fa1b5]">Lower-bound concentration</p>
        {lowerBound === null && result !== 'neutral' ? (
          <p className="mt-1 font-mono text-xs text-[#8fa1b5]">{blockCount} / 10 blocks</p>
        ) : null}
        {result === 'positive' && timeToPositive !== null ? (
          <p className="mt-2 font-mono text-xs text-[#8fa1b5]">
            Time to positive: {formatDuration(timeToPositive)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run the result-card tests and verify GREEN**

```bash
npm test -- src/app/components/DetectionResultPanel.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Write a failing dashboard integration test**

Create `src/app/App.test.tsx`:

```tsx
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

const histogram = vi.hoisted(() => ({
  props: null as any,
  startConnection: vi.fn(),
  togglePause: vi.fn(),
  resetData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./components/SpadHistogram', async () => {
  const ReactModule = await import('react');
  return {
    default: ReactModule.forwardRef((props: any, ref) => {
      histogram.props = props;
      ReactModule.useImperativeHandle(ref, () => ({
        startConnection: histogram.startConnection,
        togglePause: histogram.togglePause,
        resetData: histogram.resetData,
      }));
      return <div data-testid="histogram" />;
    }),
  };
});

vi.mock('./components/ConcentrationTimeChart', () => ({
  default: () => <div data-testid="lower-bound-chart" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: {},
  });
});

it('starts negative and preserves TTP while later records update', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByText('—')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'RUN' }));
  expect(screen.getByText('NEGATIVE')).toBeInTheDocument();
  expect(histogram.startConnection).toHaveBeenCalledOnce();

  act(() => histogram.props.onDetectionUpdate({
    block: { timeMs: 20_000, concentration: 50, frameCount: 8 },
    blockCount: 10,
    lowerBoundUpdate: { time: 20, concentration: 31 },
    positiveJustLatched: true,
    isPositive: true,
    timeToPositiveMs: 20_000,
  }));
  expect(screen.getByText('POSITIVE')).toBeInTheDocument();
  expect(screen.getByText('Time to positive: 00:20')).toBeInTheDocument();

  act(() => histogram.props.onDetectionUpdate({
    block: { timeMs: 30_000, concentration: 60, frameCount: 8 },
    blockCount: 15,
    lowerBoundUpdate: { time: 30, concentration: 35 },
    positiveJustLatched: false,
    isPositive: true,
    timeToPositiveMs: 20_000,
  }));
  expect(screen.getByText('35.00')).toBeInTheDocument();
  expect(screen.getByText('Time to positive: 00:20')).toBeInTheDocument();
});

it('disables RUN when Web Serial is unavailable', () => {
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: undefined,
  });
  render(<App />);
  expect(screen.getByRole('button', { name: 'RUN' })).toBeDisabled();
  expect(screen.getByText(/Web Serial requires Chrome or Edge/i)).toBeInTheDocument();
});
```

- [ ] **Step 6: Run the dashboard test and verify RED**

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because App does not yet expose neutral/transport states or preserve a latched TTP while accepting later updates.

- [ ] **Step 7: Replace App's timer and result state with event-driven state**

In `App.tsx`, replace the `elapsed`, `hasStarted`, `isPositive`, and `timeToPositive` state with:

```tsx
const [transport, setTransport] = useState<'ready' | 'connecting' | 'live' | 'paused' | 'error'>('ready');
const [result, setResult] = useState<'neutral' | 'negative' | 'positive'>('neutral');
const [activeElapsedMs, setActiveElapsedMs] = useState(0);
const [blockCount, setBlockCount] = useState(0);
const [timeToPositive, setTimeToPositive] = useState<number | null>(null);
const [lowerBoundData, setLowerBoundData] = useState<ConcentrationPoint[]>([]);
const [blockMeanData, setBlockMeanData] = useState<ConcentrationPoint[]>([]);
const serialSupported = typeof navigator !== 'undefined' && navigator.serial !== undefined;
```

Use this event handler:

```tsx
const handleDetectionUpdate = (event: any) => {
  setBlockCount(event.blockCount);
  setBlockMeanData((points) => [
    ...points,
    { time: event.block.timeMs / 1_000, concentration: event.block.concentration },
  ]);
  if (event.lowerBoundUpdate) {
    setLowerBoundData((points) => [...points, event.lowerBoundUpdate]);
  }
  if (event.positiveJustLatched) {
    setResult('positive');
    setTimeToPositive(event.timeToPositiveMs / 1_000);
  }
};
```

On first RUN click, set `result` to `negative`, reset all run data, and call `startConnection()`. Pause/Resume calls `togglePause()`. Reset awaits `resetData()` and returns every state value to its initializer.

Use these exact control rules:

```tsx
const handleRunPauseClick = () => {
  if (result === 'neutral') {
    setResult('negative');
    setActiveElapsedMs(0);
    setBlockCount(0);
    setTimeToPositive(null);
    setLowerBoundData([]);
    setBlockMeanData([]);
    void spadRef.current?.startConnection();
    return;
  }
  const shouldPause = transport === 'live';
  spadRef.current?.togglePause(shouldPause);
};

const handleResetClick = async () => {
  await spadRef.current?.resetData();
  setTransport('ready');
  setResult('neutral');
  setActiveElapsedMs(0);
  setBlockCount(0);
  setTimeToPositive(null);
  setLowerBoundData([]);
  setBlockMeanData([]);
};
```

Pass these props to `SpadHistogram`:

```tsx
<SpadHistogram
  ref={spadRef}
  onDetectionUpdate={handleDetectionUpdate}
  onTransportChange={setTransport}
  onActiveTimeChange={setActiveElapsedMs}
/>
```

Disable RUN when `!serialSupported`, disable it while `transport === 'connecting'`, and render:

```tsx
{!serialSupported ? (
  <p role="alert" className="text-xs text-[#ffb37a]">
    Web Serial requires Chrome or Edge.
  </p>
) : null}
```

Use the control labels `RUN`, `Pause`, and `Resume` for neutral, live, and paused states respectively. Render `CONNECTING`, `LIVE`, `PAUSED`, or `ERROR` from `transport`, independent of the POSITIVE/NEGATIVE result.

Render the active run clock with `formatDuration(activeElapsedMs / 1_000)`. Give the transport label `role="status"` and `aria-live="polite"` so connection changes are announced.

Compute complete 30-second block-mean windows with:

```tsx
const thirtySecondAverages = useMemo(() => {
  const completedWindowEnd = Math.floor(activeElapsedMs / 30_000) * 30;
  const averages: ThirtySecondAveragePoint[] = [];
  for (let windowEnd = 30; windowEnd <= completedWindowEnd; windowEnd += 30) {
    const points = blockMeanData.filter(
      (point) => point.time > windowEnd - 30 && point.time <= windowEnd,
    );
    if (points.length > 0) {
      averages.push({
        time: windowEnd,
        concentration: points.reduce((sum, point) => sum + point.concentration, 0) / points.length,
      });
    }
  }
  return averages;
}, [activeElapsedMs, blockMeanData]);
```

Import `useMemo`, feed `lowerBoundData` to `ConcentrationTimeChart`, and feed `thirtySecondAverages` to the right-hand average panel.

Replace the inline final result panel with:

```tsx
<DetectionResultPanel
  result={result}
  lowerBound={lowerBoundData.at(-1)?.concentration ?? null}
  blockCount={blockCount}
  timeToPositive={timeToPositive}
/>
```

- [ ] **Step 8: Correct both charts and responsive state**

Change `ConcentrationTimeChart` to label its series `Sequential lower bound (ug/mL)` and add:

```jsx
import { DETECTION_THRESHOLD_UG_ML } from '../utils/config';

const thresholdShape = {
  type: 'line',
  xref: 'paper',
  x0: 0,
  x1: 1,
  y0: DETECTION_THRESHOLD_UG_ML,
  y1: DETECTION_THRESHOLD_UG_ML,
  line: { color: C.yellow, width: 1.5, dash: 'dash' },
};
```

Pass `shapes: [thresholdShape]` in Plotly layout and update calls. Rename the left chart `Lower Bound vs Time` and the existing right chart `30 s Block-Mean Average`.

Replace the fixed inline grid columns with a CSS class:

```tsx
<main className="dashboard-grid flex-1 gap-3 p-3 min-h-0">
```

Add to `src/styles/index.css`:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
}

button:focus-visible {
  outline: 2px solid #00ffcc;
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
    overflow-y: auto;
  }
}
```

In the color constants in `App.tsx`, `SpadHistogram.jsx`, and `ConcentrationTimeChart.jsx`, change muted text from `#6b7a8d` to `#8fa1b5` so 9-12 px metadata clears normal-text contrast on the charcoal panels.

- [ ] **Step 9: Run component and full tests**

```bash
npm test -- src/app/components/DetectionResultPanel.test.tsx src/app/components/SpadHistogram.test.jsx src/app/App.test.tsx
npm test
```

Expected: all tests pass with no warnings or unhandled rejections.

- [ ] **Step 10: Commit the UI state and charts**

```bash
git add src/app/components/DetectionResultPanel.tsx src/app/components/DetectionResultPanel.test.tsx src/app/components/ConcentrationTimeChart.jsx src/app/App.tsx src/app/App.test.tsx src/styles/index.css
git commit -m "feat: show live lower-bound detection state"
```

### Task 10: Add deterministic browser replay and documentation

**Files:**
- Create: `src/app/utils/replaySource.js`
- Create: `src/app/utils/replaySource.test.js`
- Modify: `src/app/components/SpadHistogram.jsx`
- Modify: `src/app/App.tsx`
- Modify: `README.md:29-43`
- Test: `src/app/utils/realtimeDetectionPipeline.test.js`

- [ ] **Step 1: Write a failing replay-source test**

Create `src/app/utils/replaySource.test.js`:

```js
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
```

- [ ] **Step 2: Run the replay test and verify RED**

```bash
npm test -- src/app/utils/replaySource.test.js
```

Expected: FAIL because `replaySource.js` is missing.

- [ ] **Step 3: Add a query-gated replay source**

Create `src/app/utils/replaySource.js`:

```js
import { payloadForConcentration } from './spadPayloadEncoder';

const REPLAY_CONCENTRATIONS = [
  49, 50, 51, 50, 49, 51, 50, 49, 51, 50,
  ...Array(14).fill(70),
];

export function replayEnabled(search = window.location.search) {
  return new URLSearchParams(search).get('replay') === 'positive';
}

export function startPositiveReplay(onPayload, onComplete) {
  let index = 0;
  const timer = window.setInterval(() => {
    onPayload(payloadForConcentration(REPLAY_CONCENTRATIONS[index]));
    index += 1;
    if (index >= REPLAY_CONCENTRATIONS.length) {
      window.clearInterval(timer);
      onComplete?.();
    }
  }, 2_000);
  return () => window.clearInterval(timer);
}
```

- [ ] **Step 4: Activate replay only through `?replay=positive`**

Import `replayEnabled` and `startPositiveReplay`, add `const replayStopRef = useRef(null)`, and branch in `startConnection` before `navigator.serial.requestPort()`:

```jsx
if (replayEnabled()) {
  pipelineRef.current = createRealtimePipeline();
  clockRef.current = createActiveRunClock(performance.now());
  isPausedRef.current = false;
  setIsConnected(true);
  onTransportChange?.('live');
  replayStopRef.current = startPositiveReplay(
    (payload) => updatePlotWithFrame(payload),
    () => {},
  );
  return;
}
```

At the start of `resetData`, call:

```jsx
replayStopRef.current?.();
replayStopRef.current = null;
```

In `App.tsx`, import `replayEnabled` and replace the support check with:

```tsx
const serialSupported = (
  typeof navigator !== 'undefined' && navigator.serial !== undefined
) || replayEnabled();
```

- [ ] **Step 5: Document threshold, confidence meaning, and replay**

Add to `README.md`:

```markdown
## Detection rule

The current project-defined positive threshold is **30 ug/mL**. It is an
operational comparator for this prototype, not a universal qPCR LoD. Live frame
predictions are averaged into non-overlapping 2 s blocks. Beginning at 10 valid
blocks, the dashboard uses a one-sided alpha-spending t bound and only publishes
strict record-high lower bounds. POSITIVE latches at the first valid lower bound
above 30 ug/mL; time to positive freezes, while detection and higher-bound
updates continue.

The lower bound includes live measurement variability conditional on the saved
linear calibration. It does not include calibration-coefficient uncertainty.

## Replay verification

Run `npm run dev`, then open `http://localhost:5173/?replay=positive`. RUN uses a
deterministic positive payload sequence instead of opening Web Serial. The replay
must latch POSITIVE and continue increasing the lower-bound number afterward.
```

- [ ] **Step 6: Run replay-related tests and commit**

```bash
npm test -- src/app/utils/replaySource.test.js src/app/utils/realtimeDetectionPipeline.test.js src/app/components/SpadHistogram.test.jsx src/app/App.test.tsx
git add src/app/utils/replaySource.js src/app/utils/replaySource.test.js src/app/components/SpadHistogram.jsx src/app/App.tsx README.md
git commit -m "test: add deterministic positive replay"
```

Expected: focused tests pass; commit contains no real-hardware behavior changes outside the explicit replay branch.

### Task 11: Verify the complete implementation and refresh the tracked build

**Files:**
- Modify: `dist/index.html`
- Modify: `dist/assets/*`
- Review: every file listed above

- [ ] **Step 1: Run fresh full verification**

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, Vite exits 0, and `git diff --check` prints nothing.

- [ ] **Step 2: Run the deterministic browser replay**

Run:

```bash
npm run dev
```

Open `http://localhost:5173/?replay=positive`, click RUN, and verify:

1. The result changes from neutral to NEGATIVE at `00:00`.
2. No concentration number appears before 10 blocks.
3. The first valid lower bound above `30 ug/mL` latches POSITIVE.
4. Time to positive remains unchanged afterward.
5. Detection remains LIVE and at least one later record-high lower bound updates.
6. Pause freezes the active run clock and Resume continues it.
7. Reset clears result, timers, evidence, and both charts.

- [ ] **Step 3: Inspect the production build payload**

```bash
rg -n "30 ug/mL|Lower-bound concentration|Time to positive" dist
```

Expected: the generated bundle contains the new threshold/result strings and no longer serves the initial simulated result UI.

- [ ] **Step 4: Review the diff against the acceptance criteria**

```bash
git status --short
git diff --stat 0a26bd26..HEAD
git log --oneline 0a26bd26..HEAD
```

Expected: only planned source, test, documentation, lockfile, and generated-build changes are present. Record real-hardware verification as unavailable unless a SPAD device was actually connected.

- [ ] **Step 5: Commit the verified build output**

```bash
git add dist
git commit -m "build: refresh sequential detection dashboard"
```

- [ ] **Step 6: Run the final verification after the last commit**

```bash
npm test
npm run build
git status --short
```

Expected: all tests pass, Vite exits 0, and the worktree is clean.
