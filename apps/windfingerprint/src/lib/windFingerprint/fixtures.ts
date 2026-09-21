import { SPEED_BINS, MIN_CELL_N } from './speedBins';
import type { CpfSectorValue, FingerprintSummary, GridCell, Pollutant } from './types';
import { SECTOR_COUNT } from './windSectors';

/**
 * Placeholder demo data only. Real stations, concentrations and wind come
 * from the EEA download service + Open-Meteo ingestion pipeline (not yet
 * built — see project plan). Deterministic pseudo-random so charts don't
 * jitter between renders/tests.
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface DemoStation {
  stationEoi: string;
  name: string;
  stationType: 'traffic' | 'industrial' | 'background';
  stationArea: 'urban' | 'suburban' | 'rural';
  /** Sector a synthetic dominant source sits in, for this demo fixture only. */
  lobeSectorIndex: number;
  /** 0-1: how strongly concentration piles up at low wind speed (local source). */
  localSourceStrength: number;
  /** 0-1: how strong the directional high-speed lobe is (distant source). */
  lobeStrength: number;
}

export const DEMO_STATIONS: DemoStation[] = [
  {
    stationEoi: 'NL10643-demo',
    name: 'Rotterdam-Overschie (demo, traffic)',
    stationType: 'traffic',
    stationArea: 'urban',
    lobeSectorIndex: 16, // ~240 deg, WSW toward the port
    localSourceStrength: 0.85,
    lobeStrength: 0.5,
  },
  {
    stationEoi: 'NL10639-demo',
    name: 'Rural reference (demo, background)',
    stationType: 'background',
    stationArea: 'rural',
    lobeSectorIndex: 16,
    localSourceStrength: 0.05,
    lobeStrength: 0.15,
  },
];

const BASELINE_BY_POLLUTANT: Record<Pollutant, number> = {
  NO2: 12,
  PM10: 15,
  'PM2.5': 8,
};

const UNIT_BY_POLLUTANT: Record<Pollutant, string> = {
  NO2: 'µg/m³',
  PM10: 'µg/m³',
  'PM2.5': 'µg/m³',
};

export function unitForPollutant(pollutant: Pollutant): string {
  return UNIT_BY_POLLUTANT[pollutant];
}

export function buildDemoGrid(
  station: DemoStation,
  pollutant: Pollutant
): GridCell[] {
  const baseline = BASELINE_BY_POLLUTANT[pollutant];
  const cells: GridCell[] = [];
  for (let sectorIndex = 0; sectorIndex < SECTOR_COUNT; sectorIndex++) {
    const rawDistance = Math.abs(sectorIndex - station.lobeSectorIndex);
    const angularDistance = Math.min(rawDistance, SECTOR_COUNT - rawDistance);
    const lobeProximity = Math.exp(-(angularDistance ** 2) / (2 * 2.5 ** 2));

    for (const bin of SPEED_BINS) {
      const speedMid = bin.upperMs === null ? 11 : (bin.lowerMs + bin.upperMs) / 2;
      const centreComponent =
        station.localSourceStrength * baseline * Math.exp(-speedMid / 2.5);
      const lobeComponent =
        station.lobeStrength * baseline * lobeProximity * Math.min(speedMid / 6, 1);
      const noise =
        (pseudoRandom(sectorIndex * 7 + bin.index * 31 + baseline) - 0.5) *
        baseline *
        0.15;
      const meanConcentration = Math.round(
        Math.max(baseline * 0.3 + centreComponent + lobeComponent + noise, 1) * 10
      ) / 10;

      // Higher wind speeds occur less often; the rarest, highest-speed cells
      // deliberately dip below MIN_CELL_N so the grey-out styling has something
      // to show in the demo.
      const nBase = 420 - bin.index * 70;
      const n = Math.max(
        Math.round(nBase * (0.4 + pseudoRandom(sectorIndex + bin.index * 13) * 0.7)),
        4
      );

      cells.push({ sectorIndex, speedBinIndex: bin.index, meanConcentration, n });
    }
  }
  return cells;
}

export function computeDemoThreshold(baseline: number): number {
  // Approximation for demo purposes only — the real threshold is a live
  // percentile over hourly observations (see SavedView.threshold).
  return Math.round(baseline * 2.2 * 10) / 10;
}

export function buildDemoCpf(
  grid: GridCell[],
  threshold: number
): CpfSectorValue[] {
  const bySector = new Map<number, { total: number; exceed: number }>();
  for (const cell of grid) {
    const entry = bySector.get(cell.sectorIndex) ?? { total: 0, exceed: 0 };
    entry.total += cell.n;
    if (cell.meanConcentration > threshold) entry.exceed += cell.n;
    bySector.set(cell.sectorIndex, entry);
  }
  return Array.from(bySector.entries())
    .sort(([a], [b]) => a - b)
    .map(([sectorIndex, { total, exceed }]) => ({
      sectorIndex,
      n: total,
      exceedances: exceed,
      cpf: total > 0 ? exceed / total : 0,
    }));
}

export function buildDemoSummary(
  station: DemoStation,
  pollutant: Pollutant,
  grid: GridCell[],
  threshold: number
): FingerprintSummary {
  const validHours = grid.reduce((sum, cell) => sum + cell.n, 0);
  const calmHoursExcluded = Math.round(validHours * 0.04);
  const totalHours = validHours + calmHoursExcluded;
  return {
    stationName: station.name,
    stationEoi: station.stationEoi,
    pollutant,
    unit: unitForPollutant(pollutant),
    periodLabel: '2023-01-01 to 2023-12-31 (demo data)',
    totalHours,
    validHours,
    calmHoursExcluded,
    coveragePct: Math.round((validHours / (24 * 365)) * 1000) / 10,
    threshold,
    minCellN: MIN_CELL_N,
  };
}
