import { MIN_CELL_N } from './speedBins';
import type { CpfSectorValue, FingerprintSummary, GridCell, Pollutant } from './types';

/** Matches the payload shape written by nb_export_static.py -- keep in sync by hand. */
export interface FingerprintPayload {
  stationEoi: string;
  stationName: string;
  stationType: string;
  stationArea: string;
  pollutant: Pollutant;
  unit: string;
  totalHours: number;
  validHours: number;
  calmHoursExcluded: number;
  defaultThreshold: number;
  grid: Array<{
    sectorIndex: number;
    binSortOrder: number;
    binLabel: string;
    meanConcentration: number;
    n: number;
  }>;
  histogram: {
    /** N+1 ascending bucket boundaries, shared across all sectors. */
    edges: number[];
    bySector: Array<{ sectorIndex: number; n: number; counts: number[] }>;
  };
}

const EXPORT_PERIOD_LABEL = '2020-01-01 to 2025-12-31';

export async function loadFingerprintPayload(
  stationEoi: string,
  pollutant: Pollutant
): Promise<FingerprintPayload | null> {
  // Base-relative, not root-absolute: the showcase build is served from a
  // subpath (import.meta.env.BASE_URL), not domain root.
  const resp = await fetch(`${import.meta.env.BASE_URL}exports/${stationEoi}_${pollutant}.json`);
  if (resp.status === 404) return null; // no export for this combination -- see nb_export_static's "skipped" list
  if (!resp.ok) {
    throw new Error(`Failed to load fingerprint data (HTTP ${resp.status})`);
  }
  const text = await resp.text();
  try {
    return JSON.parse(text) as FingerprintPayload;
  } catch {
    // Some hosting setups answer a missing static file with a 200 HTML
    // page (SPA/portal fallback) instead of a real 404 -- e.g. Rotterdam-
    // Bentinckplein (NL00448) only has a PM2.5 export, so NO2/PM10 requests
    // land here. Treat an unparsable body the same as "no export" rather
    // than surfacing a confusing JSON.parse error.
    return null;
  }
}

export function toGrid(payload: FingerprintPayload): GridCell[] {
  return payload.grid.map((cell) => ({
    sectorIndex: cell.sectorIndex,
    speedBinIndex: cell.binSortOrder,
    meanConcentration: cell.meanConcentration,
    n: cell.n,
  }));
}

export function toSummary(payload: FingerprintPayload, threshold: number): FingerprintSummary {
  return {
    stationName: payload.stationName,
    stationEoi: payload.stationEoi,
    pollutant: payload.pollutant,
    unit: payload.unit,
    periodLabel: EXPORT_PERIOD_LABEL,
    totalHours: payload.totalHours,
    validHours: payload.validHours,
    calmHoursExcluded: payload.calmHoursExcluded,
    coveragePct:
      payload.totalHours > 0 ? Math.round((payload.validHours / payload.totalHours) * 1000) / 10 : 0,
    threshold,
    minCellN: MIN_CELL_N,
  };
}

/**
 * Approximates P(concentration > threshold | sector) from the precomputed
 * histogram via linear interpolation within the bucket containing the
 * threshold (assumes a uniform distribution within each bucket -- the same
 * "binned, not smoothed" tradeoff the project's spec already made for the
 * polar plot itself). Pure and cheap: recompute on every slider move, no
 * network round-trip.
 */
export function computeCpf(payload: FingerprintPayload, threshold: number): CpfSectorValue[] {
  const { edges, bySector } = payload.histogram;
  return bySector.map(({ sectorIndex, n, counts }) => {
    if (n === 0) return { sectorIndex, cpf: 0, n: 0, exceedances: 0 };
    let exceedances = 0;
    for (let i = 0; i < counts.length; i++) {
      const bucketLow = edges[i];
      const bucketHigh = edges[i + 1];
      if (bucketHigh <= threshold) continue;
      if (bucketLow >= threshold) {
        exceedances += counts[i];
      } else {
        const width = bucketHigh - bucketLow;
        const fractionAbove = width > 0 ? (bucketHigh - threshold) / width : 0;
        exceedances += counts[i] * fractionAbove;
      }
    }
    return { sectorIndex, n, exceedances: Math.round(exceedances), cpf: exceedances / n };
  });
}
