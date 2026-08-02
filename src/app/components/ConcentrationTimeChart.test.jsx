import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Plotly from 'plotly.js-dist-min';
import { beforeEach, expect, it, vi } from 'vitest';
import ConcentrationTimeChart from './ConcentrationTimeChart';

vi.mock('plotly.js-dist-min', () => ({
  default: {
    newPlot: vi.fn(),
    update: vi.fn(),
    purge: vi.fn(),
  },
}));

beforeEach(() => {
  Plotly.newPlot.mockResolvedValue(undefined);
  Plotly.update.mockResolvedValue(undefined);
});

it('plots live regression concentrations against active time', async () => {
  const { rerender } = render(<ConcentrationTimeChart concentrationData={[]} />);
  expect(screen.getByText('Concentration vs Time')).toBeInTheDocument();
  expect(screen.getByText('Live regression estimates')).toBeInTheDocument();
  expect(Plotly.newPlot.mock.calls[0][2].shapes).toBeUndefined();
  expect(Plotly.update.mock.calls[0][2]['xaxis.autorange']).toBe(true);

  rerender(<ConcentrationTimeChart concentrationData={[
    { time: 1, concentration: 30.5 },
    { time: 2, concentration: 31.25 },
  ]} />);
  await waitFor(() => expect(Plotly.update).toHaveBeenCalled());
  expect(screen.getByText('31.25 ug/mL')).toBeInTheDocument();
  expect(Plotly.update).toHaveBeenLastCalledWith(
    'concentration-time-plot',
    { x: [[1, 2]], y: [[30.5, 31.25]] },
    expect.any(Object),
    [0],
  );
});
