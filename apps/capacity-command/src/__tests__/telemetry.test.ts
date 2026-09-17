import { describe, expect, it } from 'vitest';

import {
  createTelemetry,
  readTelemetry,
  clearTelemetry,
  exportTelemetry,
} from '@/game/telemetry';
import type { AttemptRecord } from '@/game/types';

const USER = 'guest-test';
const KEY = 'capacity-command:telemetry';

function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    scenarioCode: 'W2S01',
    weekNumber: 2,
    domain: 'ingest-transform',
    objective: 'obj',
    chosenOptionKey: 'B',
    correct: true,
    cuCost: 5,
    slaDelta: 5,
    secondsToDecide: 9,
    ...overrides,
  };
}

describe('session records', () => {
  it('stores the week and its opening balance, not a hardcoded 100', async () => {
    const telemetry = createTelemetry();
    const id = await telemetry.startSession(USER, {
      weekNumber: 3,
      startingCu: 80,
      startingSla: 100,
      startingDay: 1,
    });
    expect(id).toBeTruthy();

    const [session] = readTelemetry().sessions;
    expect(session).toMatchObject({
      id,
      userId: USER,
      weekNumber: 3,
      cuRemaining: 80,
      slaScore: 100,
      currentDay: 1,
      completed: false,
      completedAt: null,
    });
  });

  it('keeps CU, SLA and day current as the week runs', async () => {
    const telemetry = createTelemetry();
    const id = (await telemetry.startSession(USER, {
      weekNumber: 2,
      startingCu: 90,
      startingSla: 100,
      startingDay: 1,
    }))!;
    await telemetry.syncSession(id, { cuRemaining: 61, slaScore: 85, currentDay: 4 });

    expect(readTelemetry().sessions[0]).toMatchObject({
      weekNumber: 2,
      cuRemaining: 61,
      slaScore: 85,
      currentDay: 4,
    });
  });

  it('marks the session completed at end of week', async () => {
    const telemetry = createTelemetry();
    const id = (await telemetry.startSession(USER, {
      weekNumber: 1,
      startingCu: 100,
      startingSla: 100,
      startingDay: 1,
    }))!;
    await telemetry.completeSession(id, {
      cuRemaining: 30,
      slaScore: 140,
      currentDay: 7,
    });

    const [session] = readTelemetry().sessions;
    expect(session.completed).toBe(true);
    expect(session.completedAt).not.toBeNull();
  });
});

describe('attempt records', () => {
  it('carries weekNumber on the event itself, so the table needs no joins', async () => {
    const telemetry = createTelemetry();
    const id = (await telemetry.startSession(USER, {
      weekNumber: 2,
      startingCu: 90,
      startingSla: 100,
      startingDay: 1,
    }))!;
    await telemetry.recordAttempt(id, USER, attempt());

    const [row] = readTelemetry().attempts;
    expect(row).toMatchObject({
      sessionId: id,
      userId: USER,
      scenarioCode: 'W2S01',
      weekNumber: 2,
      domain: 'ingest-transform',
      objective: 'obj',
      correct: true,
      secondsToDecide: 9,
    });
    expect(row.createdAt).toBeTruthy();
  });

  it('supports slicing mastery per week from that one table', async () => {
    const telemetry = createTelemetry();
    for (const week of [1, 2, 3]) {
      const id = (await telemetry.startSession(USER, {
        weekNumber: week,
        startingCu: 100,
        startingSla: 100,
        startingDay: 1,
      }))!;
      // One right, one wrong in week 1; all right later on
      await telemetry.recordAttempt(id, USER, attempt({ weekNumber: week, correct: true }));
      await telemetry.recordAttempt(
        id,
        USER,
        attempt({ weekNumber: week, correct: week !== 1 })
      );
    }

    const { attempts } = readTelemetry();
    const shareByWeek = [1, 2, 3].map((week) => {
      const rows = attempts.filter((a) => a.weekNumber === week);
      return rows.filter((a) => a.correct).length / rows.length;
    });
    expect(shareByWeek).toEqual([0.5, 1, 1]);
  });
});

describe('migrating telemetry written before the campaign existed', () => {
  /** Exactly the shape the previous build wrote: no weekNumber anywhere. */
  function writeLegacy(): void {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        sessions: [
          {
            id: 'sess-1',
            userId: USER,
            startedAt: '2026-08-01T09:00:00.000Z',
            completedAt: '2026-08-01T09:40:00.000Z',
            cuRemaining: 42,
            slaScore: 115,
            currentDay: 7,
            completed: true,
          },
        ],
        attempts: [
          {
            sessionId: 'sess-1',
            userId: USER,
            scenarioCode: 'S01',
            domain: 'implement-manage',
            objective: 'Workspace and item security',
            chosenOptionKey: 'B',
            correct: true,
            cuCost: 0,
            slaDelta: 5,
            secondsToDecide: 22,
            createdAt: '2026-08-01T09:01:00.000Z',
          },
        ],
      })
    );
  }

  it('reads old sessions as week 1 rather than dropping them', () => {
    writeLegacy();
    const [session] = readTelemetry().sessions;
    expect(session.weekNumber).toBe(1);
    expect(session.cuRemaining).toBe(42);
    expect(session.completed).toBe(true);
  });

  it('reads old attempts as week 1, keeping every other field', () => {
    writeLegacy();
    const [row] = readTelemetry().attempts;
    expect(row.weekNumber).toBe(1);
    expect(row).toMatchObject({
      scenarioCode: 'S01',
      objective: 'Workspace and item security',
      secondsToDecide: 22,
    });
  });

  it('keeps appending to a migrated log without losing the old rows', async () => {
    writeLegacy();
    const telemetry = createTelemetry();
    const id = (await telemetry.startSession(USER, {
      weekNumber: 2,
      startingCu: 90,
      startingSla: 100,
      startingDay: 1,
    }))!;
    await telemetry.recordAttempt(id, USER, attempt());

    const log = readTelemetry();
    expect(log.sessions.map((s) => s.weekNumber)).toEqual([1, 2]);
    expect(log.attempts.map((a) => a.weekNumber)).toEqual([1, 2]);
  });

  it('exports the migrated log with weekNumber filled in', () => {
    writeLegacy();
    const exported = JSON.parse(exportTelemetry());
    expect(exported.sessions[0].weekNumber).toBe(1);
    expect(exported.attempts[0].weekNumber).toBe(1);
  });
});

describe('log hygiene', () => {
  it('returns an empty log when storage holds nothing', () => {
    expect(readTelemetry()).toEqual({ sessions: [], attempts: [] });
  });

  it('returns an empty log rather than throwing on corrupt storage', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readTelemetry()).toEqual({ sessions: [], attempts: [] });
  });

  it('clears on request', async () => {
    const telemetry = createTelemetry();
    await telemetry.startSession(USER, {
      weekNumber: 1,
      startingCu: 100,
      startingSla: 100,
      startingDay: 1,
    });
    clearTelemetry();
    expect(readTelemetry().sessions).toEqual([]);
  });
});
