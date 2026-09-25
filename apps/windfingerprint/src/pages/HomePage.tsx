import { useEffect, useMemo, useState } from 'react';

import { CpfRose } from '@/components/fingerprint/CpfRose';
import { CpfRoseMap } from '@/components/fingerprint/CpfRoseMap';
import { FingerprintSummaryPanel } from '@/components/fingerprint/FingerprintSummaryPanel';
import { InterpretationHelp } from '@/components/fingerprint/InterpretationHelp';
import { PolarPlot } from '@/components/fingerprint/PolarPlot';
import { StationPicker } from '@/components/fingerprint/StationPicker';
import { useAuth } from '@/hooks/AuthContext';
import {
  computeCpf,
  loadFingerprintPayload,
  toGrid,
  toSummary,
  type FingerprintPayload,
} from '@/lib/windFingerprint/staticFingerprint';
import { STATIONS } from '@/lib/windFingerprint/stations';
import type { Pollutant } from '@/lib/windFingerprint/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; payload: FingerprintPayload };

function StatusPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="chart-paper rounded-sm border border-ink/10 bg-panel p-12 text-center text-sm text-ink-soft">
      {children}
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-sm border border-ink/10 bg-panel p-5">
      <h2 className="mb-3 self-start font-display text-sm font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

export function HomePage() {
  const { signOut } = useAuth();
  const [station, setStation] = useState(STATIONS[0]);
  const [pollutant, setPollutant] = useState<Pollutant>('NO2');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [threshold, setThreshold] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setThreshold(null);

    loadFingerprintPayload(station.eoi, pollutant)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) {
          setState({ status: 'empty' });
          return;
        }
        setState({ status: 'ready', payload });
        setThreshold(payload.defaultThreshold);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [station, pollutant]);

  const grid = useMemo(() => (state.status === 'ready' ? toGrid(state.payload) : []), [state]);
  const cpf = useMemo(
    () => (state.status === 'ready' && threshold !== null ? computeCpf(state.payload, threshold) : []),
    [state, threshold]
  );
  const summary = useMemo(
    () => (state.status === 'ready' && threshold !== null ? toSummary(state.payload, threshold) : null),
    [state, threshold]
  );

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b border-ink/10 bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">WindFingerprint</h1>
            <p className="mt-0.5 text-xs text-paper/55">
              Source attribution for pan-European air quality
            </p>
          </div>
          <button
            onClick={() => void signOut()}
            className="text-xs text-paper/50 transition-colors hover:text-paper"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:items-start">
        <aside className="rounded-sm border border-ink/10 bg-panel p-5 lg:sticky lg:top-8">
          <StationPicker
            stations={STATIONS}
            station={station}
            onStationChange={setStation}
            pollutant={pollutant}
            onPollutantChange={setPollutant}
          />

          {state.status === 'ready' && summary && (
            <div className="mt-5">
              <FingerprintSummaryPanel summary={summary} />
            </div>
          )}
        </aside>

        <main className="min-w-0">
          {state.status === 'loading' && (
            <StatusPanel>Loading fingerprint for {station.name}…</StatusPanel>
          )}

          {state.status === 'error' && (
            <div className="rounded-sm border border-red-200 bg-red-50 p-8 text-sm text-red-800">
              <p className="font-medium">Couldn&apos;t load the fingerprint.</p>
              <p className="mt-1 text-red-700">{state.message}</p>
            </div>
          )}

          {state.status === 'empty' && (
            <StatusPanel>
              No {pollutant} observations for {station.name}.
            </StatusPanel>
          )}

          {state.status === 'ready' && summary && threshold !== null && (
            <div className="rounded-sm border border-ink/10 bg-panel p-5">
              <label className="flex flex-col gap-3 text-sm">
                <span className="font-mono text-ink">
                  CPF threshold: {threshold.toFixed(1)} {summary.unit}
                </span>
                <input
                  type="range"
                  className="instrument-slider w-full"
                  min={state.payload.histogram.edges[0]}
                  max={state.payload.histogram.edges[state.payload.histogram.edges.length - 1]}
                  step={0.1}
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                />
                <span className="text-xs text-ink-soft">
                  Defaults to the 90th percentile ({state.payload.defaultThreshold} {summary.unit}). CPF
                  values below are a linear-interpolation approximation from a precomputed histogram, not
                  a live recalculation over raw hours.
                </span>
              </label>
            </div>
          )}

          {state.status === 'ready' && summary && threshold !== null && (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ChartPanel title="Bivariate polar plot">
                <PolarPlot cells={grid} unit={summary.unit} />
              </ChartPanel>
              <ChartPanel title="Conditional probability function">
                <CpfRose values={cpf} />
              </ChartPanel>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="mt-6 rounded-sm border border-ink/10 bg-panel p-5">
              <h2 className="font-display text-sm font-semibold text-ink">
                Same CPF, over the real map
              </h2>
              <p className="mb-3 mt-1 text-xs text-ink-soft">
                The rose above, redrawn over the streets around {station.name} — drag or scroll to look
                for what actually sits in the direction it points to.
              </p>
              <CpfRoseMap station={station} values={cpf} />
            </div>
          )}

          <div className="mt-6">
            <InterpretationHelp />
          </div>
        </main>
      </div>
    </div>
  );
}
