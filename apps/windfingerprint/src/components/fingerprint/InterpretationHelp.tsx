export function InterpretationHelp() {
  return (
    <details className="rounded-sm border border-ink/10 bg-panel p-5 text-sm text-ink-soft">
      <summary className="cursor-pointer font-display text-sm font-semibold text-ink">
        How to read a fingerprint
      </summary>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="font-medium text-ink">Bivariate polar plot</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Elevated values concentrated at the centre (low wind speed) mean a local source close to
              the station.
            </li>
            <li>
              An elevated lobe at high wind speed in one sector means a distant point source or regional
              transport from that direction.
            </li>
            <li>
              A uniform elevated ring at high wind speed means regional background rather than a single
              source.
            </li>
            <li>Grey cells have fewer than the minimum hours to trust the mean.</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink">Conditional probability function rose</p>
          <p className="mt-2">
            For each sector, CPF is the share of hours from that direction where concentration exceeded
            the threshold. The sectors reaching furthest out point at the source &mdash; this is the
            sharper attribution tool of the two.
          </p>
        </div>
      </div>
    </details>
  );
}
