// Stats tab: lifetime readiness across all completed weeks.
import { Ring } from '@/components/bits';
import { MasteryBars } from '@/components/MasteryBars';
import { WEEKS } from '@/game/campaign';
import { readinessPercent, type PlayerProgress } from '@/game/progress';

export function StatsScreen({ progress }: { progress: PlayerProgress }) {
  const readiness = readinessPercent(progress);
  const totals = Object.values(progress.domainTotals);
  const decisions = totals.reduce((n, t) => n + t.total, 0);
  const correct = totals.reduce((n, t) => n + t.correct, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-accent">
        Lifetime record
      </div>
      <h2 className="mt-1 font-display text-[27px] font-semibold leading-none">
        Your readiness
      </h2>

      {decisions === 0 ? (
        <p className="mt-4 text-sm text-mute">
          No completed weeks yet. Survive one and your per-domain readiness
          shows up here.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Ring
              percent={readiness}
              size={110}
              strokeWidth={8}
              value={`${readiness}%`}
              caption="READY"
            />
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-mute">
                  Campaign
                </div>
                <div className="font-display text-2xl font-semibold leading-none">
                  {progress.completedWeeks.length}
                  <span className="text-base text-soft">
                    {' '}
                    / {WEEKS.length} weeks cleared
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-mute">
                  Decisions
                </div>
                <div className="font-display text-2xl font-semibold leading-none">
                  {correct}
                  <span className="text-base text-soft"> / {decisions} correct</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-2.5 mt-5 text-[9px] uppercase tracking-[0.12em] text-mute">
            Mastery by exam domain
          </div>
          <MasteryBars
            entries={Object.entries(progress.domainTotals).map(([domain, t]) => ({
              domain,
              percentage: t.total === 0 ? 0 : Math.round((t.correct / t.total) * 100),
              correct: t.correct,
              total: t.total,
            }))}
          />

          <div className="mb-2.5 mt-5 text-[9px] uppercase tracking-[0.12em] text-mute">
            Best run per week
          </div>
          <ul className="flex flex-col gap-1.5">
            {WEEKS.map((week) => {
              const best = progress.weekResults[week.number];
              return (
                <li
                  key={week.number}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-ink">
                      Week {week.number} · {week.title}
                    </span>
                    <span className="block text-[10px] text-soft">
                      {best
                        ? `${best.correct}/${best.total} correct · ${best.cu} CU left · SLA ${best.sla}`
                        : 'Not completed yet'}
                    </span>
                  </span>
                  {best && (
                    <span className="font-display text-sm font-semibold text-accent">
                      {Math.round((best.correct / Math.max(1, best.total)) * 100)}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
