import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/hooks/AuthContext';
import { HomePage } from '@/pages/HomePage';
import type { IAuthService } from '@/services/IAuthService';

// react-leaflet drives the real Leaflet library, which manipulates real
// layout/canvas/SVG-renderer internals jsdom doesn't provide -- it crashes
// on mount there, the same category of gap as Vega's canvas warning. Stub
// the SDK boundary (same pattern as IAuthService) instead of fighting jsdom.
//
// The stub map object must be a stable reference (module-level, not
// recreated per call): MapOverlay's effect depends on it, and the real
// react-leaflet's useMap() always returns the same underlying L.Map
// instance across renders. A fresh object per call here caused an infinite
// effect-render loop that hung the test run.
const mockMap = {
  latLngToContainerPoint: () => ({ x: 0, y: 0 }),
  on: () => {},
  off: () => {},
};
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  useMap: () => mockMap,
}));

// Real export produced by nb_export_static.py against real EEA/Open-Meteo
// data -- not a hand-typed fixture, so this test exercises the actual
// payload shape the pipeline emits.
const REAL_PAYLOAD = readFileSync(join(process.cwd(), 'public/exports/NL00007_NO2.json'), 'utf8');

const stubAuthService: IAuthService = {
  fabricAuthEnabled: false,
  async signIn() {
    return { id: 'u1', email: 'dev@contoso.com', name: 'dev' };
  },
  async signOut() {},
  async getCurrentUser() {
    return { id: 'u1', email: 'dev@contoso.com', name: 'dev' };
  },
  async initEmbeddedAuth() {
    return { id: 'u1', email: 'dev@contoso.com', name: 'dev' };
  },
};

describe('HomePage (real exported data)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('NL00448_NO2')) {
          return new Response(null, { status: 404 });
        }
        return new Response(REAL_PAYLOAD, { status: 200 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads real data and renders the polar plot, CPF rose, and a working threshold slider', async () => {
    render(
      <AuthProvider authService={stubAuthService}>
        <HomePage />
      </AuthProvider>
    );

    // Station picker shows the real 20-station list, not demo fixtures.
    expect(await screen.findByText('Rotterdam-Bentinckplein')).toBeInTheDocument();

    // The default station (STATIONS[0], NL00448) has no NO2 export -- switch
    // to NL00007 (Amsterdam-Einsteinweg), which the mock serves REAL_PAYLOAD for.
    fireEvent.change(screen.getByLabelText('Station'), { target: { value: 'NL00007' } });

    // Real summary numbers from the exported payload (not demo/placeholder values).
    // Regex (not an exact string) because toLocaleString()'s grouping separator
    // is locale-dependent (comma vs dot) -- "." here matches either.
    await waitFor(() => {
      expect(screen.getByText(/51.573/)).toBeInTheDocument(); // validHours
    });
    // "57.3" appears in both the slider label and the "Defaults to..." helper text.
    expect(screen.getAllByText(/57\.3/).length).toBeGreaterThan(0);

    const svgPaths = document.querySelectorAll('svg path[role="graphics-symbol"]');
    expect(svgPaths.length).toBeGreaterThan(0);

    // The map-overlay section (react-leaflet stubbed above) is wired in.
    expect(screen.getByText(/Same CPF, over the real map/)).toBeInTheDocument();

    // Moving the slider recomputes CPF client-side (no network call).
    const fetchCallsBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '20' } });
    await waitFor(() => {
      expect(screen.getByText(/CPF threshold: 20\.0/)).toBeInTheDocument();
    });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCallsBefore);
  });

  it('shows a clear empty state for a station/pollutant combination with no data', async () => {
    render(
      <AuthProvider authService={stubAuthService}>
        <HomePage />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText('Station'), { target: { value: 'NL00448' } });
    fireEvent.change(screen.getByLabelText('Pollutant'), { target: { value: 'NO2' } });

    expect(await screen.findByText(/No NO2 observations/)).toBeInTheDocument();
  });
});
