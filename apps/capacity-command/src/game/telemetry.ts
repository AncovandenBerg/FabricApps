// Writes gameplay telemetry (Session + AttemptEvent) through the typed
// client. AttemptEvent is append-only and denormalized by design: the
// analytics notebook reads it standalone, without joins.
//
// Telemetry failures are logged but never block gameplay; the session keeps
// running locally and later writes are still attempted.

import { getRayfinClient } from '@/services/rayfinClient';

import type { AttemptRecord } from './types';

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

export interface GameTelemetry {
  /** Create the Session row; returns its id, or null when the write failed. */
  startSession(userId: string, start: SessionStart): Promise<string | null>;
  /** Append one AttemptEvent row for a decision. */
  recordAttempt(
    sessionId: string,
    userId: string,
    attempt: AttemptRecord
  ): Promise<void>;
  /** Keep the Session row's CU/SLA/day current after each decision. */
  syncSession(sessionId: string, progress: SessionProgress): Promise<void>;
  /** Mark the Session completed at end of week. */
  completeSession(sessionId: string, progress: SessionProgress): Promise<void>;
}

function logFailure(operation: string, err: unknown): void {
  console.warn(`Telemetry write failed (${operation}); gameplay continues.`, err);
}

/**
 * Guests write through the anonymous role, which has create/update but no
 * read. DAB then performs the mutation and STILL errors, because it cannot
 * return the row ("The mutation operation X was successful but the current
 * user is unauthorized to view the response due to lack of read
 * permissions"). That error means the write landed: treat it as success.
 */
function writeLandedWithoutRead(err: unknown): boolean {
  return (
    err instanceof Error &&
    /successful but the current user is unauthorized to view/i.test(err.message)
  );
}

export function createTelemetry(): GameTelemetry {
  const client = getRayfinClient();

  return {
    async startSession(userId, start) {
      // The id is minted client-side: anonymous (guest) writes never get
      // the created row back, so we cannot rely on a server-returned id.
      const id = crypto.randomUUID();
      try {
        await client.data.Session.create({
          id,
          userId,
          startedAt: new Date(),
          weekNumber: start.weekNumber,
          cuRemaining: start.startingCu,
          slaScore: start.startingSla,
          currentDay: start.startingDay,
          completed: false,
        });
        return id;
      } catch (err) {
        if (writeLandedWithoutRead(err)) return id;
        logFailure('startSession', err);
        return null;
      }
    },

    async recordAttempt(sessionId, userId, attempt) {
      try {
        await client.data.AttemptEvent.create({
          session: { id: sessionId },
          userId,
          scenarioCode: attempt.scenarioCode,
          weekNumber: attempt.weekNumber,
          domain: attempt.domain,
          objective: attempt.objective,
          chosenOptionKey: attempt.chosenOptionKey,
          correct: attempt.correct,
          cuCost: attempt.cuCost,
          slaDelta: attempt.slaDelta,
          secondsToDecide: attempt.secondsToDecide,
          createdAt: new Date(),
        });
      } catch (err) {
        if (!writeLandedWithoutRead(err)) logFailure('recordAttempt', err);
      }
    },

    async syncSession(sessionId, progress) {
      try {
        await client.data.Session.update({ id: sessionId }, progress);
      } catch (err) {
        if (!writeLandedWithoutRead(err)) logFailure('syncSession', err);
      }
    },

    async completeSession(sessionId, progress) {
      try {
        await client.data.Session.update(
          { id: sessionId },
          { ...progress, completed: true, completedAt: new Date() }
        );
      } catch (err) {
        if (!writeLandedWithoutRead(err)) logFailure('completeSession', err);
      }
    },
  };
}
