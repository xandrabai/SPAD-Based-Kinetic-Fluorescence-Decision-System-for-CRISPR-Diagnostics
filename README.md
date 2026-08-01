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

## Making changes

- `src/app/App.tsx` — layout, header, and the two result/average panels
- `src/app/components/SpadHistogram.jsx` — serial connection, raw histogram plot, and the
  real-time prediction/confidence logic
- `src/app/components/ConcentrationTimeChart.jsx` — concentration-vs-time plot
- `src/app/utils/concentrationPredictor.js` — the regression model (don't touch unless the
  calibration itself is changing)
- `src/app/utils/config.js` — tunable thresholds (qPCR threshold, p-value, confidence level,
  min sample counts) — change values here rather than hard-coding them elsewhere
- `src/app/utils/predictionConfidence.js` — the statistical significance test

Before pushing, sanity-check your change builds:

```bash
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
