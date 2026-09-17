// Pure game logic for one simulated week. No I/O, no clocks: callers pass
// secondsToDecide in, telemetry happens outside. This keeps the whole loop
// unit-testable.
//
// A game is always scoped to a single campaign week. Which weeks exist and
// how each is balanced comes from seed/campaign.json via game/campaign.ts;
// the engine only ever receives one WeekConfig at a time and never assumes
// how many weeks there are or how long one runs.

import { FIRST_WEEK, weekConfig, type WeekConfig } from './campaign';

import type { AttemptRecord, DomainSummary, GameScenario } from './types';

// Fallbacks for a week whose config omits a value, and the defaults the
// tests and fixtures lean on. Real budgets come from campaign.json.
export const STARTING_CU = 100;
export const STARTING_SLA = 100;
export const WEEK_LENGTH = 7;

// Matches the @int({ min: 0, max: 200 }) constraints on the Session entity
const SCORE_MIN = 0;
const SCORE_MAX = 200;

export type GamePhase = 'incident' | 'feedback' | 'breach' | 'summary';

/**
 * The decision that broke the budget. A week ends the moment a decision costs
 * more capacity than it has left, so this is recorded once and never
 * overwritten: the first overspend is the one that took the platform down.
 */
export interface Breach {
  scenarioCode: string;
  /** What the chosen option cost. */
  cost: number;
  /** CU left before that cost was applied. */
  available: number;
  day: number;
}

export interface GameState {
  phase: GamePhase;
  /** Campaign week being played. */
  week: number;
  /** Days in this week; drives the "Day 3/7" counter. */
  weekLength: number;
  /** Budget this week started with; the status bars scale against it. */
  startingCu: number;
  startingSla: number;
  day: number;
  cu: number;
  sla: number;
  /** Scenario currently on screen (incident or feedback phase). */
  current: GameScenario | null;
  /** Regular scenarios not yet played, sorted by (day, code). */
  pending: GameScenario[];
  /** Follow-up scenarios enqueued by a chosen option, played next. */
  chained: GameScenario[];
  /** Attempt shown in the feedback panel; last entry of attempts. */
  lastAttempt: AttemptRecord | null;
  attempts: AttemptRecord[];
  /** Set once capacity ran out; the week ends after this decision's feedback. */
  breach: Breach | null;
}

function clamp(value: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, value));
}

/**
 * The week config a state should use. Accepts a config or a bare week
 * number; an unconfigured number still plays, on the default balance.
 */
function resolveWeek(week: WeekConfig | number | undefined): WeekConfig {
  if (typeof week === 'object') return week;
  const number = week ?? FIRST_WEEK;
  const found = weekConfig(number);
  return {
    number,
    title: found?.title ?? `Week ${number}`,
    subtitle: found?.subtitle ?? '',
    days: found?.days ?? WEEK_LENGTH,
    startingCu: found?.startingCu ?? STARTING_CU,
    startingSla: found?.startingSla ?? STARTING_SLA,
  };
}

/**
 * Build one week's play order. Scenarios from other weeks and follow-ups
 * are excluded; follow-ups only enter play through a chosen option.
 */
export function buildWeek(
  scenarios: GameScenario[],
  weekNumber: number = FIRST_WEEK
): GameScenario[] {
  return scenarios
    .filter((s) => s.week === weekNumber && !s.isFollowUp)
    .sort((a, b) => a.day - b.day || a.code.localeCompare(b.code));
}

export function startGame(
  scenarios: GameScenario[],
  week?: WeekConfig | number
): GameState {
  const config = resolveWeek(week);
  const queue = buildWeek(scenarios, config.number);
  if (queue.length === 0) {
    throw new Error(
      `No playable scenarios for week ${config.number} (all are follow-ups or the week is empty).`
    );
  }
  const [first, ...pending] = queue;
  return {
    phase: 'incident',
    week: config.number,
    weekLength: config.days,
    startingCu: config.startingCu,
    startingSla: config.startingSla,
    day: first.day,
    cu: config.startingCu,
    sla: config.startingSla,
    current: first,
    pending,
    chained: [],
    lastAttempt: null,
    attempts: [],
    breach: null,
  };
}

/**
 * Apply a decision: costs CU, moves SLA, records the attempt, enqueues a
 * follow-up when the chosen option has one. Moves to the feedback phase.
 * The full scenario list is needed to resolve followUpCode references.
 *
 * Spending more than the week has left is a breach: the decision still
 * resolves and still shows its feedback, but the run ends there. Spending the
 * last unit exactly is survival, not a breach, so the test is strictly
 * greater than.
 */
export function choose(
  state: GameState,
  optionKey: string,
  secondsToDecide: number,
  allScenarios: GameScenario[]
): GameState {
  if (state.phase !== 'incident' || !state.current) {
    throw new Error(`choose() is only valid in the incident phase (was: ${state.phase}).`);
  }
  const option = state.current.options.find((o) => o.optionKey === optionKey);
  if (!option) {
    throw new Error(`Unknown option "${optionKey}" for scenario ${state.current.code}.`);
  }

  const attempt: AttemptRecord = {
    scenarioCode: state.current.code,
    weekNumber: state.week,
    domain: state.current.domain,
    objective: state.current.objective,
    chosenOptionKey: option.optionKey,
    correct: option.correct,
    cuCost: option.cuCost,
    slaDelta: option.slaDelta,
    secondsToDecide: Math.max(0, Math.round(secondsToDecide)),
  };

  const chained = [...state.chained];
  if (option.followUpCode) {
    const followUp = allScenarios.find((s) => s.code === option.followUpCode);
    if (followUp && !chained.some((s) => s.code === followUp.code)) {
      chained.push(followUp);
    }
  }

  const breach =
    state.breach ??
    (option.cuCost > state.cu
      ? {
          scenarioCode: state.current.code,
          cost: option.cuCost,
          available: state.cu,
          day: state.day,
        }
      : null);

  return {
    ...state,
    phase: 'feedback',
    cu: clamp(state.cu - option.cuCost),
    sla: clamp(state.sla + option.slaDelta),
    chained,
    lastAttempt: attempt,
    attempts: [...state.attempts, attempt],
    breach,
  };
}

