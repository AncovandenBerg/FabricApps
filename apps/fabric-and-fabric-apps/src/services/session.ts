import { getRayfinClient } from './rayfinClient';
import type { Stage } from '../../rayfin/data/Session';

// Singleton row — same well-known id every time so every screen reads/writes
// the same Session without a lookup step.
export const SESSION_ID = '00000000-0000-0000-0000-000000000001';

export interface SessionState {
  id: string;
  stage: Stage;
  currentWorkloadIndex: number;
  revealStep: number;
  activePollId: string;
  updatedAt: Date;
}

const SESSION_FIELDS = [
  'id',
  'stage',
  'currentWorkloadIndex',
  'revealStep',
  'activePollId',
  'updatedAt',
] as const;

export async function getSession(): Promise<SessionState | null> {
  const client = getRayfinClient();
  // A query with no explicit .select() (or the findById/findFirst/findMany
  // convenience methods) only ever returns `id` — always select fields
  // explicitly, here and anywhere else a full row is needed.
  const results = await client.data.Session.select([...SESSION_FIELDS])
    .where({ id: { eq: SESSION_ID } })
    .first(1)
    .execute();
  return (results[0] as SessionState) ?? null;
}

/** Creates the singleton Session row if it doesn't exist yet. Safe to call repeatedly. */
export async function ensureSession(): Promise<SessionState> {
  const existing = await getSession();
  if (existing) return existing;

  const client = getRayfinClient();
  return (await client.data.Session.create({
    id: SESSION_ID,
    stage: 'lobby',
    currentWorkloadIndex: 0,
    revealStep: 0,
    activePollId: '',
    updatedAt: new Date(),
  })) as SessionState;
}

/** Resets revealStep to 0 whenever the stage changes so re-entering reveal always starts clean. */
export async function setStage(stage: Stage): Promise<SessionState> {
  const client = getRayfinClient();
  return (await client.data.Session.update(
    { id: SESSION_ID },
    { stage, revealStep: 0, updatedAt: new Date() }
  )) as SessionState;
}

export async function setWorkloadIndex(index: number): Promise<SessionState> {
  const client = getRayfinClient();
  return (await client.data.Session.update(
    { id: SESSION_ID },
    { currentWorkloadIndex: index, updatedAt: new Date() }
  )) as SessionState;
}

/** Jumps straight to the zoomed-in view for a given workload, from any stage. */
export async function zoomToWorkload(index: number): Promise<SessionState> {
  const client = getRayfinClient();
  return (await client.data.Session.update(
    { id: SESSION_ID },
    { stage: 'workload_zoom', currentWorkloadIndex: index, updatedAt: new Date() }
  )) as SessionState;
}

export async function setRevealStep(step: number): Promise<SessionState> {
  const client = getRayfinClient();
  return (await client.data.Session.update(
    { id: SESSION_ID },
    { revealStep: step, updatedAt: new Date() }
  )) as SessionState;
}

/** For rehearsals — puts the session back to the very start. */
export async function resetSession(): Promise<SessionState> {
  const client = getRayfinClient();
  return (await client.data.Session.update(
    { id: SESSION_ID },
    {
      stage: 'lobby',
      currentWorkloadIndex: 0,
      revealStep: 0,
      activePollId: '',
      updatedAt: new Date(),
    }
  )) as SessionState;
}

/** Pass `null` to close whichever poll is currently open. */
export async function setActivePoll(
  pollId: string | null
): Promise<SessionState> {
  const client = getRayfinClient();
  return (await client.data.Session.update(
    { id: SESSION_ID },
    { activePollId: pollId ?? '', updatedAt: new Date() }
  )) as SessionState;
}
