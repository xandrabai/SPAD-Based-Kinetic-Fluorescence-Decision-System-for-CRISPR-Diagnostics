# Concentration Chart and Confidence Interval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plot every valid per-frame concentration against active time and display the record lower bound, midpoint, and upper bound in the detection result panel.

**Architecture:** Extend the realtime pipeline result with a timestamped point estimate for each valid frame, while leaving completed-block detection unchanged. Extend valid sequential evidence with a symmetric upper bound, publish the complete interval only when the lower bound sets a record, and keep positivity tied to the lower bound. App state routes point estimates to the lower-left chart and record intervals to the upper-right panel.

**Tech Stack:** React, TypeScript/JavaScript, Plotly, Vitest, Testing Library, Vite

---

### Task 1: Emit per-frame point estimates

**Files:**
- Modify: `src/app/utils/realtimeDetectionPipeline.js`
- Modify: `src/app/utils/realtimeDetectionPipeline.test.js`
- Modify: `src/app/components/SpadHistogram.jsx`
- Modify: `src/app/components/SpadHistogram.test.jsx`

- [ ] **Step 1: Write failing pipeline and component tests**

Assert that a valid payload returns:

```js
expect(transition.concentrationPoint).toEqual({
  time: 1.25,
  concentration: transition.prediction.concentration,
});
```

Assert that `SpadHistogram` calls a new `onConcentrationPoint` callback for valid frames without changing `onDetectionUpdate` completed-block events.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/app/utils/realtimeDetectionPipeline.test.js src/app/components/SpadHistogram.test.jsx
```

Expected: FAIL because `concentrationPoint` and `onConcentrationPoint` do not exist.

- [ ] **Step 3: Implement the minimal point-estimate path**

For valid predictions, return:

```js
concentrationPoint: {
  time: activeElapsedMs / 1_000,
  concentration: prediction.concentration,
},
```

Return `concentrationPoint: null` for malformed and out-of-range frames. Add `onConcentrationPoint` to `SpadHistogram` props and call it when the transition contains a point.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the focused command from Step 2. Expected: all focused tests pass.

### Task 2: Publish the record confidence interval

**Files:**
- Modify: `src/app/utils/predictionConfidence.js`
- Modify: `src/app/utils/predictionConfidence.test.js`
- Modify: `src/app/utils/detectionEngine.js`
- Modify: `src/app/utils/detectionEngine.test.js`

- [ ] **Step 1: Write failing statistical and record-publication tests**

Assert for valid evidence:

```js
expect(evidence.upperBound).toBeCloseTo(
  evidence.mean + (evidence.mean - evidence.lowerBound),
);
```

Assert a record event publishes:

```js
expect(event.intervalUpdate).toEqual({
  time: 10,
  lowerBound: 29,
  midpoint: 30,
  upperBound: 31,
});
```

Assert a later non-record returns `intervalUpdate: null`, and positivity/time-to-positive expectations remain unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- src/app/utils/predictionConfidence.test.js src/app/utils/detectionEngine.test.js
```

Expected: FAIL because `upperBound` and `intervalUpdate` do not exist.

- [ ] **Step 3: Implement symmetric bounds and record publication**

Add:

```js
const upperBound = avg + criticalT * standardError;
```

Include `upperBound` in valid evidence. When `isRecord`, publish:

```js
intervalUpdate: {
  time: block.timeMs / 1_000,
  lowerBound: evidence.lowerBound,
  midpoint: (evidence.lowerBound + evidence.upperBound) / 2,
  upperBound: evidence.upperBound,
},
```

Keep `crosses`, `positiveJustLatched`, and `timeToPositiveMs` unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all focused tests pass.

### Task 3: Update the two UI panels and app routing

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/components/ConcentrationTimeChart.jsx`
- Modify: `src/app/components/ConcentrationTimeChart.test.jsx`
- Modify: `src/app/components/DetectionResultPanel.tsx`
- Modify: `src/app/components/DetectionResultPanel.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Test chart text:

```js
expect(screen.getByText('Concentration vs Time')).toBeInTheDocument();
expect(screen.getByText('Current concentration:')).toBeInTheDocument();
expect(screen.getByText('31.25 ug/mL')).toBeInTheDocument();
```

Test Plotly receives every supplied point estimate. Test the result panel renders `Lower bound`, `Midpoint`, and `Upper bound` with two-decimal values, while preserving NEGATIVE/POSITIVE and time-to-positive.

- [ ] **Step 2: Run focused UI tests and verify RED**

```bash
npm test -- src/app/App.test.tsx src/app/components/ConcentrationTimeChart.test.jsx src/app/components/DetectionResultPanel.test.tsx
```

Expected: FAIL on the new chart labels, callback routing, and interval values.

- [ ] **Step 3: Implement app state and UI changes**

In `App.tsx`, maintain:

```ts
const [concentrationData, setConcentrationData] = useState<ConcentrationPoint[]>([]);
const [publishedInterval, setPublishedInterval] = useState<ConfidenceInterval | null>(null);
```

Route `onConcentrationPoint` into `concentrationData`, route record `intervalUpdate` into `publishedInterval`, reset both on Run and Reset, pass concentration data to the chart, and pass the interval to the result panel.

Change only the chart semantics and labels: `Concentration vs Time`, `Concentration (ug/mL)`, `Live regression estimates`, point count, and `Current concentration`. Remove the threshold line because it applies to the lower confidence bound, not raw estimates.

Render the three interval values compactly in `DetectionResultPanel`, using `--` before the first published record. Do not alter result colors, threshold text, block progress, or time-to-positive.

- [ ] **Step 4: Run focused UI tests and verify GREEN**

Run the command from Step 2. Expected: all focused UI tests pass.

- [ ] **Step 5: Run full verification**

```bash
npm test
GITHUB_ACTIONS=true npx vite build --outDir /tmp/spad-pages-confidence-interval
```

Expected: all tests pass and Vite exits successfully.

- [ ] **Step 6: Review exact scope and publish**

Stage only the plan, source, and tests listed above; preserve unrelated `node_modules` changes. Commit the implementation, push the feature branch and fork `main` atomically, then verify the GitHub Pages workflow and deployed asset hash.
