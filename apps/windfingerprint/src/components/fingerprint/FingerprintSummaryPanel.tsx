import type { FingerprintSummary } from '@/lib/windFingerprint/types';

function Readout({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-right font-mono text-sm font-medium text-ink">
        {value}
        {sub ? <span className="ml-1.5 font-sans text-xs font-normal text-ink-soft">{sub}</span> : null}
      </dd>
    </div>
  );
}

export function FingerprintSummaryPanel({ summary }: { summary: FingerprintSummary }) {
  return (
    <dl className="divide-y divide-ink/10 border-t border-ink/10">
      <Readout label="Observation hours" value={summary.validHours.toLocaleString()} />
      <Readout
        label="Calm hours excluded"
        value={summary.calmHoursExcluded === null ? 'unknown' : summary.calmHoursExcluded.toLocaleString()}
        sub={summary.calmHoursExcluded === null ? undefined : '< 0.5 m/s'}
      />
      <Readout label="Data coverage" value={`${summary.coveragePct}%`} />
      <Readout label="CPF threshold" value={`> ${summary.threshold} ${summary.unit}`} />
    </dl>
  );
}
