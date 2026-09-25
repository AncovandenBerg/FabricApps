import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CpfRose } from '@/components/fingerprint/CpfRose';
import { PolarPlot } from '@/components/fingerprint/PolarPlot';
import {
  DEMO_STATIONS,
  buildDemoCpf,
  buildDemoGrid,
  computeDemoThreshold,
} from '@/lib/windFingerprint/fixtures';

const ARC_MARK_SELECTOR = 'svg path[role="graphics-symbol"]';

describe('PolarPlot', () => {
  it('renders the bivariate grid as SVG arc marks', async () => {
    const grid = buildDemoGrid(DEMO_STATIONS[0], 'NO2');
    const { container } = render(<PolarPlot cells={grid} unit="µg/m³" />);

    await waitFor(() => {
      // 24 sectors x 6 speed bins, sector 0 split into 2 arcs per bin.
      expect(container.querySelectorAll(ARC_MARK_SELECTOR).length).toBe(150);
    });
  });
});

describe('CpfRose', () => {
  it('renders one arc per sector', async () => {
    const grid = buildDemoGrid(DEMO_STATIONS[0], 'NO2');
    const threshold = computeDemoThreshold(12);
    const cpf = buildDemoCpf(grid, threshold);
    const { container } = render(<CpfRose values={cpf} />);

    await waitFor(() => {
      // 24 sectors, sector 0 split into 2 arcs across the 0/360 seam.
      expect(container.querySelectorAll(ARC_MARK_SELECTOR).length).toBe(25);
    });
  });
});
