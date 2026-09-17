// The week's decisions, in the order they were made. Shared by the two
// end-of-week screens: the report for a week that was survived, the breach
// screen for one that was not.
import type { AttemptRecord, GameScenario } from '@/game/types';

interface DecisionListProps {
  attempts: AttemptRecord[];
  /** Used to show each decision's incident title rather than its code. */
  scenarios: GameScenario[];
}

export function DecisionList({ attempts, scenarios }: DecisionListProps) {
  const byCode = new Map(scenarios.map((s) => [s.code, s]));

  return (
    <ul className="mt-4 flex flex-col gap-1.5" data-testid="decision-list">
      {attempts.map((a, i) => (
        <li
          key={`${a.scenarioCode}-${i}`}
          className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2"
        >
          <span
            className={`font-display text-sm font-semibold ${
              a.correct ? 'text-accent' : 'text-bad'
            }`}
          >
            {a.correct ? '✓' : '✕'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-ink">
              {byCode.get(a.scenarioCode)?.title ?? a.scenarioCode}
            </span>
            <span className="block text-[10px] text-soft">
              Picked {a.chosenOptionKey} · {a.cuCost} CU ·{' '}
              {a.slaDelta > 0 ? `+${a.slaDelta}` : a.slaDelta} SLA
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
