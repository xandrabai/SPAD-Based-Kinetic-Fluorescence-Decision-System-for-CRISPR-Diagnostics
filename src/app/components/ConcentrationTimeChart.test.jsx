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

it('labels record lower bounds and draws the 30 ug/mL threshold', async () => {
  const { rerender } = render(<ConcentrationTimeChart concentrationData={[]} />);
  expect(screen.getByText('Lower Bound vs Time')).toBeInTheDocument();
  expect(Plotly.newPlot.mock.calls[0][2].shapes[0]).toMatchObject({ y0: 30, y1: 30 });
  expect(Plotly.update.mock.calls[0][2]['xaxis.autorange']).toBe(true);

  rerender(<ConcentrationTimeChart concentrationData={[{ time: 20, concentration: 31.25 }]} />);
  await waitFor(() => expect(Plotly.update).toHaveBeenCalled());
  expect(screen.getByText('31.25 ug/mL')).toBeInTheDocument();
});
