// Campaign overview: every configured week with its lock state and best
// result. Weeks unlock in order, so a locked row says which week opens it.
// The list is driven entirely by seed/campaign.json.
import { IconCheck, IconLock, IconPlay } from '@/components/bits';
import { isWeekUnlocked, WEEKS } from '@/game/campaign';
import type { PlayerProgress } from '@/game/progress';

interface WeekListProps {
  progress: PlayerProgress;
  /** Week the player is currently on, highlighted as the live one. */
  currentWeek: number;
  /** Week with a run in flight, if any; starting another abandons it. */
  activeWeek: number | null;
  /** Incidents in each week, keyed by week number. */
  incidentCounts: Record<number, number>;
  onSelect: (weekNumber: number) => void;
}

export function WeekList({
  progress,
  currentWeek,
  activeWeek,
  incidentCounts,
  onSelect,
}: WeekListProps) {
  return (
    <ul className="flex flex-col gap-2" data-testid="week-list">
      {WEEKS.map((week, index) => {
        const unlocked = isWeekUnlocked(week.number, progress.completedWeeks);
        const done = progress.completedWeeks.includes(week.number);
        const best = progress.weekResults[week.number];
        const incidents = incidentCounts[week.number] ?? 0;
        const isCurrent = week.number === currentWeek;
        const previous = WEEKS[index - 1];
        // Starting a week while another is half-played throws that run away,
        // so say so on the row rather than losing it silently.
        const abandons =
          unlocked && activeWeek !== null && activeWeek !== week.number;

        return (
          <li key={week.number}>
            <button
              type="button"
              disabled={!unlocked}
              onClick={() => onSelect(week.number)}
              data-testid={`week-${week.number}`}
              className={`flex w-full items-center gap-3 rounded-2xl border bg-surface p-3.5 text-left shadow-card transition-colors ${
                unlocked
                  ? `hover:border-accent ${isCurrent ? 'border-accent' : 'border-line'}`
                  : 'cursor-not-allowed border-line opacity-60'
              }`}
            >
              <span
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full border-[1.5px] ${
                  unlocked ? 'border-accent text-accent' : 'border-soft text-soft'
                }`}
              >
                {done ? (
                  <IconCheck size={18} />
                ) : unlocked ? (
                  <IconPlay size={16} />
                ) : (
                  <IconLock size={16} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-[0.1em] text-accent">
                  Week {week.number}
                  {isCurrent && unlocked && !done ? ' · current' : ''}
                </span>
                <span className="block truncate font-display text-base font-semibold leading-tight text-ink">
                  {week.title}
                </span>
                <span
                  className={`block text-[11px] ${abandons ? 'text-bad' : 'text-mute'}`}
                >
                  {!unlocked
                    ? `Finish week ${previous?.number ?? week.number - 1} to unlock`
                    : abandons
                      ? `Starts fresh, drops week ${activeWeek} in progress`
                      : best
                        ? `Best ${best.correct}/${best.total} · ${week.days} days · ${week.startingCu} CU`
                        : `${week.days} days · ${incidents} incidents · ${week.startingCu} CU`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
