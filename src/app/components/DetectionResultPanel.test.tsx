import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DetectionResultPanel from './DetectionResultPanel';

describe('DetectionResultPanel', () => {
  it('is neutral before a run', () => {
    render(<DetectionResultPanel result="neutral" interval={null} blockCount={0} timeToPositive={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(3);
  });

  it('shows negative and evidence progress before the first bound', () => {
    render(<DetectionResultPanel result="negative" interval={null} blockCount={7} timeToPositive={null} />);
    expect(screen.getByText('NEGATIVE')).toBeInTheDocument();
    expect(screen.getByText('7 / 10 blocks')).toBeInTheDocument();
  });

  it('keeps a frozen positive time while rendering a newer bound', () => {
    const { rerender } = render(
      <DetectionResultPanel
        result="positive"
        interval={{ lowerBound: 31, midpoint: 32, upperBound: 33 }}
        blockCount={12}
        timeToPositive={24}
      />,
    );
    rerender(
      <DetectionResultPanel
        result="positive"
        interval={{ lowerBound: 35, midpoint: 36, upperBound: 37 }}
        blockCount={13}
        timeToPositive={24}
      />,
    );
    expect(screen.getByText('35.00')).toBeInTheDocument();
    expect(screen.getByText('36.00')).toBeInTheDocument();
    expect(screen.getByText('37.00')).toBeInTheDocument();
    expect(screen.getByText('Lower bound')).toBeInTheDocument();
    expect(screen.getByText('Midpoint')).toBeInTheDocument();
    expect(screen.getByText('Upper bound')).toBeInTheDocument();
    expect(screen.getByText('Time to positive: 00:24')).toBeInTheDocument();
  });
});
