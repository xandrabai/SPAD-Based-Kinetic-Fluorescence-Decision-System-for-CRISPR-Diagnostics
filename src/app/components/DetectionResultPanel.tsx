type Props = {
  result: 'neutral' | 'negative' | 'positive';
  interval: {
    lowerBound: number;
    midpoint: number;
    upperBound: number;
  } | null;
  blockCount: number;
  timeToPositive: number | null;
};

export default function DetectionResultPanel({
  result,
  interval,
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
        <div className="mt-3 grid w-full max-w-md grid-cols-3 gap-2 font-mono">
          {[
            ['Lower bound', interval?.lowerBound],
            ['Midpoint', interval?.midpoint],
            ['Upper bound', interval?.upperBound],
          ].map(([name, value]) => (
            <div key={name as string}>
              <p className="text-[10px] text-[#8fa1b5]">{name}</p>
              <p className="mt-1 text-xl font-bold" style={{ color: stateColor }}>
                {typeof value === 'number' ? value.toFixed(2) : '--'}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-[#8fa1b5]">ug/mL</p>
        {interval === null && result !== 'neutral' ? (
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
