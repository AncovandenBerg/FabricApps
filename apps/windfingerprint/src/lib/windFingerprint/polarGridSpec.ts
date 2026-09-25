import type { TopLevelSpec } from 'vega-lite';

import { CHART_CONFIG, CHART_SIZE } from './chartTheme';
import { SPEED_BINS, speedBinVisualUpperMs, MIN_CELL_N } from './speedBins';
import type { GridCell } from './types';
import { sectorArcBounds } from './windSectors';

interface PolarGridRow {
  thetaStart: number;
  thetaEnd: number;
  radiusStart: number;
  radiusEnd: number;
  speedBinLabel: string;
  meanConcentration: number;
  n: number;
}

/**
 * Flattens the 24-sector x 6-speed-bin grid into arc rows Vega-Lite can draw
 * directly. Bearing is encoded as-is (0-360) against a theta scale pinned to
 * [0, 360] -> [0, 2*PI]: verified against Vega's arc scenegraph output that
 * this puts 0 deg/N at 12 o'clock with clockwise rotation, matching compass
 * bearing with no rotation hack. Sector 0 (centred on N) is split across the
 * 0/360 seam into two arcs sharing the same value.
 */
function toRows(cells: GridCell[]): PolarGridRow[] {
  const rows: PolarGridRow[] = [];
  for (const cell of cells) {
    const bin = SPEED_BINS[cell.speedBinIndex];
    for (const bounds of sectorArcBounds(cell.sectorIndex)) {
      rows.push({
        ...bounds,
        radiusStart: bin.lowerMs,
        radiusEnd: speedBinVisualUpperMs(bin),
        speedBinLabel: bin.label,
        meanConcentration: cell.meanConcentration,
        n: cell.n,
      });
    }
  }
  return rows;
}

export interface PolarGridSpecOptions {
  unit: string;
  minCellN?: number;
}

export function buildPolarGridSpec(
  cells: GridCell[],
  options: PolarGridSpecOptions
): TopLevelSpec {
  const minCellN = options.minCellN ?? MIN_CELL_N;
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: CHART_SIZE,
    height: CHART_SIZE,
    autosize: { type: 'fit', contains: 'padding' },
    config: CHART_CONFIG,
    data: { values: toRows(cells) },
    mark: { type: 'arc', stroke: '#fbfcfb', strokeWidth: 0.75 },
    encoding: {
      theta: {
        field: 'thetaStart',
        type: 'quantitative',
        scale: { domain: [0, 360] },
      },
      theta2: { field: 'thetaEnd' },
      radius: {
        field: 'radiusStart',
        type: 'quantitative',
        scale: { domain: [0, 12] },
      },
      radius2: { field: 'radiusEnd' },
      color: {
        condition: {
          test: `datum.n < ${minCellN}`,
          value: '#c9cfd4',
        },
        field: 'meanConcentration',
        type: 'quantitative',
        scale: { range: ['#f1e7c9', '#8c3413'] },
        legend: { title: `Mean ${options.unit}` },
      },
      tooltip: [
        { field: 'speedBinLabel', type: 'nominal', title: 'Wind speed' },
        {
          field: 'meanConcentration',
          type: 'quantitative',
          title: `Mean (${options.unit})`,
          format: '.1f',
        },
        { field: 'n', type: 'quantitative', title: 'Hours (n)' },
      ],
    },
  };
}
