import { POLLUTANT_INFO } from '@/lib/windFingerprint/pollutants';
import type { Station } from '@/lib/windFingerprint/stations';
import type { Pollutant } from '@/lib/windFingerprint/types';

const POLLUTANTS: Pollutant[] = ['NO2', 'PM10', 'PM2.5'];

const STATION_TYPE_HINT: Record<Station['type'], string> = {
  traffic: 'Right next to a busy road -- picks up exhaust fumes directly',
  industrial: 'Near factories or industry',
  background: "General air quality, away from any one big source",
};

const STATION_AREA_HINT: Record<string, string> = {
  urban: 'In a city or town',
  suburban: 'Just outside a city',
  rural: 'Out in the countryside',
  unknown: 'Area type not recorded',
};

const selectClasses =
  'w-full appearance-none rounded-sm border border-ink/20 bg-panel px-3 py-2 pr-8 font-mono text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-2 focus:ring-rust/15';

function ChevronDown() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-soft"
    >
      <path
        d="M5 7.5l5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StationPicker({
  stations,
  station,
  onStationChange,
  pollutant,
  onPollutantChange,
}: {
  stations: Station[];
  station: Station;
  onStationChange: (station: Station) => void;
  pollutant: Pollutant;
  onPollutantChange: (pollutant: Pollutant) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-soft">Station</span>
        <div className="relative">
          <select
            className={selectClasses}
            value={station.eoi}
            onChange={(event) => {
              const next = stations.find((s) => s.eoi === event.target.value);
              if (next) onStationChange(next);
            }}
          >
            {stations.map((s) => (
              <option key={s.eoi} value={s.eoi}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown />
        </div>
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium text-ink-soft">Pollution type</span>
          <div className="relative">
            <select
              className={selectClasses}
              value={pollutant}
              onChange={(event) => onPollutantChange(event.target.value as Pollutant)}
            >
              {POLLUTANTS.map((p) => (
                <option key={p} value={p}>
                  {p} — {POLLUTANT_INFO[p].plainName}
                </option>
              ))}
            </select>
            <ChevronDown />
          </div>
        </label>
        <span className="text-xs text-ink-soft">{POLLUTANT_INFO[pollutant].source}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-ink/10 pt-4">
        <span
          className="cursor-help rounded-sm bg-teal/10 px-2 py-0.5 text-xs font-medium capitalize text-teal"
          title={STATION_TYPE_HINT[station.type]}
        >
          {station.type}
        </span>
        <span
          className="cursor-help rounded-sm bg-ink/5 px-2 py-0.5 text-xs font-medium capitalize text-ink-soft"
          title={STATION_AREA_HINT[station.area] ?? station.area}
        >
          {station.area}
        </span>
        <span className="ml-auto font-mono text-xs text-ink-soft">{station.eoi}</span>
      </div>
    </div>
  );
}
