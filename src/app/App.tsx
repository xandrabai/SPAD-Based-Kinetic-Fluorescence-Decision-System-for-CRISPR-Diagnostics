import { useMemo, useRef, useState } from 'react';
import { Activity, Clock, Pause, Play, RotateCcw } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ConcentrationTimeChart from './components/ConcentrationTimeChart';
import DetectionResultPanel from './components/DetectionResultPanel';
import SpadHistogram from './components/SpadHistogram';
import { replayEnabled } from './utils/replaySource';

const C = {
  bg: '#0b0f14',
  panel: '#111720',
  border: '#1e2a38',
  accent: '#00d4aa',
  accentDim: '#00d4aa22',
  orange: '#ff9b57',
  text: '#e2eaf4',
  muted: '#8fa1b5',
  dimText: '#536579',
};

type ConcentrationPoint = {
  time: number;
  concentration: number;
};

type ThirtySecondAveragePoint = ConcentrationPoint;

type ConfidenceInterval = {
  lowerBound: number;
  midpoint: number;
  upperBound: number;
};

type TransportState = 'ready' | 'connecting' | 'live' | 'paused' | 'error';
type ResultState = 'neutral' | 'negative' | 'positive';

type DetectionEvent = {
  block: {
    timeMs: number;
    concentration: number;
    frameCount: number;
  };
  blockCount: number;
  lowerBoundUpdate: ConcentrationPoint | null;
  intervalUpdate: (ConfidenceInterval & { time: number }) | null;
  positiveJustLatched: boolean;
  timeToPositiveMs: number | null;
};

type SpadHandle = {
  startConnection: () => Promise<void>;
  togglePause: (paused: boolean) => void;
  resetData: () => Promise<void>;
};

