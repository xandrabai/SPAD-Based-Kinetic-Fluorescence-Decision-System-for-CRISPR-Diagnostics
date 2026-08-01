import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Activity } from 'lucide-react';
import { processFrame } from '../utils/concentrationPredictor';
import { evaluateConfidence } from '../utils/predictionConfidence';
import { MIN_SAMPLES_FOR_PREDICTION } from '../utils/config';

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

const SpadHistogram = forwardRef(({ onConcentrationUpdate }, ref) => {
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate] = useState(460800);
  const [fps, setFps] = useState(0);
  const [view, setView] = useState('raw');
  
  // Track start time for elapsed time calculation
  const startTimeRef = useRef(Date.now());

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(true);
  const isPausedRef = useRef(false);
  const frameCountRef = useRef(0);
  const sampleCountRef = useRef(0);
  const predictionSamplesRef = useRef([]);
  const lastLowerBoundRef = useRef(null);

  const numBins = 3840;
  const xData = Array.from({ length: numBins }, (_, i) => i);
  let yData = new Array(numBins).fill(0);

  useEffect(() => {
    const trace = {
      x: xData,
      y: yData,
      mode: 'lines',
      type: 'scattergl',
      line: { color: C.accent, width: 2, shape: 'spline' },
      fill: 'tozeroy',
      fillcolor: C.accentDim
    };

    const layout = {
      title: null,
      xaxis: {
        title: { text: 'Channel (100 ps/bin)', font: { size: 10, color: C.muted } },
        range: [0, numBins - 1],
        gridcolor: C.border,
        color: C.muted,
        showline: false,
        zeroline: false
      },
      yaxis: {
        title: { text: 'Counts', font: { size: 10, color: C.muted } },
        gridcolor: C.border,
        color: C.muted,
        range: [0, 100],
        showline: false,
        zeroline: false
      },
      plot_bgcolor: C.panel,
      paper_bgcolor: C.panel,
      font: { family: 'JetBrains Mono, monospace', color: C.muted, size: 9 },
      margin: { t: 10, r: 20, b: 40, l: 50 }
    };

    Plotly.newPlot('react-spad-plot', [trace], layout, { responsive: true, displayModeBar: false });

    const fpsInterval = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      clearInterval(fpsInterval);
      if (portRef.current) {
        keepReadingRef.current = false;
        readerRef.current?.cancel().catch(() => {});
      }
    };
  }, []);

  // Update y-axis title when view changes
  useEffect(() => {
    const yAxisTitle = view === 'norm' ? 'Normalized' : 'Counts';
    Plotly.relayout('react-spad-plot', {
      'yaxis.title': { text: yAxisTitle, font: { size: 10, color: C.muted } }
    }).catch(() => {
      // Chart might not be initialized yet, ignore
    });
  }, [view]);

  const processAlgorithm = (binsArray) => {
    if (view === 'norm') {
      const maxVal = Math.max(...binsArray);
      return maxVal > 0 ? Array.from(binsArray, v => v / maxVal) : binsArray;
    }
    return binsArray;
  };

  // ==================== UNTOUCHED CORE LOGIC ====================
  function updatePlotWithFrame(payloadBytes) {
    const bins = new Float64Array(numBins);
    let maxVal = 0;

    for (let i = 0; i < numBins / 2; i++) {
      const byteIdx = i * 4;
      if (byteIdx + 3 < payloadBytes.length) {
        // CRITICAL: Force unsigned 32-bit integer to prevent sign-extension corruption
        // when byte[3] has high bit set (values >= 128)
        const word = (payloadBytes[byteIdx] | 
                     (payloadBytes[byteIdx + 1] << 8) | 
                     (payloadBytes[byteIdx + 2] << 16) | 
                     (payloadBytes[byteIdx + 3] << 24)) >>> 0;
        
        const val1 = word & 0xFFF;        // Extract lowest 12 bits
        const val2 = (word >> 12) & 0xFFF; // Extract middle 12 bits

        bins[2 * i] = val1;
        bins[2 * i + 1] = val2;

        if (val1 > maxVal) maxVal = val1;
        if (val2 > maxVal) maxVal = val2;
      }
    }

    // Pass unpacked array through the custom processing algorithm
    const algorithmicResult = processAlgorithm(bins);

    // Real-time regression prediction for every incoming sample (internal only —
    // the UI only reflects the lower confidence bound, and only once it rises).
    sampleCountRef.current += 1;
    if (onConcentrationUpdate && sampleCountRef.current >= MIN_SAMPLES_FOR_PREDICTION) {
      const prediction = processFrame(bins);
      predictionSamplesRef.current.push(prediction.concentration);

      const confidence = evaluateConfidence(predictionSamplesRef.current);
      const hasLowerBound = confidence.lowerBound !== undefined;
      const isNewHigh =
        hasLowerBound &&
        (lastLowerBoundRef.current === null || confidence.lowerBound > lastLowerBoundRef.current);

      // Always report a positive call even if this particular lower bound
      // isn't a new high (it can't be missed — the run stops right after).
      if (hasLowerBound && (isNewHigh || confidence.isSignificant)) {
        lastLowerBoundRef.current = confidence.lowerBound;
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        const payload = {
          time: elapsedSeconds,
          concentration: confidence.lowerBound,
          signal: prediction.signal,
          status: prediction.status
        };

        if (confidence.isSignificant) {
          // Positive call: stop acquiring further samples and report time-to-positive.
          isPausedRef.current = true;
          payload.isPositive = true;
          payload.timeToPositive = elapsedSeconds;
        }

        onConcentrationUpdate(payload);
      }
    }

    const yLimit = maxVal > 0 ? Math.ceil(maxVal * 1.15) : 100;
    Plotly.update('react-spad-plot', { y: [algorithmicResult] }, { 'yaxis.range': [0, yLimit] }, [0]);
    frameCountRef.current++;
  }

  async function readLoop() {
    let byteBuffer = new Uint8Array(0);

    while (portRef.current.readable && keepReadingRef.current) {
      readerRef.current = portRef.current.readable.getReader();
      try {
        while (true) {
          const { value, done } = await readerRef.current.read();
          if (done) break;
          if (value) {
            let temp = new Uint8Array(byteBuffer.length + value.length);
            temp.set(byteBuffer);
            temp.set(value, byteBuffer.length);
            byteBuffer = temp;

            while (byteBuffer.length >= 6) {
              if (byteBuffer[0] === 0x7E && byteBuffer[1] === 0xE7) {
                const payloadLen = byteBuffer[4] | (byteBuffer[5] << 8);
                const totalFrameLen = 6 + payloadLen;

                if (byteBuffer.length >= totalFrameLen) {
                  const dataPayload = byteBuffer.slice(6, 6 + payloadLen);
                  if (!isPausedRef.current) {
                    updatePlotWithFrame(dataPayload);
                  }
                  byteBuffer = byteBuffer.slice(totalFrameLen);
                } else {
                  break;
                }
              } else {
                byteBuffer = byteBuffer.slice(1);
              }
            }
          }
        }
      } catch (error) {
        console.error("Serial read error:", error);
      } finally {
        readerRef.current.releaseLock();
      }
    }

    if (portRef.current) {
      await portRef.current.close();
      portRef.current = null;
    }
    setIsConnected(false);
  }

  const startConnection = async () => {
    if (portRef.current) return;
    try {
      portRef.current = await navigator.serial.requestPort();
      await portRef.current.open({ baudRate: parseInt(baudRate) });
      setIsConnected(true);
      keepReadingRef.current = true;
      isPausedRef.current = false;
      // Sample placed / run started now — time-to-positive is measured from here.
      startTimeRef.current = Date.now();
      readLoop();
    } catch (err) {
      console.error(err);
      alert("UART connection failed. Please check physical connection.");
    }
  };

  const togglePause = (paused) => {
    isPausedRef.current = paused;
  };

  const resetData = () => {
    startTimeRef.current = Date.now();
    isPausedRef.current = false;
    sampleCountRef.current = 0;
    predictionSamplesRef.current = [];
    lastLowerBoundRef.current = null;
    frameCountRef.current = 0;
    Plotly.update(
      'react-spad-plot',
      { y: [new Array(numBins).fill(0)] },
      { 'yaxis.range': [0, 100] },
      [0],
    ).catch(() => {});
  };

  useImperativeHandle(ref, () => ({
    startConnection,
    togglePause,
    resetData,
    isConnected,
    fps
  }));

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
          <span style={{ color: C.accent }}>
            <Activity size={13} />
          </span>
          <span className="text-xs font-semibold tracking-wide" style={{ color: C.text }}>
            Signal Histogram
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>
            100 ps/bin
          </span>
          <button
            onClick={() => setView('raw')}
            className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
            style={{ background: view === 'raw' ? C.accent : C.border, color: view === 'raw' ? C.bg : C.muted }}
          >
            Raw
          </button>
          <button
            onClick={() => setView('norm')}
            className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
            style={{ background: view === 'norm' ? C.accent : C.border, color: view === 'norm' ? C.bg : C.muted }}
          >
            Cleaned
          </button>
        </div>
      </div>

      {/* Metadata Bar */}
      <div
        className="flex items-center gap-3 px-3 py-1.5 text-[10px] border-b shrink-0"
        style={{ borderColor: C.border, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}
      >
        <span>LED: 465 nm</span>
        <span style={{ marginLeft: 'auto' }}>FPS: {fps}</span>
      </div>

      {/* Plot Container */}
      <div className="flex-1 px-2 pt-3 pb-1 min-h-0">
        <div id="react-spad-plot" style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2 border-t shrink-0"
        style={{ borderColor: C.border }}
      >
        <span className="text-[10px]" style={{ color: C.muted }}>
          Mean Background Connected Integrated Counts per frame:
        </span>
        <span
          className="text-[11px] font-semibold ml-2"
          style={{ color: C.text, fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}
        >
          {(2418).toLocaleString()}
        </span>
      </div>
    </div>
  );
});

export default SpadHistogram;
