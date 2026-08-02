type Props = {
  result: 'neutral' | 'negative' | 'positive';
  lowerBound: number | null;
  blockCount: number;
  timeToPositive: number | null;
};

export default function DetectionResultPanel({
  result,
  lowerBound,
  blockCount,
  timeToPositive,
}: Props) {
  const label = result === 'neutral' ? '—' : result.toUpperCase();
  const stateColor = result === 'positive'
    ? '#00ffcc'
    : result === 'negative'
      ? '#ff9b57'
      : '#8fa1b5';
  const stateBackground = result === 'positive'
    ? '#0e1a14'
    : result === 'negative'
      ? '#1a1114'
      : '#111720';

  return (
    <section
      aria-labelledby="detection-result-title"
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ background: '#111720', border: '1px solid #1e2a38' }}
    >
      <header className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: '#1e2a38' }}>
        <h2 id="detection-result-title" className="text-xs font-semibold text-[#e2eaf4]">
          Detection Result
        </h2>
        <span className="font-mono text-[10px] text-[#8fa1b5]">Threshold: &gt;30 ug/mL</span>
      </header>
      <div
        aria-live="polite"
        role="status"
        className="flex flex-1 flex-col items-center justify-center px-4 text-center"
        style={{ background: stateBackground }}
      >
        <strong className="text-sm tracking-wide" style={{ color: stateColor }}>{label}</strong>
        <p className="mt-2 font-mono leading-none">
          <span className="text-4xl font-bold" style={{ color: stateColor }}>
            {lowerBound === null ? '--' : lowerBound.toFixed(2)}
          </span>{' '}
          <span className="text-sm text-[#8fa1b5]">ug/mL</span>
        </p>
        <p className="mt-2 text-xs text-[#8fa1b5]">Lower-bound concentration</p>
        {lowerBound === null && result !== 'neutral' ? (
          <p className="mt-1 font-mono text-xs text-[#8fa1b5]">{blockCount} / 10 blocks</p>
        ) : null}
        {result === 'positive' && timeToPositive !== null ? (
          <p className="mt-2 font-mono text-xs text-[#8fa1b5]">
            Time to positive: {formatDuration(timeToPositive)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
