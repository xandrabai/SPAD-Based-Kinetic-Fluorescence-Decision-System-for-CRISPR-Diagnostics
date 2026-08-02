import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

const histogram = vi.hoisted(() => ({
  props: null as any,
  startConnection: vi.fn(),
  togglePause: vi.fn(),
  resetData: vi.fn().mockResolvedValue(undefined),
}));
const concentrationChart = vi.hoisted(() => ({ props: null as any }));

vi.mock('./components/SpadHistogram', async () => {
  const ReactModule = await import('react');
  return {
    default: ReactModule.forwardRef((props: any, ref) => {
      histogram.props = props;
      ReactModule.useImperativeHandle(ref, () => ({
        startConnection: histogram.startConnection,
        togglePause: histogram.togglePause,
        resetData: histogram.resetData,
      }));
      return <div data-testid="histogram" />;
    }),
  };
});

vi.mock('./components/ConcentrationTimeChart', () => ({
  default: (props: any) => {
    concentrationChart.props = props;
    return <div data-testid="concentration-chart" />;
  },
}));

vi.mock('recharts', async () => {
  const ReactModule = await import('react');
  const Container = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const Empty = () => null;
  return {
    CartesianGrid: Empty,
    Line: Empty,
    LineChart: Container,
    ResponsiveContainer: Container,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  histogram.resetData.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: {},
  });
});

it('starts negative and preserves TTP while later records update', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByText('—')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'RUN' }));
  expect(screen.getByText('NEGATIVE')).toBeInTheDocument();
  expect(histogram.startConnection).toHaveBeenCalledOnce();

  act(() => histogram.props.onDetectionUpdate({
    block: { timeMs: 20_000, concentration: 50, frameCount: 8 },
    blockCount: 10,
    lowerBoundUpdate: { time: 20, concentration: 31 },
    intervalUpdate: { time: 20, lowerBound: 31, midpoint: 32, upperBound: 33 },
    positiveJustLatched: true,
    isPositive: true,
    timeToPositiveMs: 20_000,
  }));
  expect(screen.getByText('POSITIVE')).toBeInTheDocument();
  expect(screen.getByText('Time to positive: 00:20')).toBeInTheDocument();

  act(() => histogram.props.onDetectionUpdate({
    block: { timeMs: 30_000, concentration: 60, frameCount: 8 },
    blockCount: 15,
    lowerBoundUpdate: { time: 30, concentration: 35 },
    intervalUpdate: { time: 30, lowerBound: 35, midpoint: 36, upperBound: 37 },
    positiveJustLatched: false,
    isPositive: true,
    timeToPositiveMs: 20_000,
  }));
  expect(screen.getByText('35.00')).toBeInTheDocument();
  expect(screen.getByText('36.00')).toBeInTheDocument();
  expect(screen.getByText('37.00')).toBeInTheDocument();
  expect(screen.getByText('Time to positive: 00:20')).toBeInTheDocument();

  act(() => histogram.props.onConcentrationPoint({ time: 1.5, concentration: 42.25 }));
  expect(concentrationChart.props.concentrationData).toEqual([
    { time: 1.5, concentration: 42.25 },
  ]);
});

it('disables RUN when Web Serial is unavailable', () => {
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: undefined,
  });
  render(<App />);
  expect(screen.getByRole('button', { name: 'RUN' })).toBeDisabled();
  expect(screen.getByText(/Web Serial requires Chrome or Edge/i)).toBeInTheDocument();
});