/**
 * Leave the feedback panel: play a chained follow-up first, then the next
 * scenario in the day queue. Day advances with the queue; after the last
 * scenario the game moves to the summary phase.
 *
 * A breached week ends here instead. The queues are left untouched on purpose,
 * so the breach report can say how many incidents were never reached.
 */
export function advance(state: GameState): GameState {
  if (state.phase !== 'feedback') {
    throw new Error(`advance() is only valid in the feedback phase (was: ${state.phase}).`);
  }

  if (state.breach) {
    return { ...state, phase: 'breach', current: null };
  }

  const chained = [...state.chained];
  const pending = [...state.pending];
  const next = chained.shift() ?? pending.shift() ?? null;

  if (!next) {
    return { ...state, phase: 'summary', current: null, chained, pending };
  }

  return {
    ...state,
    phase: 'incident',
    // Follow-ups carry their trigger day; the queue is day-sorted, so day
    // only ever moves forward.
    day: Math.max(state.day, next.day),
    current: next,
    chained,
    pending,
  };
}

/**
 * Serializable snapshot of a running game, storing scenarios by code so
 * saved state stays small and survives content edits.
 */
export interface SavedGame {
  /** Optional: snapshots written before weeks existed replay as week 1. */
  week?: number;
  cu: number;
  sla: number;
  day: number;
  phase: 'incident' | 'feedback';
  currentCode: string | null;
  pendingCodes: string[];
  chainedCodes: string[];
  lastAttempt: AttemptRecord | null;
  attempts: AttemptRecord[];
  /**
   * Optional: absent on snapshots written before breaches existed, which
   * replay as an intact run. This has to persist, because a breach is set
   * while the phase is still `feedback` and that state gets saved: without
   * it, reloading the tab would walk out of a lost week.
   */
  breach?: Breach | null;
}

export function serializeGame(state: GameState): SavedGame {
  if (state.phase === 'summary' || state.phase === 'breach') {
    throw new Error('A finished week is recorded to history, not saved.');
  }
  return {
    week: state.week,
    cu: state.cu,
    sla: state.sla,
    day: state.day,
    phase: state.phase,
    currentCode: state.current?.code ?? null,
    pendingCodes: state.pending.map((s) => s.code),
    chainedCodes: state.chained.map((s) => s.code),
    lastAttempt: state.lastAttempt,
    attempts: state.attempts,
    breach: state.breach,
  };
}

/** Stamp the playing week onto an attempt saved before weeks existed. */
function withWeek(attempt: AttemptRecord, week: number): AttemptRecord {
  // Snapshots from the pre-campaign build carry no weekNumber at all, so
  // the field has to be probed rather than compared.
  const stored = attempt as Partial<AttemptRecord>;
  return stored.weekNumber === undefined ? { ...attempt, weekNumber: week } : attempt;
}

/**
 * Rebuild a GameState from a snapshot against the current scenario content.
 * Codes that no longer exist (content edits between sessions) are dropped;
 * a missing current scenario falls back to the next queued one. The week's
 * balance is re-read from the config, so rebalancing a week applies to a
 * game already in flight.
 *
 * A snapshot saved by the pre-campaign build has no `week` and attempts
 * with no `weekNumber`. Both default to the first configured week, so a
 * player mid-week when the update lands keeps their run.
 */
export function restoreGame(
  saved: SavedGame,
  scenarios: GameScenario[]
): GameState {
  const config = resolveWeek(saved.week);
  const byCode = new Map(scenarios.map((s) => [s.code, s]));
  const resolve = (codes: string[]) =>
    codes.map((c) => byCode.get(c)).filter((s): s is GameScenario => !!s);

  const pending = resolve(saved.pendingCodes);
  const chained = resolve(saved.chainedCodes);
  let current = saved.currentCode ? (byCode.get(saved.currentCode) ?? null) : null;
  let phase: GamePhase = saved.phase;
  if (!current && phase === 'incident') {
    current = chained.shift() ?? pending.shift() ?? null;
    if (!current) phase = 'summary';
  }

  return {
    phase,
    week: config.number,
    weekLength: config.days,
    startingCu: config.startingCu,
    startingSla: config.startingSla,
    day: saved.day,
    cu: saved.cu,
    sla: saved.sla,
    current,
    pending,
    chained,
    lastAttempt: saved.lastAttempt
      ? withWeek(saved.lastAttempt, config.number)
      : null,
    attempts: saved.attempts.map((a) => withWeek(a, config.number)),
    breach: saved.breach ?? null,
  };
}

/** Per-domain correct percentage for the summary screen. */
export function summarize(attempts: AttemptRecord[]): DomainSummary[] {
  const byDomain = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    const entry = byDomain.get(a.domain) ?? { total: 0, correct: 0 };
    entry.total += 1;
    if (a.correct) entry.correct += 1;
    byDomain.set(a.domain, entry);
  }
  return [...byDomain.entries()]
    .map(([domain, { total, correct }]) => ({
      domain,
      total,
      correct,
      percentage: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}
