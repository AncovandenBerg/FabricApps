import type { TopLevelSpec } from 'vega-lite';

import { CHART_CONFIG, CHART_SIZE } from './chartTheme';
import type { CpfSectorValue } from './types';
import { compassLabelForSector, sectorArcBounds } from './windSectors';

interface CpfRow {
  thetaStart: number;
  thetaEnd: number;
  radiusStart: number;
  radiusEnd: number;
  cpf: number;
  n: number;
  sectorLabel: string;
}

function toRows(values: CpfSectorValue[]): CpfRow[] {
  const rows: CpfRow[] = [];
  for (const value of values) {
    const label = compassLabelForSector(value.sectorIndex) ?? `${value.sectorIndex * 15}°`;
    for (const bounds of sectorArcBounds(value.sectorIndex)) {
      rows.push({
        ...bounds,
        radiusStart: 0,
        radiusEnd: value.cpf,
        cpf: value.cpf,
        n: value.n,
        sectorLabel: label,
      });
    }
  }
  return rows;
}

export interface CpfRoseSpecOptions {
  /** Chart width/height in px. Defaults to the standalone-panel CHART_SIZE. */
  size?: number;
  /** Off for the map-overlay variant, where the legend would float over the basemap. */
  showLegend?: boolean;
}

/** Radial bar rose: bar length is CPF (0-1); sectors reaching furthest out point at the source. */
export function buildCpfRoseSpec(
  values: CpfSectorValue[],
  options: CpfRoseSpecOptions = {}
): TopLevelSpec {
  const size = options.size ?? CHART_SIZE;
  const showLegend = options.showLegend ?? true;
  const maxRadius = Math.round(size * 0.46);

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: size,
    height: size,
    autosize: { type: 'fit', contains: 'padding' },
    config: CHART_CONFIG,
    data: { values: toRows(values) },
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
        scale: { domain: [0, 1], range: [0, maxRadius] },
      },
      radius2: { field: 'radiusEnd' },
      color: {
        field: 'cpf',
        type: 'quantitative',
        scale: { domain: [0, 0.5, 1], range: ['#eaf3f0', '#2b6e63', '#b0431a'] },
        legend: showLegend ? { title: 'Chance of high pollution', format: '.0%' } : null,
      },
      tooltip: [
        { field: 'sectorLabel', type: 'nominal', title: 'Direction' },
        { field: 'cpf', type: 'quantitative', title: 'Chance of high pollution', format: '.0%' },
        { field: 'n', type: 'quantitative', title: 'Hours of data' },
      ],
    },
  };
}
