# SPAD-Based Kinetic Fluorescence Dashboard

Real-time dashboard for the CRISPR pathogen detector. It reads the raw photon-counting
histogram from the SPAD hardware over USB (Web Serial), runs it through the regression
model, and reports a POSITIVE/NEGATIVE call once the result is statistically confident.

## Prerequisites

- **Node.js** 18+ and npm
- **Google Chrome or Microsoft Edge** — the hardware connection uses the [Web Serial
  API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API), which Firefox and
  Safari do not support
- The SPAD board connected over USB (only needed to test live data; the UI itself runs
  without it)

## Running it locally

```bash
git clone git@github.com:xandrabai/SPAD-Based-Kinetic-Fluorescence-Decision-System-for-CRISPR-Diagnostics.git
cd SPAD-Based-Kinetic-Fluorescence-Decision-System-for-CRISPR-Diagnostics
npm install
npm run dev
```

This starts a local dev server (Vite will print the URL, usually `http://localhost:5173`).
Open it in Chrome or Edge. Click **RUN** to open the serial port picker and connect to the
board.

## Detection rule

The current project-defined positive threshold is **30 ug/mL**. It is an
operational comparator for this prototype, not a universal qPCR limit of detection.
Live frame predictions are averaged into non-overlapping 2 s active-time blocks.
Beginning at 10 valid blocks, the dashboard uses a one-sided alpha-spending t bound
and only publishes strict record-high lower bounds. POSITIVE latches at the first
valid lower bound above 30 ug/mL; time to positive freezes, while detection and
higher-bound updates continue.

The lower bound includes live measurement variability conditional on the saved
linear calibration. It does not include uncertainty in the fitted calibration
coefficients.

## Replay verification

Run `npm run dev`, then open `http://localhost:5173/?replay=positive`. RUN uses a
deterministic positive payload sequence instead of opening Web Serial. The replay
must latch POSITIVE and continue increasing the lower-bound number afterward.

## Making changes

- `src/app/App.tsx` — layout, header, and the two result/average panels
- `src/app/components/SpadHistogram.jsx` — serial/replay transport and raw histogram plot
- `src/app/components/ConcentrationTimeChart.jsx` — published lower-bound plot
- `src/app/utils/concentrationPredictor.js` — the regression model (don't touch unless the
  calibration itself is changing)
- `src/app/utils/config.js` — threshold, block duration, minimum blocks, and run alpha
- `src/app/utils/predictionConfidence.js` — alpha-spent sequential confidence calculation

Before pushing, run the tests and check that the production build succeeds:

```bash
npm test
npm run build
```

Then commit and push as usual:

```bash
git add <files>
git commit -m "describe your change"
git push origin main
```

## Updating the live website

The project is deployed on **Vercel** (project: `crispr_diagnostics`). The easiest way to
deploy is manually from the command line:

```bash
npm install -g vercel   # one-time
vercel login            # one-time, use the account with access to the project
vercel --prod
```

Alternatively, if the GitHub repo is connected to Vercel, pushing to `main` also triggers a
production deployment automatically — no extra steps needed. You can check deployment status
at [vercel.com](https://vercel.com/dashboard).

## Notes

- Web Serial requires a secure context (`localhost` is fine for dev; the deployed site is
  HTTPS, so that's fine too) — it will not work over plain HTTP.
- `node_modules/` and `dist/` are currently committed to this repo. You don't need to do
  anything special about that, but don't hand-edit files inside them.
