import 'leaflet/dist/leaflet.css';

import { useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { VegaEmbed } from 'react-vega';

import { buildCpfRoseSpec } from '@/lib/windFingerprint/cpfRoseSpec';
import type { Station } from '@/lib/windFingerprint/stations';
import type { CpfSectorValue } from '@/lib/windFingerprint/types';

import { MapOverlay } from './MapOverlay';

const OVERLAY_SIZE = 260;
const COMPASS_OVERLAY_CLASSES =
  'pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-wider text-ink-soft/70';

export function CpfRoseMap({ station, values }: { station: Station; values: CpfSectorValue[] }) {
  const spec = useMemo(
    () => buildCpfRoseSpec(values, { size: OVERLAY_SIZE, showLegend: false }),
    [values]
  );
  const center: [number, number] = [station.lat, station.lon];

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-sm">
      <MapContainer
        key={station.eoi}
        center={center}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <CircleMarker
          center={center}
          radius={5}
          pathOptions={{ color: '#fbfcfb', fillColor: '#b0431a', fillOpacity: 1, weight: 2 }}
        />
        <MapOverlay lat={station.lat} lon={station.lon}>
          {/* Not pointer-events-none: keeps Vega's hover tooltips (per-sector CPF) working. */}
          <div className="relative" style={{ width: OVERLAY_SIZE, height: OVERLAY_SIZE }}>
            <VegaEmbed spec={spec} options={{ actions: false, renderer: 'svg' }} />
            <div className={COMPASS_OVERLAY_CLASSES}>
              <span className="absolute top-0 rounded-sm bg-panel/70 px-1">N</span>
              <span className="absolute right-0 rounded-sm bg-panel/70 px-1">E</span>
              <span className="absolute bottom-0 rounded-sm bg-panel/70 px-1">S</span>
              <span className="absolute left-0 rounded-sm bg-panel/70 px-1">W</span>
            </div>
          </div>
        </MapOverlay>
      </MapContainer>
    </div>
  );
}
