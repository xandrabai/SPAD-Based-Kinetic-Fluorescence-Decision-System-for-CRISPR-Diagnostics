import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DetectionResultPanel from './DetectionResultPanel';

describe('DetectionResultPanel', () => {
  it('is neutral before a run', () => {
    render(<DetectionResultPanel result="neutral" lowerBound={null} blockCount={0} timeToPositive={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('shows negative and evidence progress before the first bound', () => {
    render(<DetectionResultPanel result="negative" lowerBound={null} blockCount={7} timeToPositive={null} />);
    expect(screen.getByText('NEGATIVE')).toBeInTheDocument();
    expect(screen.getByText('7 / 10 blocks')).toBeInTheDocument();
  });

  it('keeps a frozen positive time while rendering a newer bound', () => {
    const { rerender } = render(
      <DetectionResultPanel result="positive" lowerBound={31} blockCount={12} timeToPositive={24} />,
    );
    rerender(<DetectionResultPanel result="positive" lowerBound={35} blockCount={13} timeToPositive={24} />);
    expect(screen.getByText('35.00')).toBeInTheDocument();
    expect(screen.getByText('Time to positive: 00:24')).toBeInTheDocument();
  });
});
