// The `?week=<n>` deep link the Practiworks track page uses.
//
// Most of the value here is in the refusals: the link must not start an
// arbitrary week, must not skip the unlock chain, and must not discard a week
// already in flight. Each of those is a one-line rule that is easy to break
// later, so each gets its own case.
//
// These run against the real campaign.json rather than a fixture, because the
// question "is week 2 a week" is precisely the thing being asserted.
import { describe, expect, it } from 'vitest';

import { WEEKS } from '@/game/campaign';
import { resolveWeekLink } from '@/game/deepLink';

const [week1, week2, week3] = WEEKS;

describe('resolveWeekLink', () => {
  it('ignores a URL with no week parameter', () => {
    expect(resolveWeekLink('', { completedWeeks: [] })).toEqual({
      kind: 'ignore',
      reason: 'absent',
    });
    expect(resolveWeekLink('?utm_source=linkedin', { completedWeeks: [] })).toEqual({
      kind: 'ignore',
      reason: 'absent',
    });
  });

  it.each([
    ['empty', '?week='],
    ['not a number', '?week=abc'],
    ['zero', '?week=0'],
    ['negative', '?week=-1'],
    ['fractional', '?week=2.5'],
  ])('refuses a week parameter that is %s', (_label, search) => {
    expect(resolveWeekLink(search, { completedWeeks: [] })).toEqual({
      kind: 'ignore',
      reason: 'unparseable',
    });
  });

  it('refuses a week the campaign does not configure', () => {
    expect(resolveWeekLink('?week=99', { completedWeeks: [] })).toEqual({
      kind: 'ignore',
      reason: 'unknown',
    });
  });

  it('starts the first week, which is always unlocked', () => {
    expect(resolveWeekLink(`?week=${week1.number}`, { completedWeeks: [] })).toEqual({
      kind: 'start',
      week: week1.number,
    });
  });

  it('refuses a later week the player has not earned', () => {
    expect(resolveWeekLink(`?week=${week2.number}`, { completedWeeks: [] })).toEqual({
      kind: 'ignore',
      reason: 'locked',
    });
    expect(resolveWeekLink(`?week=${week3.number}`, { completedWeeks: [week1.number] })).toEqual({
      kind: 'ignore',
      reason: 'locked',
    });
  });

  it('starts a later week once its predecessor is cleared', () => {
    expect(
      resolveWeekLink(`?week=${week2.number}`, { completedWeeks: [week1.number] })
    ).toEqual({ kind: 'start', week: week2.number });
  });

  it('resumes rather than restarts when the link names the week in flight', () => {
    expect(
      resolveWeekLink(`?week=${week1.number}`, {
        completedWeeks: [],
        activeWeek: week1.number,
      })
    ).toEqual({ kind: 'resume', week: week1.number });
  });

  it('refuses to abandon a different week already in flight', () => {
    expect(
      resolveWeekLink(`?week=${week2.number}`, {
        completedWeeks: [week1.number],
        activeWeek: week1.number,
      })
    ).toEqual({ kind: 'ignore', reason: 'busy' });
  });

  it('reads the parameter alongside others, and without a leading ?', () => {
    expect(
      resolveWeekLink(`utm_source=site&week=${week2.number}`, {
        completedWeeks: [week1.number],
      })
    ).toEqual({ kind: 'start', week: week2.number });
  });

  it('tolerates surrounding whitespace, which links pick up when wrapped', () => {
    expect(resolveWeekLink('?week=%20' + week1.number + '%20', { completedWeeks: [] })).toEqual({
      kind: 'start',
      week: week1.number,
    });
  });
});
