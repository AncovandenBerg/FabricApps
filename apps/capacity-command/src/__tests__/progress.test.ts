import { describe, expect, it } from 'vitest';

import { WEEKS } from '@/game/campaign';
import type { SavedGame } from '@/game/engine';
import {
  clearProgress,
  emptyProgress,
  loadProgress,
  readinessPercent,
  recordWeek,
  saveProgress,
  type PlayerProgress,
} from '@/game/progress';
import type { AttemptRecord } from '@/game/types';

const USER = 'guest-test';

function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    scenarioCode: 'S01',
    weekNumber: 1,
    domain: 'implement-manage',
    objective: 'obj',
    chosenOptionKey: 'A',
    correct: true,
    cuCost: 0,
    slaDelta: 0,
    secondsToDecide: 1,
    ...overrides,
  };
}

function savedGame(): SavedGame {
  return {
    week: 1,
    cu: 0,
    sla: 60,
    day: 1,
    phase: 'feedback',
    currentCode: 'S01',
    pendingCodes: ['S02'],
    chainedCodes: [],
    lastAttempt: null,
    attempts: [],
  };
}

describe('recordWeek on a breach', () => {
  const attempts = [attempt(), attempt({ correct: false, scenarioCode: 'S02' })];

  it('clears nothing, so the next week stays locked', () => {
    const after = recordWeek(emptyProgress(), 1, attempts, 0, 60, 'breached');
    expect(after.completedWeeks).toEqual([]);
    expect(after.weeksCompleted).toBe(0);
    expect(after.weekResults).toEqual({});
  });

  it('counts the breach against the week', () => {
    let after = recordWeek(emptyProgress(), 2, attempts, 0, 60, 'breached');
    expect(after.weekBreaches).toEqual({ 2: 1 });
    after = recordWeek(after, 2, attempts, 0, 40, 'breached');
    expect(after.weekBreaches).toEqual({ 2: 2 });
  });

  it('keeps the domain tallies, because the decisions still happened', () => {
    const after = recordWeek(emptyProgress(), 1, attempts, 0, 60, 'breached');
    expect(after.domainTotals).toEqual({
      'implement-manage': { total: 2, correct: 1 },
    });
    expect(readinessPercent(after)).toBe(50);
  });

  it('drops the in-flight run so a breached week cannot be resumed', () => {
    const before: PlayerProgress = {
      ...emptyProgress(),
      active: { sessionId: 's1', game: savedGame() },
    };
    expect(recordWeek(before, 1, attempts, 0, 60, 'breached').active).toBeUndefined();
  });

  it('still clears the week when the run was survived', () => {
    const after = recordWeek(emptyProgress(), 1, attempts, 30, 60, 'completed');
    expect(after.completedWeeks).toEqual([1]);
    expect(after.weekBreaches).toEqual({});
  });
});

describe('loadProgress', () => {
  it('returns an empty record for a new player', () => {
    expect(loadProgress(USER)).toEqual({
      weeksCompleted: 0,
      completedWeeks: [],
      weekResults: {},
      weekBreaches: {},
      domainTotals: {},
      examDate: undefined,
      active: undefined,
    });
  });

  it('round-trips a saved record', () => {
    const progress: PlayerProgress = {
      weeksCompleted: 2,
      completedWeeks: [1, 2],
      weekResults: { 1: { correct: 14, total: 15, cu: 40, sla: 120 } },
      weekBreaches: { 2: 1 },
      domainTotals: { 'ingest-transform': { total: 10, correct: 8 } },
      examDate: '2026-09-30',
    };
    saveProgress(USER, progress);
    expect(loadProgress(USER)).toEqual({ ...progress, active: undefined });
  });

  it('survives a corrupt record instead of throwing', () => {
    localStorage.setItem(`capacity-command:${USER}`, 'not json');
    expect(loadProgress(USER).completedWeeks).toEqual([]);
  });

  it('clears a record on request', () => {
    saveProgress(USER, { ...emptyProgress(), weeksCompleted: 3 });
    clearProgress(USER);
    expect(loadProgress(USER).weeksCompleted).toBe(0);
  });
});

