export interface Station {
  eoi: string;
  name: string;
  type: 'traffic' | 'industrial' | 'background';
  area: string;
  lat: number;
  lon: number;
}

/**
 * 19 of the 20 real NL stations ingested by the bronze/silver/gold pipeline
 * (nb_wind_bronze / nb_silver / nb_gold) -- curated 2026-09-17 from live EEA
 * metadata, not invented. Kept in sync by hand with the copies in those
 * notebooks (they don't share a module system with the frontend).
 *
 * Rotterdam-Bentinckplein (NL00448) is deliberately left out: it only has a
 * PM2.5 export (see public/exports/), so as STATIONS[0] -- the app's default
 * station, picked before a visitor touches anything -- it landed everyone on
 * the empty state.
 */
export const STATIONS: Station[] = [
  { eoi: 'NL00007', name: 'Amsterdam-Einsteinweg', type: 'traffic', area: 'urban', lat: 52.3813, lon: 4.8452 },
  { eoi: 'NL00636', name: 'Utrecht-Kardinaal de Jongweg', type: 'traffic', area: 'urban', lat: 52.1051, lon: 5.1244 },
  { eoi: 'NL00741', name: 'Nijmegen-Graafseweg', type: 'traffic', area: 'urban', lat: 51.8414, lon: 5.8578 },
  { eoi: 'NL00937', name: 'Groningen-Europaweg', type: 'traffic', area: 'urban', lat: 53.2178, lon: 6.5789 },
  { eoi: 'NL00496', name: 'Hoek v. Holland-Berghaven', type: 'industrial', area: 'unknown', lat: 51.9778, lon: 4.1219 },
  { eoi: 'NL00485', name: 'Hoogvliet-Leemkuil', type: 'industrial', area: 'urban', lat: 51.8674, lon: 4.3552 },
  { eoi: 'NL00495', name: 'Maassluis-Kwartellaan', type: 'industrial', area: 'urban', lat: 51.9320, lon: 4.2280 },
  { eoi: 'NL00551', name: 'IJmuiden-Kanaaldijk', type: 'industrial', area: 'urban', lat: 52.4630, lon: 4.6018 },
  { eoi: 'NL00704', name: 'Amsterdam-Hoogtij', type: 'industrial', area: 'urban', lat: 52.4281, lon: 4.7732 },
  { eoi: 'NL00644', name: 'Cabauw-Wielsekade', type: 'background', area: 'rural', lat: 51.9745, lon: 4.9233 },
  { eoi: 'NL00934', name: 'Kollumerwaard-Hooge Zuidwal', type: 'background', area: 'rural', lat: 53.3304, lon: 6.2769 },
  { eoi: 'NL00131', name: 'Vredepeel-Vredeweg', type: 'background', area: 'rural', lat: 51.5405, lon: 5.8531 },
  { eoi: 'NL00418', name: 'Rotterdam-Schiedamsevest', type: 'background', area: 'urban', lat: 51.9142, lon: 4.4800 },
  { eoi: 'NL00488', name: 'Rotterdam Zuid-Zwartewaalstraat', type: 'background', area: 'urban', lat: 51.8936, lon: 4.4876 },
  { eoi: 'NL00494', name: 'Schiedam-Alphons Arienstraat', type: 'background', area: 'urban', lat: 51.9214, lon: 4.4014 },
  { eoi: 'NL00404', name: 'Den Haag-Rebecquestraat', type: 'background', area: 'urban', lat: 52.0771, lon: 4.2892 },
  { eoi: 'NL00014', name: 'Amsterdam-Vondelpark', type: 'background', area: 'urban', lat: 52.3597, lon: 4.8662 },
  { eoi: 'NL00241', name: 'Breda-Bastenakenstraat', type: 'background', area: 'suburban', lat: 51.6031, lon: 4.7810 },
  { eoi: 'NL00807', name: 'Hellendoorn-Luttenbergerweg', type: 'background', area: 'rural', lat: 52.3883, lon: 6.4029 },
];
