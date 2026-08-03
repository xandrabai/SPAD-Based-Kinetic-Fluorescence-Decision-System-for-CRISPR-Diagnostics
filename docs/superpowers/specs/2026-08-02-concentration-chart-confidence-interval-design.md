# Concentration Chart and Confidence Interval Design

## Scope

Change only the lower-left concentration chart data and labels, plus the upper-right concentration summary. Serial parsing, regression calibration, confidence gating, the 30 ug/mL threshold, positivity latching, time-to-positive, and all other panels remain unchanged.

## Lower-left chart

- Plot every valid per-frame regression concentration against active run time.
- Keep at most the latest 100 displayed points.
- Title the panel `Concentration vs Time`.
- Label the axes `Active time (s)` and `Concentration (ug/mL)`.
- Show the latest plotted point as `Current concentration`.
- Do not use confidence lower-bound record points as this chart's data source.

## Upper-right result panel

- Continue publishing statistics only when a new record-high lower confidence bound is established.
- Publish the lower bound, interval midpoint, and upper bound together from the same statistical look.
- The midpoint is `(lowerBound + upperBound) / 2`, equivalent to the sample mean for this symmetric t interval.
- Before the first publishable interval, display placeholders and retain the existing block progress message.
- POSITIVE remains determined only by the existing sequential significance rule and lower bound greater than 30 ug/mL.
- After positivity, acquisition and record-high interval updates continue while time-to-positive remains latched.

## Data flow

Each valid decoded frame emits its regression point estimate and active timestamp to the application for the concentration chart. Completed aggregation blocks continue through the sequential confidence evaluator. The evaluator adds a symmetric upper bound using the same critical t value and standard error as the lower bound. When the lower bound sets a new record, the detection event publishes the complete interval to the result panel.

## Verification

- Unit-test the symmetric upper bound and midpoint relationship.
- Test that every valid regression prediction is emitted for the chart.
- Test that interval publication remains record-only.
- Test the updated chart labels, plotted values, and current concentration.
- Test all three upper-right values and unchanged detection status/time-to-positive behavior.
- Run the full test suite and a GitHub Pages production build.
