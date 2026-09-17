// Gameplay telemetry (sessions + attempts), stored in this browser.
//
// The SQL-backed version of this app appended every decision to a database
// table that fed an analytics pipeline. Without a backend the same records are
// kept in localStorage: the shapes are unchanged, so the log can be exported
// as JSON (see `exportTelemetry`) or a server-backed implementation of
// `GameTelemetry` can be swapped in without touching the game.
//
// Both record types carry `weekNumber`. On the attempt it is denormalized on
// purpose: the analytics notebook reads that one table with no joins, so it
// can plot mastery as a learning curve across the campaign instead of a
// single lifetime average. Records written before the campaign existed have
// no weekNumber and are read as week 1, matching the entity default.
//
// Storage failures are logged but never block gameplay.

import type { WeekOutcome } from './progress';

import type { AttemptRecord } from './types';

const STORAGE_KEY = 'capacity-command:telemetry';

/** Week records written before the campaign existed belong to. */
const DEFAULT_WEEK = 1;

// localStorage is a few MB and shared with everything else on the origin, so
// the log is bounded. Oldest sessions are dropped first, with their attempts.
const MAX_SESSIONS = 50;
const MAX_ATTEMPTS = 2000;

export interface SessionProgress {
  cuRemaining: number;
  slaScore: number;
  currentDay: number;
}

/** Opening balance of the week a session is starting; see game/campaign.ts. */
export interface SessionStart {
  weekNumber: number;
  startingCu: number;
  startingSla: number;
  startingDay: number;
}

/** One playthrough. Mirrors the row the SQL version wrote. */
export interface StoredSession extends SessionProgress {
  id: string;
  userId: string;
  /** Campaign week this session played; see seed/campaign.json. */
  weekNumber: number;
  /** ISO timestamp. */
  startedAt: string;
  completedAt: string | null;
  completed: boolean;
  /**
   * How the session ended. A breached run still sets `completed`, because the
   * session did finish and every existing query counting completed sessions
   * keeps working; this says whether the week was survived. Absent on records
   * written before breaches existed, which were all survivable by definition.
   */
  outcome?: WeekOutcome;
}

/** One decision. Denormalized on purpose: readable without joins. */
export interface StoredAttempt extends AttemptRecord {
  sessionId: string;
  userId: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface TelemetryLog {
  sessions: StoredSession[];
  attempts: StoredAttempt[];
}

export interface GameTelemetry {
  /** Create the session record; returns its id, or null when the write failed. */
  startSession(userId: string, start: SessionStart): Promise<string | null>;
  /** Append one attempt for a decision. */
  recordAttempt(
    sessionId: string,
    userId: string,
    attempt: AttemptRecord
  ): Promise<void>;
  /** Keep the session's CU/SLA/day current after each decision. */
  syncSession(sessionId: string, progress: SessionProgress): Promise<void>;
  /** Mark the session completed at end of week, survived or breached. */
  completeSession(
    sessionId: string,
    progress: SessionProgress,
    outcome?: WeekOutcome
  ): Promise<void>;
}

const EMPTY: TelemetryLog = { sessions: [], attempts: [] };

function logFailure(operation: string, err: unknown): void {
  console.warn(`Telemetry write failed (${operation}); gameplay continues.`, err);
}

/** Fill in weekNumber on a record written before the column existed. */
function withWeek<T extends { weekNumber?: number }>(record: T): T {
  if (record.weekNumber !== undefined) return record;
  // Spreading a generic widens it, so the result is re-narrowed to T; the
  // only field added is the one just checked to be missing.
  return { ...record, weekNumber: DEFAULT_WEEK } as T;
}

/** The whole log for this browser. Never throws; returns empty on any problem. */
export function readTelemetry(): TelemetryLog {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...EMPTY };
    const parsed = JSON.parse(stored) as Partial<TelemetryLog>;
    return {
      sessions: (parsed.sessions ?? []).map(withWeek),
      attempts: (parsed.attempts ?? []).map(withWeek),
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Drop the oldest sessions (and their attempts) until back under the caps. */
function trim(log: TelemetryLog): TelemetryLog {
  let { sessions, attempts } = log;

  if (sessions.length > MAX_SESSIONS) {
    sessions = sessions.slice(-MAX_SESSIONS);
    const live = new Set(sessions.map((s) => s.id));
    attempts = attempts.filter((a) => live.has(a.sessionId));
  }
  if (attempts.length > MAX_ATTEMPTS) {
    attempts = attempts.slice(-MAX_ATTEMPTS);
  }
  return { sessions, attempts };
}

function write(operation: string, update: (log: TelemetryLog) => TelemetryLog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trim(update(readTelemetry()))));
  } catch (err) {
    logFailure(operation, err);
  }
}

/** The log as pretty-printed JSON, for download or later import into SQL. */
export function exportTelemetry(): string {
  return JSON.stringify(readTelemetry(), null, 2);
}

export function clearTelemetry(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

export function createTelemetry(): GameTelemetry {
  return {
    async startSession(userId, start) {
      const id = crypto.randomUUID();
      const session: StoredSession = {
        id,
        userId,
        weekNumber: start.weekNumber,
        startedAt: new Date().toISOString(),
        completedAt: null,
        cuRemaining: start.startingCu,
        slaScore: start.startingSla,
        currentDay: start.startingDay,
        completed: false,
      };
      write('startSession', (log) => ({
        ...log,
        sessions: [...log.sessions, session],
      }));
      return id;
    },

    async recordAttempt(sessionId, userId, attempt) {
      write('recordAttempt', (log) => ({
        ...log,
        attempts: [
          ...log.attempts,
          { ...attempt, sessionId, userId, createdAt: new Date().toISOString() },
        ],
      }));
    },

    async syncSession(sessionId, progress) {
      write('syncSession', (log) => ({
        ...log,
        sessions: log.sessions.map((s) =>
          s.id === sessionId ? { ...s, ...progress } : s
        ),
      }));
    },

    async completeSession(sessionId, progress, outcome = 'completed') {
      const completedAt = new Date().toISOString();
      write('completeSession', (log) => ({
        ...log,
        sessions: log.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, ...progress, completed: true, completedAt, outcome }
            : s
        ),
      }));
    },
  };
}
