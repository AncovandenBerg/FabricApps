// End of a week that was lost rather than survived: the capacity ran out and
// the run stopped there. It mirrors the report screen's shape so the two read
// as the same artifact, in the bad palette rather than the accent one, and it
// names the decision that did it. Nothing here unlocks anything.
import { useState } from 'react';

import { IconAlert, IconBack } from '@/components/bits';
import { DecisionList } from '@/components/DecisionList';
import { MasteryBars } from '@/components/MasteryBars';
import { weekConfig } from '@/game/campaign';
import { summarize, type Breach } from '@/game/engine';
import type { AttemptRecord, GameScenario } from '@/game/types';

interface BreachScreenProps {
  weekNumber: number;
  /** Day the run collapsed on, and the week's full length. */
  day: number;
  weekLength: number;
  sla: number;
  /** The decision that spent more capacity than the week had left. */
  breach: Breach;
  attempts: AttemptRecord[];
  /** Incidents still queued when the run ended. */
  remaining: number;
  /**
   * Whether an earlier run had already cleared this week. A lost replay does
   * not take that away, so the screen must not claim the week is unclear
   * while the campaign list shows it done.
   */
  alreadyCleared: boolean;
  scenarios: GameScenario[];
  onReplay: (weekNumber: number) => void;
  onHome: () => void;
}

/** How far in it happened, said flatly. */
function verdict(day: number, weekLength: number): string {
  const share = weekLength === 0 ? 0 : day / weekLength;
  if (share <= 0.34) {
    return 'You did not reach midweek. The handover note was right about you.';
  }
  if (share <= 0.67) return 'Finance has questions. The CTO has more.';
  return 'Close. The last stretch is the one that got you.';
}

export function BreachScreen({
  weekNumber,
  day,
  weekLength,
  sla,
  breach,
  attempts,
  remaining,
  alreadyCleared,
  scenarios,
  onReplay,
  onHome,
}: BreachScreenProps) {
  const [reviewing, setReviewing] = useState(false);
  const week = weekConfig(weekNumber);
  const fatal = scenarios.find((s) => s.code === breach.scenarioCode);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="breach-screen">
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
          Week {weekNumber} breach
        </div>
      </div>
      <div className="mx-5 h-px bg-line" />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-4">
        <div className="flex flex-col items-center text-center">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-bad">
            <IconAlert size={14} />
            Capacity breach
          </span>
          <h2 className="mt-1.5 font-display text-[29px] font-semibold leading-tight">
            The platform is down.
          </h2>
          <p className="text-xs text-shade" data-testid="breach-day">
            {week?.title ?? `Week ${weekNumber}`} · you ran out of capacity on
            day {day} of {weekLength}.
          </p>
          <p className="mt-0.5 text-[11px] italic text-soft">
            {verdict(day, weekLength)}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-bad/50 bg-bad-tint px-4 py-3">
          <div className="text-[9px] uppercase tracking-[0.08em] text-bad">
            The decision that did it
          </div>
          <p className="mt-1 text-sm leading-snug text-ink">
            {fatal?.title ?? breach.scenarioCode}
          </p>
          <p className="mt-1 text-[11px] text-shade" data-testid="breach-cost">
            {breach.scenarioCode} cost {breach.cost} CU. You had{' '}
            {breach.available}.
          </p>
        </div>

        <div className="mt-3 flex w-full gap-2.5">
          <div className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card">
            <div className="text-[9px] uppercase tracking-[0.08em] text-mute">
              Incidents handled
            </div>
            <div
              className="font-display text-[28px] font-semibold leading-none text-ink"
              data-testid="breach-handled"
            >
              {attempts.length}
            </div>
          </div>
          <div className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card">
            <div className="text-[9px] uppercase tracking-[0.08em] text-mute">
              Never reached
            </div>
            <div
              className="font-display text-[28px] font-semibold leading-none text-bad"
              data-testid="breach-remaining"
            >
              {remaining}
            </div>
          </div>
          <div className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card">
            <div className="text-[9px] uppercase tracking-[0.08em] text-mute">
              SLA score
            </div>
            <div className="font-display text-[28px] font-semibold leading-none text-ink">
              {sla}
            </div>
          </div>
        </div>

        {attempts.length > 0 && (
          <>
            <div className="mb-2.5 mt-5 text-[9px] uppercase tracking-[0.12em] text-mute">
              Mastery by exam domain, as far as you got
            </div>
            <MasteryBars entries={summarize(attempts)} />
          </>
        )}

        {reviewing && <DecisionList attempts={attempts} scenarios={scenarios} />}
      </div>

      <div className="flex flex-col gap-2 px-5 pb-5 pt-2">
        <p
          className={`text-center text-[11px] ${alreadyCleared ? 'text-soft' : 'text-bad'}`}
          data-testid="breach-locked"
        >
          {alreadyCleared
            ? `Week ${weekNumber} was already cleared, so nothing is lost. This run does not count.`
            : `Week ${weekNumber} is not cleared. Nothing new opens up.`}
        </p>
        <button
          type="button"
          onClick={() => setReviewing((r) => !r)}
          className="w-full rounded-xl border border-accent py-2.5 text-sm font-medium text-accent transition-colors hover:bg-tint"
        >
          {reviewing ? 'Hide decisions' : 'Review decisions'}
        </button>
        <button
          type="button"
          data-testid="breach-replay"
          onClick={() => onReplay(weekNumber)}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
        >
          Run week {weekNumber} again
        </button>
      </div>
    </div>
  );
}
