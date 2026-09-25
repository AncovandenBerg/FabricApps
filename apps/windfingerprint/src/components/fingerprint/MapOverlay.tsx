import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Positions React content at a lat/lon over a react-leaflet map, recomputed
 * on pan/zoom via latLngToContainerPoint. Renders as a sibling of Leaflet's
 * own panes (not inside the auto-panned map pane), so the manual recompute
 * is the only thing keeping it aligned -- that's deliberate, not a workaround.
 */
export function MapOverlay({
  lat,
  lon,
  children,
}: {
  lat: number;
  lon: number;
  children: React.ReactNode;
}) {
  const map = useMap();
  const [point, setPoint] = useState(() => map.latLngToContainerPoint([lat, lon]));

  useEffect(() => {
    const update = () => setPoint(map.latLngToContainerPoint([lat, lon]));
    update();
    map.on('move zoom resize', update);
    return () => {
      map.off('move zoom resize', update);
    };
  }, [map, lat, lon]);

  return (
    <div
      className="absolute left-0 top-0 z-[1000]"
      style={{ transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)` }}
    >
      {children}
    </div>
  );
}
