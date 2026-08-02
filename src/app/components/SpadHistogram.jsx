import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Plotly from 'plotly.js-dist-min';
import { Activity } from 'lucide-react';
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
import { replayEnabled, startPositiveReplay } from '../utils/replaySource';
import { consumeSerialBytes } from '../utils/serialPacketDecoder';

const C = {
  bg: '#0b0f14',
  panel: '#111720',
  border: '#1e2a38',
  accent: '#00d4aa',
  accentDim: '#00d4aa22',
  text: '#e2eaf4',
  muted: '#8fa1b5',
};

const NUM_BINS = 3_840;

const SpadHistogram = forwardRef(({
  onDetectionUpdate,
  onConcentrationPoint,
  onTransportChange,
  onActiveTimeChange,
}, ref) => {
  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const [view, setView] = useState('raw');
  const [malformedPacketCount, setMalformedPacketCount] = useState(0);
  const [outOfRangeFrameCount, setOutOfRangeFrameCount] = useState(0);
  const [latestSignal, setLatestSignal] = useState(null);
  const [chartError, setChartError] = useState(null);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(true);
  const isPausedRef = useRef(false);
  const frameCountRef = useRef(0);
  const pipelineRef = useRef(createRealtimePipeline());
  const clockRef = useRef(null);
  const replayStopRef = useRef(null);
  const transportMalformedCountRef = useRef(0);

  useEffect(() => {
    const xData = Array.from({ length: NUM_BINS }, (_, index) => index);
    const trace = {
      x: xData,
      y: new Array(NUM_BINS).fill(0),
      mode: 'lines',
      type: 'scattergl',
      line: { color: C.accent, width: 2, shape: 'spline' },
      fill: 'tozeroy',
      fillcolor: C.accentDim,
    };
    const layout = {
      title: null,
      xaxis: {
        title: { text: 'Channel (100 ps/bin)', font: { size: 10, color: C.muted } },
        range: [0, NUM_BINS - 1],
        gridcolor: C.border,
        color: C.muted,
        showline: false,
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Counts', font: { size: 10, color: C.muted } },
        gridcolor: C.border,
        color: C.muted,
        range: [0, 100],
        showline: false,
        zeroline: false,
      },
      plot_bgcolor: C.panel,
      paper_bgcolor: C.panel,
      font: { family: 'JetBrains Mono, monospace', color: C.muted, size: 9 },
      margin: { t: 10, r: 20, b: 40, l: 50 },
    };

    Promise.resolve(
      Plotly.newPlot('react-spad-plot', [trace], layout, {
        responsive: true,
        displayModeBar: false,
      }),
    ).catch(() => setChartError('Signal chart unavailable'));

    const fpsInterval = window.setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1_000);

    return () => {
      window.clearInterval(fpsInterval);
      replayStopRef.current?.();
      replayStopRef.current = null;
      keepReadingRef.current = false;
      readerRef.current?.cancel().catch(() => {});
      Plotly.purge('react-spad-plot');
    };
  }, []);

  useEffect(() => {
    Promise.resolve(Plotly.relayout('react-spad-plot', {
      'yaxis.title': {
        text: view === 'norm' ? 'Normalized' : 'Counts',
        font: { size: 10, color: C.muted },
      },
    })).catch(() => setChartError('Signal chart unavailable'));
  }, [view]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      onActiveTimeChange?.(
        clockRef.current ? elapsedActiveMs(clockRef.current, performance.now()) : 0,
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [onActiveTimeChange]);

  function processAlgorithm(bins) {
    if (view !== 'norm') return bins;
    const maxValue = Math.max(...bins);
    return maxValue > 0 ? Array.from(bins, (value) => value / maxValue) : bins;
  }

  function updatePlotWithFrame(payloadBytes) {
    const activeElapsedMs = clockRef.current
      ? elapsedActiveMs(clockRef.current, performance.now())
      : 0;
    const transition = processRealtimePayload(
      pipelineRef.current,
      payloadBytes,
      activeElapsedMs,
    );
    pipelineRef.current = transition.state;
    setMalformedPacketCount(
      transportMalformedCountRef.current + transition.state.malformedFrameCount,
    );
    setOutOfRangeFrameCount(transition.state.outOfRangeFrameCount);

    if (transition.bins === null) return;
    const bins = transition.bins;
    const algorithmicResult = processAlgorithm(bins);
    if (Number.isFinite(transition.prediction?.signal)) {
      setLatestSignal(transition.prediction.signal);
    }
    if (transition.concentrationPoint) {
      onConcentrationPoint?.(transition.concentrationPoint);
    }
    transition.completedEvents.forEach((event) => onDetectionUpdate?.(event));

    const maxValue = Math.max(...algorithmicResult);
    const yLimit = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 100;
    Promise.resolve(Plotly.update(
      'react-spad-plot',
      { y: [algorithmicResult] },
      { 'yaxis.range': [0, yLimit] },
      [0],
    )).catch(() => setChartError('Signal chart unavailable'));
    frameCountRef.current += 1;
  }

  async function readLoop() {
    let byteBuffer = new Uint8Array(0);

    while (portRef.current?.readable && keepReadingRef.current) {
      readerRef.current = portRef.current.readable.getReader();
      try {
        while (keepReadingRef.current) {
          const { value, done } = await readerRef.current.read();
          if (done) break;
          if (!value) continue;

          const decoded = consumeSerialBytes(byteBuffer, value);
          byteBuffer = decoded.buffer;
          if (decoded.malformedPacketCount > 0) {
            transportMalformedCountRef.current += decoded.malformedPacketCount;
            setMalformedPacketCount(
              transportMalformedCountRef.current + pipelineRef.current.malformedFrameCount,
            );
          }
          if (!isPausedRef.current) {
            decoded.histogramPayloads.forEach(updatePlotWithFrame);
          }
        }
      } catch (error) {
        if (keepReadingRef.current) {
          console.error('Serial read error:', error);
          onTransportChange?.('error');
        }
      } finally {
        readerRef.current?.releaseLock();
        readerRef.current = null;
      }
    }

    if (portRef.current) {
      await portRef.current.close().catch(() => {});
      portRef.current = null;
    }
    setIsConnected(false);
  }

  const beginRun = () => {
    pipelineRef.current = createRealtimePipeline();
    clockRef.current = createActiveRunClock(performance.now());
    keepReadingRef.current = true;
    isPausedRef.current = false;
    frameCountRef.current = 0;
    transportMalformedCountRef.current = 0;
    setMalformedPacketCount(0);
    setOutOfRangeFrameCount(0);
    setLatestSignal(null);
    setChartError(null);
    onActiveTimeChange?.(0);
    onTransportChange?.('live');
  };

  const startConnection = async () => {
    onTransportChange?.('connecting');
    if (replayEnabled()) {
      replayStopRef.current?.();
      setIsConnected(true);
      beginRun();
      replayStopRef.current = startPositiveReplay((payload) => {
        if (!isPausedRef.current) updatePlotWithFrame(payload);
      });
      return;
    }
    if (portRef.current?.readable) {
      beginRun();
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 460_800 });
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

  const resetData = async () => {
    replayStopRef.current?.();
    replayStopRef.current = null;
    isPausedRef.current = true;
    pipelineRef.current = createRealtimePipeline();
    clockRef.current = null;
    frameCountRef.current = 0;
    transportMalformedCountRef.current = 0;
    setMalformedPacketCount(0);
    setOutOfRangeFrameCount(0);
    setLatestSignal(null);
    setChartError(null);
    onActiveTimeChange?.(0);
    onTransportChange?.('ready');
    await Promise.resolve(Plotly.update(
      'react-spad-plot',
      { y: [new Array(NUM_BINS).fill(0)] },
      { 'yaxis.range': [0, 100] },
      [0],
    )).catch(() => setChartError('Signal chart unavailable'));
  };

  useImperativeHandle(ref, () => ({
    startConnection,
    togglePause,
    resetData,
    isConnected,
    fps,
  }));

  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
      aria-labelledby="signal-histogram-title"
    >
      <header
        className="flex shrink-0 items-center justify-between border-b px-3 py-2"
        style={{ borderColor: C.border }}
      >
        <div className="flex items-center gap-2">
          <Activity size={13} aria-hidden="true" style={{ color: C.accent }} />
          <h2 id="signal-histogram-title" className="text-xs font-semibold tracking-wide" style={{ color: C.text }}>
            Signal Histogram
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono" style={{ color: C.muted }}>100 ps/bin</span>
          <button
            type="button"
            aria-pressed={view === 'raw'}
            onClick={() => setView('raw')}
            className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
            style={{ background: view === 'raw' ? C.accent : C.border, color: view === 'raw' ? C.bg : C.muted }}
          >
            Raw
          </button>
          <button
            type="button"
            aria-pressed={view === 'norm'}
            onClick={() => setView('norm')}
            className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
            style={{ background: view === 'norm' ? C.accent : C.border, color: view === 'norm' ? C.bg : C.muted }}
          >
            Normalized
          </button>
        </div>
      </header>

      <div
        className="flex shrink-0 items-center gap-3 border-b px-3 py-1.5 font-mono text-[10px]"
        style={{ borderColor: C.border, color: C.muted }}
      >
        <span>LED: 465 nm</span>
        <span className="ml-auto">FPS: {fps}</span>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-1 pt-3">
        <div id="react-spad-plot" style={{ width: '100%', height: '100%' }} />
      </div>

      <footer
        className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 font-mono text-[10px]"
        style={{ borderColor: C.border, color: C.muted }}
      >
        <span>Background-corrected integrated signal:</span>
        <span className="font-semibold" style={{ color: C.text }}>
          {latestSignal === null ? '--' : latestSignal.toFixed(2)}
        </span>
        <span className="ml-auto">Malformed packets: {malformedPacketCount}</span>
        <span>Out-of-range predictions: {outOfRangeFrameCount}</span>
        {chartError ? <span role="status">{chartError}</span> : null}
      </footer>
    </section>
  );
});

SpadHistogram.displayName = 'SpadHistogram';

export default SpadHistogram;
