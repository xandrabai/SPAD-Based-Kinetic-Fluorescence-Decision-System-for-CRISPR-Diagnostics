import React, { useEffect, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { TrendingUp } from 'lucide-react';
import { DETECTION_THRESHOLD_UG_ML } from '../utils/config';

const C = {
  panel: '#111720',
  border: '#1e2a38',
  blue: '#4f9eff',
  blueDim: '#4f9eff18',
  yellow: '#f5c518',
  text: '#e2eaf4',
  muted: '#8fa1b5',
};

const thresholdShape = {
  type: 'line',
  xref: 'paper',
  x0: 0,
  x1: 1,
  y0: DETECTION_THRESHOLD_UG_ML,
  y1: DETECTION_THRESHOLD_UG_ML,
  line: { color: C.yellow, width: 1.5, dash: 'dash' },
};

const ConcentrationTimeChart = ({ concentrationData = [] }) => {
  const [currentLowerBound, setCurrentLowerBound] = useState(null);
  const maxDataPoints = 100;

  useEffect(() => {
    const trace = {
      x: [],
      y: [],
      name: 'Sequential lower bound (ug/mL)',
      mode: 'lines+markers',
      type: 'scattergl',
      line: { color: C.blue, width: 2.5, shape: 'linear' },
      marker: {
        color: C.blue,
        size: 5,
        line: { color: C.blueDim, width: 1 },
      },
      fill: 'tozeroy',
      fillcolor: C.blueDim,
    };
    const layout = {
      title: null,
      xaxis: {
        title: { text: 'Active time (s)', font: { size: 10, color: C.muted } },
        gridcolor: C.border,
        color: C.muted,
        showline: false,
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Lower bound (ug/mL)', font: { size: 10, color: C.muted } },
        gridcolor: C.border,
        color: C.muted,
        showline: false,
        zeroline: false,
        range: [0, 40],
      },
      shapes: [thresholdShape],
      annotations: [{
        xref: 'paper',
        x: 1,
        y: DETECTION_THRESHOLD_UG_ML,
        text: '30 ug/mL threshold',
        showarrow: false,
        xanchor: 'right',
        yanchor: 'bottom',
        font: { size: 9, color: C.yellow },
      }],
      plot_bgcolor: C.panel,
      paper_bgcolor: C.panel,
      font: { family: 'JetBrains Mono, monospace', color: C.muted, size: 9 },
      margin: { t: 12, r: 20, b: 40, l: 55 },
      showlegend: false,
    };

    Promise.resolve(Plotly.newPlot(
      'concentration-time-plot',
      [trace],
      layout,
      { responsive: true, displayModeBar: false },
    )).catch(() => {});

    return () => Plotly.purge('concentration-time-plot');
  }, []);

  useEffect(() => {
    if (concentrationData.length === 0) {
      setCurrentLowerBound(null);
      Promise.resolve(Plotly.update(
        'concentration-time-plot',
        { x: [[]], y: [[]] },
        { 'yaxis.range': [0, 40], shapes: [thresholdShape] },
        [0],
      )).catch(() => {});
      return;
    }

    const visibleData = concentrationData.slice(-maxDataPoints);
    const latest = visibleData.at(-1).concentration;
    setCurrentLowerBound(latest);
    const yMax = Math.max(40, Math.ceil(latest * 1.2));
    Promise.resolve(Plotly.update(
      'concentration-time-plot',
      {
        x: [visibleData.map(({ time }) => time)],
        y: [visibleData.map(({ concentration }) => concentration)],
      },
      { 'yaxis.range': [0, yMax], shapes: [thresholdShape] },
      [0],
    )).catch(() => {});
  }, [concentrationData]);

  return (
    <section
      aria-labelledby="lower-bound-chart-title"
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <header className="flex shrink-0 items-center justify-between border-b px-3 py-2" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2">
          <TrendingUp size={13} aria-hidden="true" style={{ color: C.blue }} />
          <h2 id="lower-bound-chart-title" className="text-xs font-semibold tracking-wide" style={{ color: C.text }}>
            Lower Bound vs Time
          </h2>
        </div>
        <span className="font-mono text-[10px]" style={{ color: C.muted }}>Strict record highs only</span>
      </header>

      <div className="flex shrink-0 items-center gap-3 border-b px-3 py-1.5 font-mono text-[10px]" style={{ borderColor: C.border, color: C.muted }}>
        <span>Sequential one-sided t bound</span>
        <span className="ml-auto">Published points: {concentrationData.length}</span>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-1 pt-3">
        <div id="concentration-time-plot" style={{ width: '100%', height: '100%' }} />
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t px-3 py-2" style={{ borderColor: C.border }}>
        <span className="text-[10px]" style={{ color: C.muted }}>Current lower bound:</span>
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] font-semibold" style={{ color: C.text }}>
          {currentLowerBound === null ? '--' : currentLowerBound.toFixed(2)} ug/mL
        </span>
      </footer>
    </section>
  );
};

export default ConcentrationTimeChart;
