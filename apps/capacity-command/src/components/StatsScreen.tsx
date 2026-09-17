// Stats tab: lifetime readiness, plus the per-week curve across the
// campaign. The curve is the point of tracking a best result per week:
// a single lifetime average hides whether the harder later weeks are
// actually landing.
import { Ring } from '@/components/bits';
import { MasteryBars } from '@/components/MasteryBars';
import { WEEKS } from '@/game/campaign';
import { readinessPercent, type PlayerProgress } from '@/game/progress';

/** Best-run correct percentage per configured week, weeks unplayed omitted. */
function weekCurve(progress: PlayerProgress) {
  return WEEKS.map((week) => {
    const best = progress.weekResults[week.number];
    return {
      week,
      best,
      percentage:
        best && best.total > 0
          ? Math.round((best.correct / best.total) * 100)
          : null,
    };
  });
}

export function StatsScreen({ progress }: { progress: PlayerProgress }) {
  const readiness = readinessPercent(progress);
  const totals = Object.values(progress.domainTotals);
  const decisions = totals.reduce((n, t) => n + t.total, 0);
  const correct = totals.reduce((n, t) => n + t.correct, 0);
  const curve = weekCurve(progress);
  const played = curve.filter((entry) => entry.percentage !== null);

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
                  Weeks cleared
                </div>
                <div className="font-display text-2xl font-semibold leading-none">
                  {progress.completedWeeks.length}
                  <span className="text-base text-soft"> / {WEEKS.length}</span>
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

          {/* Per-week curve: best run per week, in campaign order */}
          <div className="mb-2.5 mt-5 flex items-baseline justify-between">
            <div className="text-[9px] uppercase tracking-[0.12em] text-mute">
              Best run per week
            </div>
            <div className="text-[11px] text-soft">
              {played.length}/{WEEKS.length} played
            </div>
          </div>
          <div className="flex flex-col gap-3" data-testid="week-curve">
            {curve.map(({ week, best, percentage }) => (
              <div key={week.number}>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="min-w-0 truncate text-ink">
                    W{week.number} · {week.title}
                  </span>
                  {percentage === null ? (
                    <span className="flex-none text-[10px] text-soft">
                      not played
                    </span>
                  ) : (
                    <span className="flex-none font-semibold text-shade">
                      {percentage}%{' '}
                      <span className="text-[10px] font-normal text-soft">
                        {best?.correct}/{best?.total} · {best?.cu} CU
                      </span>
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-track">
                  <div
                    className={`h-full rounded-full ${
                      percentage === null ? 'bg-track' : 'bg-accent'
                    }`}
                    style={{ width: `${percentage ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
