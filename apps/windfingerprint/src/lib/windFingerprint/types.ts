export type Pollutant = 'NO2' | 'PM10' | 'PM2.5';

export interface GridCell {
  sectorIndex: number; // 0-23
  speedBinIndex: number; // 0-5
  meanConcentration: number;
  n: number;
}

export interface CpfSectorValue {
  sectorIndex: number;
  cpf: number; // 0-1, share of sector hours above the threshold
  n: number;
  exceedances: number;
}

export interface FingerprintSummary {
  stationName: string;
  stationEoi: string;
  pollutant: Pollutant;
  unit: string;
  periodLabel: string;
  totalHours: number;
  validHours: number;
  /** null when the data source doesn't report calm-hour count (e.g. getFingerprint doesn't yet). */
  calmHoursExcluded: number | null;
  coveragePct: number;
  threshold: number;
  minCellN: number;
}
