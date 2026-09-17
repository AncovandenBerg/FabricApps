// End-of-week report from the mockups: correct-percentage ring, CU/SLA
// tiles, per-domain mastery, a review list of the week's decisions. The
// report closes by naming the week this run just unlocked, so the campaign
// leads straight into its next chapter.
import { useState } from 'react';

import { IconBack, Ring } from '@/components/bits';
import { DecisionList } from '@/components/DecisionList';
import { MasteryBars } from '@/components/MasteryBars';
import { weekConfig, type WeekConfig } from '@/game/campaign';
import { summarize } from '@/game/engine';
import type { AttemptRecord, GameScenario } from '@/game/types';

interface ReportScreenProps {
  /** Campaign week that was just finished. */
  weekNumber: number;
  cu: number;
  sla: number;
  attempts: AttemptRecord[];
  scenarios: GameScenario[];
  /** The week this run just unlocked, when there is one. */
  unlockedWeek?: WeekConfig;
  onPlayWeek: (weekNumber: number) => void;
  onHome: () => void;
}

/** Playful performance rank from the share of correct decisions. */
function rank(correct: number, total: number): string {
  const share = total === 0 ? 0 : correct / total;
  if (share >= 0.9) return 'Platform hero. The CTO knows your name.';
  if (share >= 0.7) return 'Solid operator. The pager stayed quiet, mostly.';
  if (share >= 0.5) return 'You survived. So did most of the pipelines.';
  return 'HR has scheduled a "growth conversation".';
}

export function ReportScreen({
  weekNumber,
  cu,
  sla,
  attempts,
  scenarios,
  unlockedWeek,
  onPlayWeek,
  onHome,
}: ReportScreenProps) {
  const [reviewing, setReviewing] = useState(false);
  const correctTotal = attempts.filter((a) => a.correct).length;
  const percent =
    attempts.length === 0 ? 0 : Math.round((correctTotal / attempts.length) * 100);
  const week = weekConfig(weekNumber);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center px-5 py-2">
        <button
          type="button"
          onClick={onHome}
          aria-label="Back to home"
          className="text-shade hover:text-ink"
        >
          <IconBack size={22} />
        </button>
        <div className="mr-[22px] flex-1 text-center font-display text-sm font-semibold tracking-wide">
          Week {weekNumber} report
        </div>
      </div>
      <div className="mx-5 h-px bg-line" />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-4">
        <div className="flex flex-col items-center">
          <h2 className="font-display text-[29px] font-semibold leading-tight">
            Week survived.
          </h2>
          <p className="text-xs text-shade">
            {week?.title ?? `Week ${weekNumber}`} · {correctTotal} of{' '}
            {attempts.length} decisions correct.
          </p>
          <p className="mt-0.5 text-[11px] italic text-soft">
            {rank(correctTotal, attempts.length)}
          </p>

          <div className="my-3">
            <Ring
              percent={percent}
              size={148}
              strokeWidth={9}
              value={`${percent}%`}
              caption="CORRECT"
            />
          </div>
        </div>

        <div className="flex w-full gap-2.5">
          <div className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card">
            <div className="text-[9px] uppercase tracking-[0.08em] text-mute">
              Capacity Units left
            </div>
            <div
              className="font-display text-[28px] font-semibold leading-none text-accent"
              data-testid="final-cu"
            >
              {cu}
            </div>
          </div>
          <div className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card">
            <div className="text-[9px] uppercase tracking-[0.08em] text-mute">
              SLA score
            </div>
            <div
              className="font-display text-[28px] font-semibold leading-none text-accent"
              data-testid="final-sla"
            >
              {sla}
            </div>
          </div>
        </div>

        <div className="mb-2.5 mt-5 text-[9px] uppercase tracking-[0.12em] text-mute">
          Mastery by exam domain
        </div>
        <MasteryBars entries={summarize(attempts)} />

        {reviewing && <DecisionList attempts={attempts} scenarios={scenarios} />}
      </div>

      <div className="flex flex-col gap-2 px-5 pb-5 pt-2">
        {unlockedWeek && (
          <p className="text-center text-[11px] text-accent" data-testid="report-unlocked">
            Week {unlockedWeek.number} unlocked: {unlockedWeek.title}
          </p>
        )}
        <button
          type="button"
          onClick={() => setReviewing((r) => !r)}
          className="w-full rounded-xl border border-accent py-2.5 text-sm font-medium text-accent transition-colors hover:bg-tint"
        >
          {reviewing ? 'Hide decisions' : 'Review decisions'}
        </button>
        <button
          type="button"
          data-testid="report-next"
          onClick={() => onPlayWeek(unlockedWeek?.number ?? weekNumber)}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
        >
          {unlockedWeek
            ? `Start week ${unlockedWeek.number}`
            : `Replay week ${weekNumber}`}
        </button>
      </div>
    </div>
  );
}
