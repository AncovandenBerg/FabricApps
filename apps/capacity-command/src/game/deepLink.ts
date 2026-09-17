// Resolving a `?week=<n>` deep link.
//
// The Practiworks track page lists this campaign's weeks and links each one
// directly, so a visitor can go straight at week 2 instead of arriving on the
// week list every time. This module decides what such a link should do.
//
// It is a pure function on purpose, in the same spirit as the engine: the
// interesting part is the refusals, and those are much easier to prove here
// than through an effect and a rendered screen.
//
// The rules, in order, and why each one exists:
//
//   1. No `week` parameter — the ordinary case. Boot normally.
//   2. Not a positive integer. A hand-edited or truncated URL should not
//      start something arbitrary.
//   3. Not a week this campaign configures. Same reasoning, and it keeps an
//      old link working sanely after a week is removed from campaign.json.
//   4. Locked. The unlock chain is the campaign's whole shape, and a URL is
//      not permission to skip it. The player lands on the week list, which
//      shows what is actually open.
//   5. A *different* week is already in flight. A half-played week must not
//      be thrown away by a link click — the same reasoning as picking a week
//      from the list, which resumes rather than restarts.
//
// Only after all five does the link start a week.

import { isWeekUnlocked, weekConfig } from './campaign';

/** Why a deep link was not acted on. */
export type WeekLinkRefusal =
  /** No `week` parameter in the URL. */
  | 'absent'
  /** Present, but not a positive integer. */
  | 'unparseable'
  /** Not a week `campaign.json` configures. */
  | 'unknown'
  /** A real week, but the player has not earned it yet. */
  | 'locked'
  /** A different week is already in flight and must not be discarded. */
  | 'busy';

export type WeekLinkAction =
  | { kind: 'ignore'; reason: WeekLinkRefusal }
  /** The linked week is the one already in progress: show it, do not restart. */
  | { kind: 'resume'; week: number }
  | { kind: 'start'; week: number };

export interface WeekLinkContext {
  /** Weeks the player has cleared, from their stored progress. */
  completedWeeks: readonly number[];
  /** The week currently in flight, if any. */
  activeWeek?: number | null;
}

/**
 * What a `?week=<n>` link should do.
 *
 * `search` is a location query string, with or without the leading `?`.
 */
export function resolveWeekLink(
  search: string,
  { completedWeeks, activeWeek = null }: WeekLinkContext
): WeekLinkAction {
  const raw = new URLSearchParams(search).get('week');
  if (raw === null) return { kind: 'ignore', reason: 'absent' };

  const requested = Number(raw.trim());
  // `Number('')` is 0 and `Number('2.5')` is not an integer, so both fall out
  // here rather than needing their own checks.
  if (!Number.isInteger(requested) || requested < 1) {
    return { kind: 'ignore', reason: 'unparseable' };
  }

  if (!weekConfig(requested)) return { kind: 'ignore', reason: 'unknown' };

  if (!isWeekUnlocked(requested, completedWeeks)) {
    return { kind: 'ignore', reason: 'locked' };
  }

  if (activeWeek != null) {
    return activeWeek === requested
      ? { kind: 'resume', week: requested }
      : { kind: 'ignore', reason: 'busy' };
  }

  return { kind: 'start', week: requested };
}
