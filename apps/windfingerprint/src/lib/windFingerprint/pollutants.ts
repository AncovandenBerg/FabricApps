import type { Pollutant } from './types';

export interface PollutantInfo {
  /** Plain-English name shown alongside the acronym everywhere in the UI. */
  plainName: string;
  /** Short, no-jargon note on where it typically comes from. */
  source: string;
}

export const POLLUTANT_INFO: Record<Pollutant, PollutantInfo> = {
  NO2: { plainName: 'Nitrogen dioxide', source: 'mostly car and truck exhaust' },
  PM10: { plainName: 'Coarse dust particles', source: 'dust, pollen, brake and tyre wear' },
  'PM2.5': { plainName: 'Fine soot particles', source: 'smoke and combustion, travels furthest' },
};