describe('migrating progress saved before the campaign existed', () => {
  /** Exactly the shape the previous build wrote: no campaign fields. */
  function writeLegacy(weeksCompleted: number): void {
    localStorage.setItem(
      `capacity-command:${USER}`,
      JSON.stringify({
        weeksCompleted,
        domainTotals: { 'implement-manage': { total: 15, correct: 12 } },
        examDate: '2026-10-01',
      })
    );
  }

  it('treats a played week as week 1 cleared, so week 2 opens', () => {
    writeLegacy(1);
    const progress = loadProgress(USER);
    expect(progress.completedWeeks).toEqual([1]);
    expect(progress.weeksCompleted).toBe(1);
  });

  it('keeps a player who never finished a week locked to week 1', () => {
    writeLegacy(0);
    expect(loadProgress(USER).completedWeeks).toEqual([]);
  });

  it('keeps lifetime tallies and the exam date rather than resetting them', () => {
    writeLegacy(3);
    const progress = loadProgress(USER);
    expect(progress.domainTotals).toEqual({
      'implement-manage': { total: 15, correct: 12 },
    });
    expect(progress.examDate).toBe('2026-10-01');
    expect(readinessPercent(progress)).toBe(80);
  });

  it('defaults the new best-result map rather than leaving it undefined', () => {
    writeLegacy(2);
    expect(loadProgress(USER).weekResults).toEqual({});
  });
});

describe('recordWeek', () => {
  const attempts = [
    attempt({ scenarioCode: 'S01', correct: true }),
    attempt({ scenarioCode: 'S02', correct: false }),
    attempt({ scenarioCode: 'S03', domain: 'monitor-optimize', correct: true }),
  ];

  it('marks the campaign week cleared, which unlocks the next one', () => {
    const next = recordWeek(emptyProgress(), 1, attempts, 55, 110);
    expect(next.completedWeeks).toEqual([1]);
    expect(next.weeksCompleted).toBe(1);
    expect(next.active).toBeUndefined();
  });

  it('records the week result and folds domain tallies in', () => {
    const next = recordWeek(emptyProgress(), 2, attempts, 55, 110);
    expect(next.weekResults[2]).toEqual({
      correct: 2,
      total: 3,
      cu: 55,
      sla: 110,
    });
    expect(next.domainTotals).toEqual({
      'implement-manage': { total: 2, correct: 1 },
      'monitor-optimize': { total: 1, correct: 1 },
    });
  });

  it('keeps cleared weeks replayable without duplicating them', () => {
    const once = recordWeek(emptyProgress(), 1, attempts, 55, 110);
    const twice = recordWeek(once, 1, attempts, 20, 90);
    expect(twice.completedWeeks).toEqual([1]);
    // Replays still count as activity
    expect(twice.weeksCompleted).toBe(2);
  });

  it('keeps the better result when a cleared week is replayed', () => {
    const good = recordWeek(emptyProgress(), 1, attempts, 55, 110);
    const worse = recordWeek(good, 1, [attempt({ correct: false })], 5, 40);
    expect(worse.weekResults[1]).toEqual({
      correct: 2,
      total: 3,
      cu: 55,
      sla: 110,
    });
  });

  it('replaces the result when a replay is better', () => {
    const poor = recordWeek(emptyProgress(), 1, [attempt({ correct: false })], 5, 40);
    const better = recordWeek(poor, 1, [attempt({ correct: true })], 80, 130);
    expect(better.weekResults[1]).toEqual({
      correct: 1,
      total: 1,
      cu: 80,
      sla: 130,
    });
  });

  it('keeps completed weeks sorted when they are cleared out of order', () => {
    let progress = recordWeek(emptyProgress(), 1, attempts, 50, 100);
    progress = recordWeek(progress, 3, attempts, 50, 100);
    progress = recordWeek(progress, 2, attempts, 50, 100);
    expect(progress.completedWeeks).toEqual([1, 2, 3]);
  });

  it('tracks a best result for every configured week', () => {
    let progress = emptyProgress();
    for (const week of WEEKS) {
      progress = recordWeek(progress, week.number, attempts, 50, 100);
    }
    expect(Object.keys(progress.weekResults).map(Number)).toEqual(
      WEEKS.map((w) => w.number)
    );
    expect(progress.completedWeeks).toEqual(WEEKS.map((w) => w.number));
  });
});
