import { useState, useEffect, useRef } from "react";
import {
  Activity,
  Play,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import SpadHistogram from "./components/SpadHistogram";
import ConcentrationTimeChart from "./components/ConcentrationTimeChart";

const C = {
  bg: "#0b0f14",
  panel: "#111720",
  border: "#1e2a38",
  accent: "#00d4aa",
  accentDim: "#00d4aa22",
  accentBright: "#00ffcc",
  blue: "#4f9eff",
  blueDim: "#4f9eff18",
  orange: "#ff8c42",
  yellow: "#f5c518",
  text: "#e2eaf4",
  muted: "#6b7a8d",
  dimText: "#3d4f63",
};

type ConcentrationPoint = {
  time: number;
  concentration: number;
};

type ThirtySecondAveragePoint = {
  time: number;
  concentration: number;
};

const MAX_CONCENTRATION_POINTS = 100;

// ── Data generators ───────────────────────────────────────────────────────────
function generateHistogram() {
  return Array.from({ length: 48 }, (_, i) => ({
    bin: i * 20,
    count: Math.round(
      Math.max(0, 90 * Math.exp(-0.5 * ((i - 22) / 6) ** 2) + Math.random() * 10)
    ),
  }));
}


// ── Shared UI ─────────────────────────────────────────────────────────────────
function PanelHeader({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b shrink-0"
      style={{ borderColor: C.border }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: C.accent }}>{icon}</span>
        <span className="text-xs font-semibold tracking-wide" style={{ color: C.text }}>
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
      style={{ background: active ? C.accent : C.border, color: active ? C.bg : C.muted }}
    >
      {children}
    </button>
  );
}

// ── Signal Histogram Panel ────────────────────────────────────────────────────
function SignalHistogramPanel() {
  const [histData] = useState(generateHistogram);
  const [view, setView] = useState<"raw" | "norm">("raw");

  const displayData =
    view === "norm"
      ? histData.map((d) => ({ ...d, count: parseFloat((d.count / 90).toFixed(3)) }))
      : histData;

  const peak = histData.reduce((a, b) => (b.count > a.count ? b : a), histData[0]);

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden h-full"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <PanelHeader icon={<Activity size={13} />} title="Signal Histogram">
        <span className="text-[10px]" style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>
          100 ps/bin
        </span>
        <Pill active={view === "raw"} onClick={() => setView("raw")}>Raw</Pill>
        <Pill active={view === "norm"} onClick={() => setView("norm")}>Norm</Pill>
      </PanelHeader>

      <div
        className="flex items-center gap-3 px-3 py-1.5 text-[10px] border-b shrink-0"
        style={{ borderColor: C.border, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}
      >
        <span>LED: 465 nm</span>
      </div>

      <div className="flex-1 px-2 pt-3 pb-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={displayData}
            margin={{ top: 4, right: 8, left: -18, bottom: 20 }}
            barCategoryGap="4%"
          >
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.accent} stopOpacity={0.9} />
                <stop offset="100%" stopColor={C.accent} stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="bin"
              tick={{ fill: C.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
              tickFormatter={(v) => (v % 200 === 0 ? v : "")}
              label={{
                value: "Channel (100 ps/bin)",
                position: "insideBottom",
                fill: C.muted,
                fontSize: 9,
                dy: 18,
              }}
            />
            <YAxis
              tick={{ fill: C.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false}
              tickLine={false}
              label={{
                value: view === "norm" ? "Norm." : "Counts",
                angle: -90,
                position: "insideLeft",
                fill: C.muted,
                fontSize: 9,
                dx: 14,
              }}
            />
            <Tooltip
              cursor={{ fill: `${C.accent}11` }}
              contentStyle={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 10,
                color: C.text,
              }}
              formatter={(v: number) => [view === "norm" ? v.toFixed(3) : v, "Count"]}
              labelFormatter={(l) => `Channel ${l}`}
            />
            <Bar dataKey="count" fill="url(#barGrad)" radius={[2, 2, 0, 0]} name="Count" />
            <ReferenceLine x={peak.bin} stroke={C.yellow} strokeDasharray="4 2" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>

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
}

function FinalResultPanel({ concentration }: { concentration?: number }) {
  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden h-full"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <PanelHeader icon={<CheckCircle2 size={13} />} title="Detection Result">
        <span className="text-[10px]" style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>
          Live result
        </span>
      </PanelHeader>
      <div className="flex-1 flex flex-col items-center justify-center px-4" style={{ background: "#0e1a14" }}>
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: C.accent }}>
          TARGET DETECTED
        </span>
        <div className="flex items-end gap-1.5 mt-2 leading-none">
          <span className="text-4xl font-bold" style={{ color: C.accentBright, fontFamily: "JetBrains Mono, monospace" }}>
            {concentration === undefined ? "--" : concentration.toFixed(2)}
          </span>
          <span className="text-sm font-semibold mb-0.5" style={{ color: C.accent }}>
            µg/ml
          </span>
        </div>
        <span className="text-[10px] mt-2" style={{ color: C.muted }}>
          Latest real-time concentration
        </span>
      </div>
    </div>
  );
}

