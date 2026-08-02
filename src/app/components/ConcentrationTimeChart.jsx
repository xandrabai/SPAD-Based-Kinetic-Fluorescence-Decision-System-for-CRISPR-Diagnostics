import React, { useEffect, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { TrendingUp } from 'lucide-react';

const C = {
  panel: '#111720',
  border: '#1e2a38',
  blue: '#4f9eff',
  blueDim: '#4f9eff18',
  text: '#e2eaf4',
  muted: '#8fa1b5',
};

const ConcentrationTimeChart = ({ concentrationData = [] }) => {
  const [currentConcentration, setCurrentConcentration] = useState(null);
  const maxDataPoints = 100;

  useEffect(() => {
    const trace = {
      x: [],
      y: [],
      name: 'Predicted concentration (ug/mL)',
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
        title: { text: 'Concentration (ug/mL)', font: { size: 10, color: C.muted } },
        gridcolor: C.border,
        color: C.muted,
        showline: false,
        zeroline: false,
        range: [0, 100],
      },
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
      setCurrentConcentration(null);
      Promise.resolve(Plotly.update(
        'concentration-time-plot',
        { x: [[]], y: [[]] },
        {
          'xaxis.autorange': true,
          'yaxis.range': [0, 100],
        },
        [0],
      )).catch(() => {});
      return;
    }

    const visibleData = concentrationData.slice(-maxDataPoints);
    const latest = visibleData.at(-1).concentration;
    setCurrentConcentration(latest);
    const yMax = Math.max(10, Math.ceil(
      Math.max(...visibleData.map(({ concentration }) => concentration)) * 1.2,
    ));
    Promise.resolve(Plotly.update(
      'concentration-time-plot',
      {
        x: [visibleData.map(({ time }) => time)],
        y: [visibleData.map(({ concentration }) => concentration)],
      },
      {
        'xaxis.autorange': true,
        'yaxis.range': [0, yMax],
      },
      [0],
    )).catch(() => {});
  }, [concentrationData]);

  return (
    <section
      aria-labelledby="concentration-chart-title"
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <header className="flex shrink-0 items-center justify-between border-b px-3 py-2" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2">
          <TrendingUp size={13} aria-hidden="true" style={{ color: C.blue }} />
          <h2 id="concentration-chart-title" className="text-xs font-semibold tracking-wide" style={{ color: C.text }}>
            Concentration vs Time
          </h2>
        </div>
        <span className="font-mono text-[10px]" style={{ color: C.muted }}>Live regression estimates</span>
      </header>

      <div className="flex shrink-0 items-center gap-3 border-b px-3 py-1.5 font-mono text-[10px]" style={{ borderColor: C.border, color: C.muted }}>
        <span>Per-frame point estimates</span>
        <span className="ml-auto">Points: {concentrationData.length}</span>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-1 pt-3">
        <div id="concentration-time-plot" style={{ width: '100%', height: '100%' }} />
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t px-3 py-2" style={{ borderColor: C.border }}>
        <span className="text-[10px]" style={{ color: C.muted }}>Current concentration:</span>
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] font-semibold" style={{ color: C.text }}>
          {currentConcentration === null ? '--' : currentConcentration.toFixed(2)} ug/mL
        </span>
      </footer>
    </section>
  );
};

export default ConcentrationTimeChart;
