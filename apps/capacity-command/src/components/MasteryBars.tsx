// "Mastery by exam domain" bars from the mockups: single accent color,
// domain identity via the shape-encoded dot, values in text tokens.
import { DomainDot } from '@/components/bits';
import { domainMeta } from '@/game/domains';

export interface MasteryEntry {
  domain: string;
  percentage: number;
  correct?: number;
  total?: number;
}

export function MasteryBars({ entries }: { entries: MasteryEntry[] }) {
  return (
    <div className="flex w-full flex-col gap-3">
      {entries.map((e) => (
        <div key={e.domain}>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink">
              <DomainDot domain={e.domain} />
              {domainMeta(e.domain).short}
            </span>
            <span className="font-semibold text-shade">
              {e.percentage}%{' '}
              {e.total !== undefined && (
                <span className="text-[10px] font-normal text-soft">
                  {e.correct}/{e.total}
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-track">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${e.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