export default function App() {
  const [transport, setTransport] = useState<TransportState>('ready');
  const [result, setResult] = useState<ResultState>('neutral');
  const [activeElapsedMs, setActiveElapsedMs] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const [timeToPositive, setTimeToPositive] = useState<number | null>(null);
  const [concentrationData, setConcentrationData] = useState<ConcentrationPoint[]>([]);
  const [publishedInterval, setPublishedInterval] = useState<ConfidenceInterval | null>(null);
  const [blockMeanData, setBlockMeanData] = useState<ConcentrationPoint[]>([]);
  const spadRef = useRef<SpadHandle | null>(null);
  const serialSupported = (
    typeof navigator !== 'undefined'
    && (navigator as Navigator & { serial?: unknown }).serial !== undefined
  ) || (typeof window !== 'undefined' && replayEnabled());

  const thirtySecondAverages = useMemo(() => {
    const completedWindowEnd = Math.floor(activeElapsedMs / 30_000) * 30;
    const averages: ThirtySecondAveragePoint[] = [];
    for (let windowEnd = 30; windowEnd <= completedWindowEnd; windowEnd += 30) {
      const points = blockMeanData.filter(
        (point) => point.time > windowEnd - 30 && point.time <= windowEnd,
      );
      if (points.length > 0) {
        averages.push({
          time: windowEnd,
          concentration: points.reduce((sum, point) => sum + point.concentration, 0) / points.length,
        });
      }
    }
    return averages;
  }, [activeElapsedMs, blockMeanData]);

  const handleDetectionUpdate = (event: DetectionEvent) => {
    setBlockCount(event.blockCount);
    setBlockMeanData((points) => [
      ...points,
      { time: event.block.timeMs / 1_000, concentration: event.block.concentration },
    ]);
    if (event.intervalUpdate) {
      const { lowerBound, midpoint, upperBound } = event.intervalUpdate;
      setPublishedInterval({ lowerBound, midpoint, upperBound });
    }
    if (event.positiveJustLatched && event.timeToPositiveMs !== null) {
      setResult('positive');
      setTimeToPositive(event.timeToPositiveMs / 1_000);
    }
  };

  const handleRunPauseClick = () => {
    if (result === 'neutral') {
      setResult('negative');
      setActiveElapsedMs(0);
      setBlockCount(0);
      setTimeToPositive(null);
      setConcentrationData([]);
      setPublishedInterval(null);
      setBlockMeanData([]);
      void spadRef.current?.startConnection();
      return;
    }

    const shouldPause = transport === 'live';
    spadRef.current?.togglePause(shouldPause);
  };

  const handleResetClick = async () => {
    await spadRef.current?.resetData();
    setTransport('ready');
    setResult('neutral');
    setActiveElapsedMs(0);
    setBlockCount(0);
    setTimeToPositive(null);
    setConcentrationData([]);
    setPublishedInterval(null);
    setBlockMeanData([]);
  };

  const runLabel = result === 'neutral'
    ? 'RUN'
    : transport === 'live'
      ? 'Pause'
      : transport === 'paused'
        ? 'Resume'
        : 'RUN';
  const runDisabled = !serialSupported || transport === 'connecting' || transport === 'error';
  const transportColor = transport === 'live'
    ? C.accent
    : transport === 'error'
      ? C.orange
      : C.muted;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: C.bg, color: C.text, fontFamily: 'Inter, sans-serif' }}>
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2"
        style={{ borderColor: C.border, background: C.panel }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded"
            style={{ background: C.accentDim, border: `1px solid ${C.accent}` }}
          >
            <Activity size={14} aria-hidden="true" style={{ color: C.accent }} />
          </div>
          <div>
            <h1 className="text-xs font-semibold leading-tight" style={{ color: C.text }}>
              SPAD-Based Kinetic Fluorescence
            </h1>
            <p className="text-[10px] leading-tight" style={{ color: C.muted }}>
              CRISPR Pathogen Detector · sequential lower-bound decision
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {!serialSupported ? (
            <p role="alert" className="text-xs text-[#ffb37a]">
              Web Serial requires Chrome or Edge.
            </p>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${transport === 'live' ? 'animate-pulse' : ''}`}
              style={{ background: transportColor }}
            />
            <span
              role="status"
              aria-live="polite"
              className="text-xs font-semibold"
              style={{ color: transportColor }}
            >
              {transport.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1" style={{ color: C.muted }}>
            <Clock size={12} aria-hidden="true" />
            <span className="font-mono text-xs">{formatDuration(activeElapsedMs / 1_000)}</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: C.border, color: result === 'neutral' ? C.dimText : C.text }}
            onClick={() => void handleResetClick()}
            disabled={result === 'neutral' && transport === 'ready'}
          >
            <RotateCcw size={12} aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: C.accent, color: C.bg }}
            onClick={handleRunPauseClick}
            disabled={runDisabled}
          >
            {transport === 'live' ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
            {runLabel}
          </button>
        </div>
      </header>

      <main className="dashboard-grid min-h-0 flex-1 gap-3 p-3">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-[18rem] flex-1">
            <SpadHistogram
              ref={spadRef}
              onDetectionUpdate={handleDetectionUpdate}
              onConcentrationPoint={(point: ConcentrationPoint) => {
                setConcentrationData((points) => [...points.slice(-99), point]);
              }}
              onTransportChange={setTransport}
              onActiveTimeChange={setActiveElapsedMs}
            />
          </div>
          <div className="min-h-[18rem] flex-1">
            <ConcentrationTimeChart concentrationData={concentrationData} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-[14rem] flex-1">
            <DetectionResultPanel
              result={result}
              interval={publishedInterval}
              blockCount={blockCount}
              timeToPositive={timeToPositive}
            />
          </div>
          <div className="min-h-[20rem] flex-[2]">
            <BlockMeanAveragePanel averageData={thirtySecondAverages} />
          </div>
        </div>
      </main>
    </div>
  );
}

function BlockMeanAveragePanel({ averageData }: { averageData: ThirtySecondAveragePoint[] }) {
  const xAxisEnd = Math.max(120, averageData.at(-1)?.time ?? 0);
  const xAxisTicks = Array.from(
    { length: Math.floor(xAxisEnd / 30) + 1 },
    (_, index) => index * 30,
  );

  return (
    <section
      aria-labelledby="block-mean-average-title"
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <header className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: C.border }}>
        <h2 id="block-mean-average-title" className="text-xs font-semibold" style={{ color: C.text }}>
          30 s Block-Mean Average
        </h2>
        <span className="font-mono text-[10px]" style={{ color: C.muted }}>Complete windows only</span>
      </header>
      <div className="flex items-center justify-between border-b px-3 py-1.5 font-mono text-[10px]" style={{ borderColor: C.border, color: C.muted }}>
        <span>Window: 30 s</span>
        <span>Points: {averageData.length}</span>
      </div>
      <div className="min-h-0 flex-1 px-2 pb-2 pt-3">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
          <LineChart data={averageData} margin={{ top: 4, right: 12, left: 12, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, xAxisEnd]}
              ticks={xAxisTicks}
              tick={{ fill: C.muted, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
              label={{ value: 'Active time (s)', position: 'insideBottom', fill: C.muted, fontSize: 9, dy: 18 }}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: C.muted, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Block mean (ug/mL)', angle: -90, position: 'insideLeft', fill: C.muted, fontSize: 9, dx: 14 }}
            />
            <Tooltip
              contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 10, color: C.text }}
              formatter={(value: number) => [value.toFixed(2), 'Average block mean']}
              labelFormatter={(time) => `Window ending at ${time} s`}
            />
            <Line type="monotone" dataKey="concentration" stroke={C.orange} strokeWidth={2.5} dot={{ r: 4, fill: C.orange }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
