// Campaign structure: which weeks exist and how each is balanced.
//
// The single source of truth is seed/campaign.json, which is also read by
// the seed scripts so content and structure cannot drift. To add, remove or
// rebalance a week, edit that file; nothing here needs changing. Scenario
// content lives in seed/scenarios.json, where every scenario carries a
// `week` field matching a `number` below.

import campaignJson from '../../seed/campaign.json';

export interface WeekConfig {
  number: number;
  title: string;
  subtitle: string;
  /** Days the week runs; drives the "Day 3/7" counter. */
  days: number;
  startingCu: number;
  startingSla: number;
}

/** Every configured week, ascending by number. */
export const WEEKS: WeekConfig[] = [...campaignJson.weeks].sort(
  (a, b) => a.number - b.number
);

export const FIRST_WEEK = WEEKS[0].number;

export function weekConfig(weekNumber: number): WeekConfig | undefined {
  return WEEKS.find((w) => w.number === weekNumber);
}

/**
 * Weeks unlock in order: the first week is always open, and every later
 * week needs its predecessor in the campaign list completed.
 */
export function isWeekUnlocked(
  weekNumber: number,
  completedWeeks: readonly number[]
): boolean {
  const index = WEEKS.findIndex((w) => w.number === weekNumber);
  if (index <= 0) return index === 0;
  return completedWeeks.includes(WEEKS[index - 1].number);
}

/**
 * The week the player lands on: the first unlocked week they have not
 * finished, falling back to the last unlocked week once the campaign is
 * complete (so a finished campaign is replayable rather than a dead end).
 */
export function nextWeek(completedWeeks: readonly number[]): WeekConfig {
  const unlocked = WEEKS.filter((w) => isWeekUnlocked(w.number, completedWeeks));
  return (
    unlocked.find((w) => !completedWeeks.includes(w.number)) ??
    unlocked[unlocked.length - 1] ??
    WEEKS[0]
  );
}

/** The week after this one, when it exists and is now unlocked. */
export function weekAfter(
  weekNumber: number,
  completedWeeks: readonly number[]
): WeekConfig | undefined {
  const index = WEEKS.findIndex((w) => w.number === weekNumber);
  const candidate = index >= 0 ? WEEKS[index + 1] : undefined;
  return candidate && isWeekUnlocked(candidate.number, completedWeeks)
    ? candidate
    : undefined;
}
