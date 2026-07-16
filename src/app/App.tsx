import { useState, useEffect, useRef } from "react";
import {
  Activity,
  Play,
  Clock,
  FlaskConical,
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
} from "recharts";

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

const HISTORY_ROWS = [
  { date: "2025-07-16", time: "14:32:08", conc: "1000" },
  { date: "2025-07-16", time: "14:15:41", conc: "982" },
  { date: "2025-07-16", time: "13:58:22", conc: "1047" },
  { date: "2025-07-16", time: "13:40:55", conc: "965" },
  { date: "2025-07-15", time: "17:22:10", conc: "1031" },
  { date: "2025-07-15", time: "16:44:33", conc: "1008" },
  { date: "2025-07-15", time: "15:59:47", conc: "994" },
  { date: "2025-07-14", time: "11:12:05", conc: "1019" },
  { date: "2025-07-14", time: "10:48:31", conc: "978" },
  { date: "2025-07-13", time: "09:03:18", conc: "1055" },
];

// ── Concentration + History Panel ─────────────────────────────────────────────
function ConcentrationPanel() {
  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden h-full"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <PanelHeader icon={<FlaskConical size={13} />} title="Detection Result">
        <span
          className="text-[10px]"
          style={{ color: C.muted, fontFamily: "JetBrains Mono, monospace" }}
        >
          Updated at window close
        </span>
      </PanelHeader>

      {/* ── Concentration readout — dominant ── */}
      <div
        className="flex flex-col items-center justify-center px-4 py-6 border-b shrink-0"
        style={{ borderColor: C.border, background: "#0e1a14" }}
      >
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
          style={{
            background: "#00d4aa18",
            color: C.accent,
            border: `1px solid ${C.accent}55`,
            letterSpacing: "0.04em",
          }}
        >
          <CheckCircle2 size={12} />
          TARGET DETECTED
        </div>

        <div className="flex items-end gap-2 leading-none">
          <span
            className="font-bold"
            style={{
              fontSize: "4rem",
              color: C.accentBright,
              fontFamily: "JetBrains Mono, monospace",
              lineHeight: 1,
              textShadow: `0 0 40px ${C.accent}bb`,
            }}
          >
            1000
          </span>
          <span
            className="text-xl font-semibold mb-1.5"
            style={{ color: C.accent, fontFamily: "JetBrains Mono, monospace" }}
          >
            µg/ml
          </span>
        </div>

        <p className="text-xs mt-2.5" style={{ color: C.muted }}>
          Model expected concentration
        </p>

        <div className="flex items-center gap-5 mt-4">
          {[
            { label: "95% CI", value: "940–1060 µg/ml" },
            { label: "LOD", value: "0.4 µg/ml" },
            { label: "R² fit", value: "0.9912", color: C.accent },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px]" style={{ color: C.dimText }}>{label}</span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: color ?? C.text, fontFamily: "JetBrains Mono, monospace" }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── History table ── */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[10px] font-semibold" style={{ color: C.text }}>
          Measurement History
        </span>
        <span className="text-[9px]" style={{ color: C.dimText }}>
          µg/ml
        </span>
      </div>

      {/* Table header */}
      <div
        className="grid px-3 pb-1 border-b"
        style={{ gridTemplateColumns: "1fr 1fr 1fr", borderColor: C.border }}
      >
        {["Date", "Time", "Concentration"].map((h) => (
          <span key={h} className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: C.dimText }}>
            {h}
          </span>
        ))}
      </div>

      {/* Scrollable rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {HISTORY_ROWS.map((row, i) => (
          <div
            key={i}
            className="grid px-3 py-1.5 transition-colors hover:bg-white/[0.03]"
            style={{
              gridTemplateColumns: "1fr 1fr 1fr",
              borderBottom: `1px solid ${C.border}`,
              background: i === 0 ? `${C.accent}0a` : undefined,
            }}
          >
            <span
              className="text-[10px]"
              style={{ color: i === 0 ? C.text : C.muted, fontFamily: "JetBrains Mono, monospace" }}
            >
              {row.date}
            </span>
            <span
              className="text-[10px]"
              style={{ color: i === 0 ? C.text : C.muted, fontFamily: "JetBrains Mono, monospace" }}
            >
              {row.time}
            </span>
            <span
              className="text-[10px] font-semibold"
              style={{ color: i === 0 ? C.accentBright : C.accent, fontFamily: "JetBrains Mono, monospace" }}
            >
              {row.conc}
            </span>
          </div>
        ))}
      </div>

      {/* Footer stub — keeps visual balance */}
      <div
        className="flex items-center px-3 py-2 border-t shrink-0"
        style={{ borderColor: C.border }}
      >
        <span className="text-[9px]" style={{ color: C.dimText }}>
          {HISTORY_ROWS.length} records
        </span>
        <span className="ml-auto text-[9px]" style={{ color: C.dimText }}>
          last: {HISTORY_ROWS[0].date} {HISTORY_ROWS[0].time}
        </span>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [elapsed, setElapsed] = useState({ m: 22, s: 14 });
  const [analyzing, setAnalyzing] = useState(false);

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
              background: analyzing ? C.border : C.accent,
              color: analyzing ? C.muted : C.bg,
            }}
            onClick={() => setAnalyzing((a) => !a)}
          >
            <Play size={11} />
            {analyzing ? "Stop Analysis" : "Start Analysis"}
          </button>
        </div>
      </header>

      {/* Two-panel body: 2/3 histogram | 1/3 result */}
      <main
        className="flex-1 grid gap-3 p-3 min-h-0"
        style={{ gridTemplateColumns: "2fr 1fr" }}
      >
        <SignalHistogramPanel />
        <ConcentrationPanel />
      </main>
    </div>
  );
}
