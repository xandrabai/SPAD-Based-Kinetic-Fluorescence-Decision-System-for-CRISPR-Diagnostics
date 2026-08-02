# Real-Time Positive Detection Design

## Summary

The dashboard will use `30 ug/mL` as this project's operational positive threshold. The live SPAD signal will continue to be converted to concentration in the browser, but statistical decisions will be based on non-overlapping two-second block means instead of every raw frame. The UI will publish only strict new-high lower confidence bounds, latch POSITIVE at the first valid threshold crossing, record time to positive once, and continue detecting and publishing higher bounds afterward.

The `30 ug/mL` threshold is a project-defined comparator for this case. It is not presented as a universal qPCR limit of detection. qPCR limits are assay- and target-specific and are normally expressed as target quantity, such as copies per reaction or copies per milliliter, rather than reporter-dye mass concentration. Relevant background is available in [MIQE 2.0](https://academic.oup.com/clinchem/article/71/6/634/8119148) and the [Thermo Fisher overview of standard and fast qPCR run times](https://www.thermofisher.com/us/en/home/life-science/pcr/real-time-pcr/real-time-pcr-learning-center/real-time-pcr-basics/benefits-fast-real-time-pcr.html).

## Goals

- Start each run at `00:00` and show NEGATIVE immediately after RUN is clicked.
- Predict concentration from valid real-time SPAD frames using the existing inverse calibration.
- Aggregate predictions into non-overlapping two-second blocks.
- Begin sequential inference after 10 valid blocks, approximately 20 seconds of active acquisition.
- Maintain an overall one-sided false-positive allowance of `alpha = 0.05` across repeated looks.
- Display the lower-bound concentration only when it establishes a strict new record.
- Latch POSITIVE when a statistically valid lower bound first exceeds `30 ug/mL`.
- Record time to positive exactly once while continuing acquisition and lower-bound updates.
- Keep NEGATIVE until the first positive crossing; never revert POSITIVE during a run.
- Reset every statistical, timing, and display value for a new run.

## Non-goals

- Claiming that `30 ug/mL` is a universal or clinically validated qPCR limit of detection.
- Converting a nucleic-acid qPCR LoD into reporter concentration without matched experimental data.
- Adding a server-side backend or Python service; the live path remains browser-side.
- Repairing the unrelated offline `predict_concentration.py` dependency chain.
- Estimating calibration-coefficient uncertainty without the original calibration residuals or covariance data.
- Producing a terminal statistically confirmed negative result. NEGATIVE means "positive evidence has not crossed the threshold yet."

## Existing System Constraints

- Web Serial acquisition, frame decoding, regression prediction, and confidence evaluation currently run inside `SpadHistogram.jsx`.
- Live predictions use a linear inverse calibration in `concentrationPredictor.js`, while the matching coefficients also exist in `model_equations.json`.
- The calibration range and UI are expressed in `ug/mL`; the existing threshold comment incorrectly says `nM`.
- The current implementation tests every accumulated frame repeatedly, which treats temporally adjacent frames as independent and inflates confidence under continuous monitoring.
- The current result is NEGATIVE before data exist, the header clock starts at `22:14`, and committed `dist/` does not contain the latest source behavior.

## Architecture

### Calibration source

`model_equations.json` will be the browser-visible source of truth for the selected linear model, signal-processing window, calibration range, and `ug/mL` unit. `concentrationPredictor.js` will consume that data rather than carrying a second hand-written coefficient copy.

Calibration uncertainty is not available in the bundle. The reported lower bound therefore covers measurement uncertainty in the cumulative block-mean predictions conditional on the current calibration coefficients. The UI and documentation must not describe it as a complete analytical or clinical confidence interval.

### Serial acquisition and block aggregation

`SpadHistogram.jsx` remains responsible for opening Web Serial, decoding complete frames, rendering the histogram, and feeding valid predictions into the detection engine.

A valid frame must:

- contain the complete expected histogram payload;
- produce a finite integrated signal and finite concentration; and
- produce a concentration within the calibration range, inclusive.

Invalid frames are ignored and do not advance statistical evidence. Valid frame predictions are assigned using active acquisition time to half-open blocks `[0 s, 2 s)`, `[2 s, 4 s)`, and so on. Each non-empty completed block emits one arithmetic mean. Paused time does not advance block boundaries or either assay timer.

### Pure detection engine

A pure detection engine will own:

- valid block means;
- the sequential look number;
- the current cumulative mean, standard error, nominal one-sided p-value, and adjusted lower bound;
- the greatest lower bound published so far;
- the latched positive state; and
- the immutable active acquisition time at first positivity.

The engine accepts a completed block mean and active elapsed time, then emits a state transition. It has no browser, Plotly, React, or serial dependencies, allowing deterministic unit tests.

### UI state

`App.tsx` renders engine and transport state. Transport state and assay result are separate:

- Before RUN: transport `READY`, result `-`, bound `-- ug/mL`, time `00:00`.
- Immediately after RUN: result `NEGATIVE`; transport progresses from `CONNECTING` to `LIVE`.
- Before 10 blocks: result remains NEGATIVE, bound remains `-- ug/mL`, and evidence progress shows `n / 10 blocks`.
- After inference begins: only strict new-high lower bounds update the large numeric result and lower-bound chart.
- At first crossing: result latches POSITIVE and time to positive is recorded.
- After crossing: transport remains LIVE, active run time continues, time to positive stays frozen, and higher lower bounds continue to update.
- Pause: active acquisition time and block accumulation stop; Resume continues the same run.
- Reset: all transport-independent run state, blocks, bounds, charts, timers, and positivity are cleared.

Canceling or failing the serial-port request moves transport to `ERROR`; it must not display `LIVE`. Browsers without Web Serial disable RUN and explain the requirement.

## Statistical Decision Rule

### Estimand and hypotheses

The estimand is the cumulative mean of the valid two-second block predictions observed during the active run.

- `H0`: cumulative mean concentration is at or below `30 ug/mL`.
- `H1`: cumulative mean concentration is above `30 ug/mL`.

The test is one-sided. Equality with `30 ug/mL` remains NEGATIVE; only a lower bound strictly greater than `30 ug/mL` can latch POSITIVE.

### Minimum evidence

No p-value, lower bound, or concentration number is published before 10 valid completed blocks. Empty two-second periods do not count as blocks.

### Alpha spending

Repeated ordinary `p < 0.05` checks would inflate the run-level false-positive probability. Let `j = 1, 2, ...` be the sequential look number beginning when the tenth valid block arrives. Allocate:

```text
alpha_j = 0.05 / (j * (j + 1))
```

Because the infinite sum of `1 / (j * (j + 1))` is 1, the total allocated alpha is at most 0.05. At each look with `n` block means:

1. Compute the cumulative mean, sample standard deviation, standard error, and degrees of freedom `n - 1`.
2. Compute the nominal one-sided t-test p-value for the threshold of `30 ug/mL`.
3. Compute `lowerBound = mean - tQuantile(1 - alpha_j, n - 1) * standardError`.
4. Treat the look as statistically positive only when `pValue < alpha_j` and `lowerBound > 30`.

The p-value and lower bound are not produced when variance is zero, values are non-finite, or fewer than 10 blocks exist. This is intentionally conservative. The validity of the t model depends on two-second block means being sufficiently independent and approximately normal; control-run autocorrelation should be evaluated before making clinical claims.

### Monotone publication and positivity

The calculated lower bound may rise or fall, but the displayed lower bound is monotone:

```text
publish only when lowerBound > previouslyPublishedLowerBound
```

Declining and equal calculated bounds are retained internally for audit metrics but do not change the large numeric display or lower-bound history chart.

The first statistically positive look records:

```text
isPositive = true
timeToPositive = activeElapsedTime
```

Both values are latched for the run. Subsequent blocks continue to be evaluated and may publish higher lower bounds, but cannot change `timeToPositive` or revert the result.

## UI Presentation

The existing charcoal, mint, blue, and monospaced laboratory-dashboard visual language remains.

- The result card label is `Lower-bound concentration`, not `Latest concentration`.
- The result card uses `aria-live` for result, bound, and time-to-positive changes.
- The lower-bound chart contains only published record-high bounds and includes a horizontal `30 ug/mL` reference line.
- The existing 30-second panel is fed by all valid two-second block means, not record-high bounds, and is labeled `30 s Block-Mean Average`.
- The header's run clock uses active acquisition time and begins at `00:00`.
- The POSITIVE card shows the frozen `Time to positive: MM:SS` while the run clock continues.
- Raw/Cleaned controls expose `aria-pressed`, interactive controls have visible focus, and muted text meets normal-text contrast requirements.
- The fixed desktop grid gains a single-column fallback for narrow screens.

## Error Handling

- Unsupported Web Serial: disable RUN and show the supported-browser requirement.
- Port picker canceled or open fails: transport becomes ERROR; the run does not become LIVE.
- Partial or malformed serial frame: discard without advancing evidence.
- Non-finite prediction: discard without advancing evidence.
- Out-of-calibration prediction: discard without advancing evidence and expose an invalid-frame count for diagnostics.
- Empty block: do not create a block observation.
- Zero block variance: do not manufacture `p = 0` or a perfectly certain bound.
- Plot initialization/update failure: preserve assay state and surface a non-blocking chart error.
- Reset: clear pending partial block state before the next run.

## Testing Strategy

Implementation follows red-green-refactor. Add a JavaScript unit/component test runner and write failing tests before production changes.

### Predictor and frame validation

- The JSON-backed linear inverse returns the expected concentration for a known signal.
- Calibration units are `ug/mL` everywhere.
- Complete recorded or generated frame fixtures produce the expected bins, signal, and prediction.
- Malformed, non-finite, and out-of-range inputs are rejected.

### Block aggregation

- Frames are grouped into the correct half-open two-second blocks.
- Exactly one mean is emitted per non-empty completed block.
- Paused time does not close or advance a block.
- Reset discards a partial block.

### Sequential detection

- No bound exists before 10 valid blocks.
- `alpha_j` follows `0.05 / (j * (j + 1))` and the total spending is bounded by 0.05.
- Zero variance produces no inferential update.
- Lower and equal calculated bounds do not publish.
- A strict new-high lower bound publishes once.
- A bound equal to 30 remains NEGATIVE.
- The first valid bound above 30 latches POSITIVE and one time-to-positive value.
- Later blocks continue updating the published bound while preserving POSITIVE and the original time to positive.
- Reset returns the engine to its initial state.

### UI integration

- Before RUN the result is neutral and the clock is `00:00`.
- RUN immediately shows NEGATIVE and CONNECTING.
- Successful port open shows LIVE; failure shows ERROR.
- Evidence progress is shown before the first bound.
- Published bounds update the result and chart; suppressed bounds do not.
- POSITIVE shows the frozen time to positive while the run clock and lower-bound updates continue.
- Pause freezes active time; Resume continues it.
- Reset clears the result, timers, evidence, and charts.

### Verification

Completion requires:

- the focused statistical and component tests passing;
- the full test suite passing;
- a successful production Vite build;
- a browser run using replayed serial frames that crosses the threshold and continues to publish higher bounds after positivity; and
- a clear note if real SPAD hardware was unavailable, rather than claiming hardware verification.

If this repository continues to track `dist/`, the verified production build output must be regenerated so it does not serve the stale simulated dashboard.

## Acceptance Criteria

1. `30 ug/mL` is the only configured positive threshold and is compared only with `ug/mL` predictions.
2. RUN starts a fresh NEGATIVE run at `00:00`.
3. No numeric lower bound appears before 10 valid two-second blocks.
4. Repeated inference uses the documented alpha-spending rule.
5. The large number changes only for strict new-high valid lower bounds.
6. The first valid lower bound above 30 latches POSITIVE and freezes time to positive.
7. Detection, the run clock, and new-high lower-bound updates continue after positivity.
8. POSITIVE and time to positive never revert or change during the run.
9. Pause/Resume preserves the run; Reset creates a clean run.
10. Tests, build, and replay verification provide fresh evidence for the behavior.