// ── 30-second Concentration Average Panel ─────────────────────────────────────
function ConcentrationPanel({
  averageData,
}: {
  averageData: ThirtySecondAveragePoint[];
}) {
  const xAxisEnd = Math.max(120, averageData.at(-1)?.time ?? 0);
  const xAxisTicks = Array.from(
    { length: Math.floor(xAxisEnd / 30) + 1 },
    (_, index) => index * 30,
  );

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden h-full"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <PanelHeader icon={<Activity size={13} />} title="30 s Average Concentration">
        <span
          className="text-[10px]"
          style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace" }}
        >
          Complete windows only
        </span>
      </PanelHeader>

      <div
        className="flex items-center justify-between px-3 py-1.5 text-[10px] border-b shrink-0"
        style={{ borderColor: C.border, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}
      >
        <span>Window: 30 s</span>
        <span>Points: {averageData.length}</span>
      </div>

      <div className="flex-1 px-2 pt-3 pb-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={averageData} margin={{ top: 4, right: 12, left: 12, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, xAxisEnd]}
              ticks={xAxisTicks}
              tick={{ fill: C.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
              label={{ value: "Time (s)", position: "insideBottom", fill: C.muted, fontSize: 9, dy: 18 }}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: C.muted, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false}
              tickLine={false}
              label={{ value: "Avg. concentration (µg/ml)", angle: -90, position: "insideLeft", fill: C.muted, fontSize: 9, dx: 14 }}
            />
            <Tooltip
              contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 10, color: C.text }}
              formatter={(value: number) => [value.toFixed(2), "Average concentration"]}
              labelFormatter={(time) => `Window ending at ${time} s`}
            />
            <Line type="monotone" dataKey="concentration" stroke={C.orange} strokeWidth={2.5} dot={{ r: 4, fill: C.orange }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [elapsed, setElapsed] = useState({ m: 22, s: 14 });
  const [measurementState, setMeasurementState] = useState<{
    concentrationDataset: ConcentrationPoint[];
    thirtySecondAverages: ThirtySecondAveragePoint[];
  }>({ concentrationDataset: [], thirtySecondAverages: [] });
  const spadRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed((e) => {
        const s = e.s + 1 >= 60 ? 0 : e.s + 1;
        const m = e.s + 1 >= 60 ? e.m + 1 : e.m;
        return { m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleUartClick = () => {
    if (spadRef.current) {
      spadRef.current.toggleConnection();
    }
  };

  const handleConcentrationUpdate = ({ time, concentration }: ConcentrationPoint) => {
    setMeasurementState(({ concentrationDataset, thirtySecondAverages }) => {
      const nextDataset = [
        ...concentrationDataset.slice(-(MAX_CONCENTRATION_POINTS - 1)),
        { time, concentration },
      ];
      const lastWindowEnd = thirtySecondAverages.at(-1)?.time ?? 0;
      const completedWindowEnd = Math.floor(time / 30) * 30;
      const newAverages: ThirtySecondAveragePoint[] = [];

      for (let windowEnd = lastWindowEnd + 30; windowEnd <= completedWindowEnd; windowEnd += 30) {
        const windowPoints = nextDataset.filter(
          (point) => point.time > windowEnd - 30 && point.time <= windowEnd,
        );
        if (windowPoints.length > 0) {
          newAverages.push({
            time: windowEnd,
            concentration: windowPoints.reduce((sum, point) => sum + point.concentration, 0) / windowPoints.length,
          });
        }
      }

      return {
        concentrationDataset: nextDataset,
        thirtySecondAverages: [...thirtySecondAverages, ...newAverages],
      };
    });
  };

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: C.bg, color: C.text, fontFamily: "Inter, sans-serif" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ borderColor: C.border, background: C.panel }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: C.accentDim, border: `1px solid ${C.accent}` }}
          >
            <Activity size={13} style={{ color: C.accent }} />
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight" style={{ color: C.text }}>
              SPAD-Based Kinetic Fluorescence
            </p>
            <p className="text-[10px] leading-tight" style={{ color: C.muted }}>
              CRISPR Pathogen Detector · v2.4.1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: C.accent }}
            />
            <span className="text-xs" style={{ color: C.accent }}>Live</span>
          </div>
          <div className="flex items-center gap-1" style={{ color: C.muted }}>
            <Clock size={11} />
            <span className="text-xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {String(elapsed.m).padStart(2, "0")}:{String(elapsed.s).padStart(2, "0")}
            </span>
          </div>
          <span
            className="text-xs"
            style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace" }}
          >
            35.4k sp/s
          </span>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
            style={{
              background: C.accent,
              color: C.bg,
            }}
            onClick={handleUartClick}
          >
            <Play size={11} />
            UART
          </button>
        </div>
      </header>

      {/* Two-panel body: 2/3 histogram | 1/3 result */}
      <main
        className="flex-1 grid gap-3 p-3 min-h-0"
        style={{ gridTemplateColumns: "2fr 1fr" }}
      >
        {/* Left panel: Split into top and bottom halves */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <SpadHistogram
              ref={spadRef}
              onConcentrationUpdate={handleConcentrationUpdate}
            />
          </div>
          <div className="flex-1 min-h-0">
            <ConcentrationTimeChart concentrationData={measurementState.concentrationDataset} />
          </div>
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <FinalResultPanel
              concentration={measurementState.concentrationDataset.at(-1)?.concentration}
            />
          </div>
          <div className="flex-[2] min-h-0">
            <ConcentrationPanel averageData={measurementState.thirtySecondAverages} />
          </div>
        </div>
      </main>
    </div>
  );
}
