import React, { useEffect, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { TrendingUp } from 'lucide-react';

const C = {
  bg: '#0b0f14',
  panel: '#111720',
  border: '#1e2a38',
  accent: '#00d4aa',
  accentDim: '#00d4aa22',
  accentBright: '#00ffcc',
  blue: '#4f9eff',
  blueDim: '#4f9eff18',
  orange: '#ff8c42',
  yellow: '#f5c518',
  text: '#e2eaf4',
  muted: '#6b7a8d',
  dimText: '#3d4f63',
};

const ConcentrationTimeChart = ({ concentrationData = [] }) => {
  const [currentConcentration, setCurrentConcentration] = useState(0);
  const maxDataPoints = 100; // Keep last 100 points

  // Initialize plot
  useEffect(() => {
    const trace = {
      x: [],
      y: [],
      mode: 'lines+markers',
      type: 'scattergl',
      line: { 
        color: C.blue, 
        width: 2.5,
        shape: 'spline'
      },
      marker: {
        color: C.blue,
        size: 4,
        line: {
          color: C.blueDim,
          width: 1
        }
      },
      fill: 'tozeroy',
      fillcolor: C.blueDim
    };

    const layout = {
      title: null,
      xaxis: {
        title: { 
          text: 'Time (s)', 
          font: { size: 10, color: C.muted } 
        },
        gridcolor: C.border,
        color: C.muted,
        showline: false,
        zeroline: false
      },
      yaxis: {
        title: { 
          text: 'Concentration (µg/ml)', 
          font: { size: 10, color: C.muted } 
        },
        gridcolor: C.border,
        color: C.muted,
        showline: false,
        zeroline: false,
        range: [0, 100]
      },
      plot_bgcolor: C.panel,
      paper_bgcolor: C.panel,
      font: { 
        family: 'JetBrains Mono, monospace', 
        color: C.muted, 
        size: 9 
      },
      margin: { t: 10, r: 20, b: 40, l: 50 }
    };

    Plotly.newPlot('concentration-time-plot', [trace], layout, { 
      responsive: true, 
      displayModeBar: false 
    });

    // Cleanup on unmount
    return () => {
      Plotly.purge('concentration-time-plot');
    };
  }, []);

  // Update plot when new data arrives
  useEffect(() => {
    if (concentrationData.length === 0) return;

    const visibleData = concentrationData.slice(-maxDataPoints);
    const { concentration } = visibleData[visibleData.length - 1];
    
    // Update current concentration display
    setCurrentConcentration(concentration);

    // Update the plot
    const update = {
      x: [visibleData.map(({ time }) => time)],
      y: [visibleData.map(({ concentration }) => concentration)]
    };

    // Auto-scale y-axis based on data
    const maxConc = Math.max(...visibleData.map(({ concentration }) => concentration), 10);
    const yMax = Math.ceil(maxConc * 1.2);

    Plotly.update('concentration-time-plot', update, { 'yaxis.range': [0, yMax] }, [0])
      .catch(() => {
        // Chart might not be ready yet
      });
  }, [concentrationData]);

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden h-full"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      {/* Panel Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: C.border }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: C.blue }}>
            <TrendingUp size={13} />
          </span>
          <span className="text-xs font-semibold tracking-wide" style={{ color: C.text }}>
            Concentration vs Time
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>
            Live monitoring
          </span>
        </div>
      </div>

      {/* Metadata Bar */}
      <div
        className="flex items-center gap-3 px-3 py-1.5 text-[10px] border-b shrink-0"
        style={{ borderColor: C.border, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}
      >
        <span>Sample rate: 0.5 Hz</span>
        <span style={{ marginLeft: 'auto' }}>Points: {concentrationData.length}</span>
      </div>

      {/* Plot Container */}
      <div className="flex-1 px-2 pt-3 pb-1 min-h-0">
        <div id="concentration-time-plot" style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2 border-t shrink-0"
        style={{ borderColor: C.border }}
      >
        <span className="text-[10px]" style={{ color: C.muted }}>
          Current concentration:
        </span>
        <span
          className="text-[11px] font-semibold ml-2"
          style={{ color: C.text, fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}
        >
          {currentConcentration.toFixed(2)} µg/ml
        </span>
      </div>
    </div>
  );
};

export default ConcentrationTimeChart;
