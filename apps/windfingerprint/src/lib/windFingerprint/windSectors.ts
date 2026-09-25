export const SECTOR_COUNT = 24;
export const SECTOR_WIDTH_DEG = 360 / SECTOR_COUNT; // 15

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * Bearing (0-360, meteorological "wind is blowing FROM" convention) to sector
 * index 0-23, centred on 0/15/30/... — mirrors the reference formula:
 * floor(((theta + 7.5) mod 360) / 15).
 */
export function sectorIndexForBearing(bearingDeg: number): number {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  return Math.floor(
    ((normalized + SECTOR_WIDTH_DEG / 2) % 360) / SECTOR_WIDTH_DEG
  );
}

export function sectorMidDeg(sectorIndex: number): number {
  return sectorIndex * SECTOR_WIDTH_DEG;
}

/**
 * Angular bounds of a sector in degrees, split into two ranges when the
 * sector straddles the 0/360 seam (only sector 0, centred on due north).
 * Kept non-negative so it composes with a [0, 360] -> [0, 2*PI] linear theta
 * scale without shifting the whole rose's rotation.
 */
export function sectorArcBounds(
  sectorIndex: number
): Array<{ thetaStart: number; thetaEnd: number }> {
  const start = sectorIndex * SECTOR_WIDTH_DEG - SECTOR_WIDTH_DEG / 2;
  const end = sectorIndex * SECTOR_WIDTH_DEG + SECTOR_WIDTH_DEG / 2;
  if (start < 0) {
    return [
      { thetaStart: 360 + start, thetaEnd: 360 },
      { thetaStart: 0, thetaEnd: end },
    ];
  }
  return [{ thetaStart: start, thetaEnd: end }];
}

/** Nearest 8-point compass label for a sector index, one per 3 sectors (30 deg apart). */
export function compassLabelForSector(sectorIndex: number): string | null {
  if (sectorIndex % 3 !== 0) return null;
  return COMPASS_LABELS[sectorIndex / 3] ?? null;
}
