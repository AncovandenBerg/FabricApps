// Local, per-player progress that outlives a page load: the running week
// (so it can be resumed), which campaign weeks are cleared, the best result
// per week, lifetime per-domain tallies and the exam date for the countdown
// card. Telemetry (Session, AttemptEvent) stays the analytical source of
// truth; this is UX state.

import type { SavedGame } from './engine';

import type { AttemptRecord } from './types';

export interface DomainTally {
  total: number;
  correct: number;
}

export interface ActiveWeek {
  sessionId: string | null;
  game: SavedGame;
}

/** Best run recorded for a campaign week, shown on the week list. */
export interface WeekResult {
  correct: number;
  total: number;
  cu: number;
  sla: number;
}

/** How a run ended. A breach is a week lost to running out of capacity. */
export type WeekOutcome = 'completed' | 'breached';

export interface PlayerProgress {
  /** Weeks finished, counting replays. Lifetime activity, not progression. */
  weeksCompleted: number;
  /** Distinct campaign weeks finished; this is what unlocks the next one. */
  completedWeeks: number[];
  /** Best result per campaign week, keyed by week number. */
  weekResults: Record<number, WeekResult>;
  /** Times each week has been lost to a capacity breach, keyed by week. */
  weekBreaches: Record<number, number>;
  domainTotals: Record<string, DomainTally>;
  /** ISO date (yyyy-mm-dd) of the planned DP-700 exam, if the player set one. */
  examDate?: string;
  active?: ActiveWeek;
}

const EMPTY: PlayerProgress = {
  weeksCompleted: 0,
  completedWeeks: [],
  weekResults: {},
  weekBreaches: {},
  domainTotals: {},
};

function storageKey(userId: string): string {
  return `capacity-command:${userId}`;
}

/**
 * Read this player's progress, upgrading anything saved by an earlier build
 * rather than discarding it. Progress from before the campaign existed only
 * knew "week 1, replayed N times", so a non-zero count means week 1 was
 * cleared and week 2 should be unlocked on the player's next visit.
 */
export function loadProgress(userId: string): PlayerProgress {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const weeksCompleted = parsed.weeksCompleted ?? 0;
    return {
      weeksCompleted,
      completedWeeks: parsed.completedWeeks ?? (weeksCompleted > 0 ? [1] : []),
      weekResults: parsed.weekResults ?? {},
      weekBreaches: parsed.weekBreaches ?? {},
      domainTotals: parsed.domainTotals ?? {},
      examDate: parsed.examDate,
      active: parsed.active,
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function saveProgress(userId: string, progress: PlayerProgress): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(progress));
  } catch {
    // Storage full or blocked: the game still works, resume just won't.
  }
}

/**
 * Fold a finished week into lifetime history, mark that campaign week
 * cleared (which unlocks the next one) and clear the active week. Cleared
 * weeks stay replayable, and a replay keeps whichever result was better.
 *
 * A breached week is a week lost, so it clears nothing and unlocks nothing:
 * only the breach count and the domain tallies are kept. Keeping the tallies
 * is deliberate. The decisions were still made and still say something about
 * what the player knows, so a lost week still moves the readiness figure.
 */
export function recordWeek(
  progress: PlayerProgress,
  weekNumber: number,
  attempts: AttemptRecord[],
  finalCu: number,
  finalSla: number,
  outcome: WeekOutcome = 'completed'
): PlayerProgress {
  const domainTotals: Record<string, DomainTally> = { ...progress.domainTotals };
  for (const a of attempts) {
    const t = domainTotals[a.domain] ?? { total: 0, correct: 0 };
    domainTotals[a.domain] = {
      total: t.total + 1,
      correct: t.correct + (a.correct ? 1 : 0),
    };
  }

  if (outcome === 'breached') {
    return {
      ...progress,
      weekBreaches: {
        ...progress.weekBreaches,
        [weekNumber]: (progress.weekBreaches[weekNumber] ?? 0) + 1,
      },
      domainTotals,
      active: undefined,
    };
  }

  const share = (c: number, t: number) => (t === 0 ? 0 : c / t);
  const correct = attempts.filter((a) => a.correct).length;
  const previous = progress.weekResults[weekNumber];
  const improved =
    !previous ||
    share(correct, attempts.length) > share(previous.correct, previous.total);

  return {
    ...progress,
    weeksCompleted: progress.weeksCompleted + 1,
    completedWeeks: progress.completedWeeks.includes(weekNumber)
      ? progress.completedWeeks
      : [...progress.completedWeeks, weekNumber].sort((a, b) => a - b),
    weekResults: {
      ...progress.weekResults,
      [weekNumber]: improved
        ? { correct, total: attempts.length, cu: finalCu, sla: finalSla }
        : previous,
    },
    domainTotals,
    active: undefined,
  };
}

/** Lifetime correct share (0..100) across all domains; 0 when unplayed. */
export function readinessPercent(progress: PlayerProgress): number {
  let total = 0;
  let correct = 0;
  for (const t of Object.values(progress.domainTotals)) {
    total += t.total;
    correct += t.correct;
  }
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

/** Whole days until the exam date, or null when unset/past. */
export function daysToExam(progress: PlayerProgress, now: Date): number | null {
  if (!progress.examDate) return null;
  const exam = new Date(`${progress.examDate}T00:00:00`);
  const days = Math.ceil((exam.getTime() - now.getTime()) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

/** Erase a player's saved progress (used by the reset action in the profile). */
export function clearProgress(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/** A fresh, empty progress record (used after a reset). */
export function emptyProgress(): PlayerProgress {
  return structuredClone(EMPTY);
}
