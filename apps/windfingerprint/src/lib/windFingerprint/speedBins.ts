export interface SpeedBin {
  index: number;
  lowerMs: number;
  upperMs: number | null; // null = open-ended (10+)
  label: string;
}

export const SPEED_BINS: SpeedBin[] = [
  { index: 0, lowerMs: 0, upperMs: 1, label: '0–1 m/s' },
  { index: 1, lowerMs: 1, upperMs: 2, label: '1–2 m/s' },
  { index: 2, lowerMs: 2, upperMs: 4, label: '2–4 m/s' },
  { index: 3, lowerMs: 4, upperMs: 6, label: '4–6 m/s' },
  { index: 4, lowerMs: 6, upperMs: 10, label: '6–10 m/s' },
  { index: 5, lowerMs: 10, upperMs: null, label: '10+ m/s' },
];

/** Cap used to draw the open-ended top bin as a finite ring. */
export const OPEN_BIN_VISUAL_CAP_MS = 12;

export function speedBinVisualUpperMs(bin: SpeedBin): number {
  return bin.upperMs ?? OPEN_BIN_VISUAL_CAP_MS;
}

export function speedBinIndexForSpeed(speedMs: number): number {
  for (const bin of SPEED_BINS) {
    if (bin.upperMs === null || speedMs < bin.upperMs) return bin.index;
  }
  return SPEED_BINS[SPEED_BINS.length - 1].index;
}

/** Below this, reported wind direction is unreliable and hours are excluded from binning. */
export const CALM_THRESHOLD_MS = 0.5;

/** Cells with fewer observed hours than this are greyed out as statistically unreliable. */
export const MIN_CELL_N = 20;
