import { VegaEmbed } from 'react-vega';

import { CHART_SIZE } from '@/lib/windFingerprint/chartTheme';
import { buildCpfRoseSpec } from '@/lib/windFingerprint/cpfRoseSpec';
import type { CpfSectorValue } from '@/lib/windFingerprint/types';

const COMPASS_OVERLAY_CLASSES =
  'pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-wider text-ink-soft/70';

export function CpfRose({ values }: { values: CpfSectorValue[] }) {
  const spec = buildCpfRoseSpec(values);

  return (
    <div className="relative" style={{ width: CHART_SIZE, height: CHART_SIZE }}>
      <VegaEmbed spec={spec} options={{ actions: false, renderer: 'svg' }} />
      <div className={COMPASS_OVERLAY_CLASSES}>
        <span className="absolute top-0">N</span>
        <span className="absolute right-0">E</span>
        <span className="absolute bottom-0">S</span>
        <span className="absolute left-0">W</span>
      </div>
    </div>
  );
}
