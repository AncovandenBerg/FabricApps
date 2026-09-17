import { describe, expect, it } from 'vitest';

import { isWeekUnlocked, nextWeek, weekAfter, WEEKS } from '@/game/campaign';
import { scenarios as seedScenarios } from '@/game/data';
import {
  advance,
  buildWeek,
  choose,
  restoreGame,
  serializeGame,
  startGame,
  STARTING_CU,
  STARTING_SLA,
  summarize,
  type GameState,
  type SavedGame,
} from '@/game/engine';
import type { GameOption, GameScenario } from '@/game/types';

import campaignJson from '../../seed/campaign.json';

function option(overrides: Partial<GameOption> = {}): GameOption {
  return {
    optionKey: 'A',
    optionText: 'Do the thing',
    cuCost: 0,
    slaDelta: 0,
    correct: true,
    feedback: 'ok',
    followUpCode: null,
    ...overrides,
  };
}

function scenario(overrides: Partial<GameScenario> = {}): GameScenario {
  return {
    code: 'S01',
    week: 1,
    day: 1,
    domain: 'implement-manage',
    objective: 'obj',
    title: 'title',
    incident: 'incident',
    isFollowUp: false,
    options: [option(), option({ optionKey: 'B', correct: false })],
    ...overrides,
  };
}

describe('buildWeek', () => {
  it('excludes follow-ups and sorts by day then code', () => {
    const week = buildWeek([
      scenario({ code: 'S03', day: 2 }),
      scenario({ code: 'S01F', day: 1, isFollowUp: true }),
      scenario({ code: 'S02', day: 1 }),
      scenario({ code: 'S01', day: 1 }),
    ]);
    expect(week.map((s) => s.code)).toEqual(['S01', 'S02', 'S03']);
  });

  it('only returns scenarios from the requested week', () => {
    const all = [
      scenario({ code: 'S01', week: 1 }),
      scenario({ code: 'W2S01', week: 2 }),
      scenario({ code: 'W2S02', week: 2, day: 2 }),
    ];
    expect(buildWeek(all, 1).map((s) => s.code)).toEqual(['S01']);
    expect(buildWeek(all, 2).map((s) => s.code)).toEqual(['W2S01', 'W2S02']);
  });
});

describe('startGame', () => {
  it('starts on the first scenario day with the default balance', () => {
    const state = startGame([scenario()]);
    expect(state.cu).toBe(STARTING_CU);
    expect(state.sla).toBe(STARTING_SLA);
    expect(state.day).toBe(1);
    expect(state.week).toBe(1);
    expect(state.phase).toBe('incident');
    expect(state.current?.code).toBe('S01');
  });

  it('throws when only follow-ups exist', () => {
    expect(() => startGame([scenario({ isFollowUp: true })])).toThrow();
  });

  it('throws when the requested week has no scenarios', () => {
    expect(() => startGame([scenario({ week: 1 })], 2)).toThrow(/week 2/);
  });

  it('takes its budget and day count from the week config, not a constant', () => {
    for (const config of WEEKS) {
      const state = startGame(
        [scenario({ code: `W${config.number}S01`, week: config.number })],
        config.number
      );
      expect(state.week).toBe(config.number);
      expect(state.cu).toBe(config.startingCu);
      expect(state.sla).toBe(config.startingSla);
      expect(state.weekLength).toBe(config.days);
    }
  });

  it('accepts a week config object directly, so the engine needs no lookup', () => {
    const state = startGame([scenario({ code: 'X1', week: 9 })], {
      number: 9,
      title: 'Week nine',
      subtitle: '',
      days: 3,
      startingCu: 42,
      startingSla: 77,
    });
    expect(state.weekLength).toBe(3);
    expect(state.cu).toBe(42);
    expect(state.sla).toBe(77);
  });
});

describe('choose', () => {
  it('applies cuCost and slaDelta and records the attempt with its week', () => {
    const all = [
      scenario({
        week: 2,
        code: 'W2S01',
        options: [
          option({ optionKey: 'A', cuCost: 15, slaDelta: -10, correct: false }),
        ],
      }),
    ];
    const state = choose(startGame(all, 2), 'A', 12.6, all);
    const week2 = WEEKS.find((w) => w.number === 2)!;
    expect(state.phase).toBe('feedback');
    expect(state.cu).toBe(week2.startingCu - 15);
    expect(state.sla).toBe(week2.startingSla - 10);
    expect(state.attempts).toHaveLength(1);
    expect(state.lastAttempt).toMatchObject({
      scenarioCode: 'W2S01',
      weekNumber: 2,
      chosenOptionKey: 'A',
      correct: false,
      cuCost: 15,
      slaDelta: -10,
      secondsToDecide: 13,
    });
  });

  it('clamps CU and SLA to the 0..200 entity bounds', () => {
    const all = [
      scenario({
        options: [option({ optionKey: 'A', cuCost: 150, slaDelta: 150 })],
      }),
    ];
    const state = choose(startGame(all), 'A', 1, all);
    expect(state.cu).toBe(0);
    expect(state.sla).toBe(200);
  });

  it('enqueues the follow-up scenario referenced by the chosen option', () => {
    const followUp = scenario({ code: 'S01F', isFollowUp: true });
    const all = [
      scenario({
        options: [option({ optionKey: 'C', followUpCode: 'S01F' })],
      }),
      followUp,
    ];
    const state = choose(startGame(all), 'C', 1, all);
    expect(state.chained.map((s) => s.code)).toEqual(['S01F']);
  });

  it('rejects unknown option keys', () => {
    const all = [scenario()];
    expect(() => choose(startGame(all), 'Z', 1, all)).toThrow(/Unknown option/);
  });
});

describe('advance', () => {
  function play(state: GameState, all: GameScenario[], key = 'A'): GameState {
    return advance(choose(state, key, 1, all));
  }

  it('plays a chained follow-up before the next day-queue scenario', () => {
    const all = [
      scenario({
        code: 'S01',
        options: [option({ optionKey: 'C', followUpCode: 'S01F' })],
      }),
      scenario({ code: 'S02' }),
      scenario({ code: 'S01F', isFollowUp: true }),
    ];
    let state = play(startGame(all), all, 'C');
    expect(state.current?.code).toBe('S01F');
    state = play(state, all);
    expect(state.current?.code).toBe('S02');
  });

  it('advances the day when the queue moves to a later day', () => {
    const all = [scenario({ code: 'S01', day: 1 }), scenario({ code: 'S02', day: 2 })];
    const state = play(startGame(all), all);
    expect(state.day).toBe(2);
  });

  it('ends in the summary phase after the last scenario', () => {
    const all = [scenario()];
    const state = play(startGame(all), all);
    expect(state.phase).toBe('summary');
    expect(state.current).toBeNull();
  });
});

describe('summarize', () => {
  it('computes per-domain correct percentages', () => {
    const all = [
      scenario({ code: 'S01', domain: 'a' }),
      scenario({ code: 'S02', domain: 'a' }),
      scenario({ code: 'S03', domain: 'b' }),
    ];
    let state = startGame(all);
    state = advance(choose(state, 'A', 1, all)); // a: correct
    state = advance(choose(state, 'B', 1, all)); // a: wrong
    state = advance(choose(state, 'A', 1, all)); // b: correct
    expect(summarize(state.attempts)).toEqual([
      { domain: 'a', total: 2, correct: 1, percentage: 50 },
      { domain: 'b', total: 1, correct: 1, percentage: 100 },
    ]);
  });
});

describe('serializeGame / restoreGame', () => {
  it('round-trips a mid-week game through the code-based snapshot', () => {
    const followUp = scenario({ code: 'S01F', isFollowUp: true });
    const all = [
      scenario({
        code: 'S01',
        options: [
          option({ optionKey: 'C', cuCost: 10, slaDelta: -5, followUpCode: 'S01F' }),
        ],
      }),
      scenario({ code: 'S02', day: 2 }),
      followUp,
    ];
    const state = choose(startGame(all), 'C', 7, all);
    const restored = restoreGame(serializeGame(state), all);
    expect(restored).toEqual(state);
  });

  it('round-trips a week other than the first', () => {
    const all = [
      scenario({ code: 'W3S01', week: 3 }),
      scenario({ code: 'W3S02', week: 3, day: 2 }),
    ];
    const state = choose(startGame(all, 3), 'A', 3, all);
    const restored = restoreGame(serializeGame(state), all);
    expect(restored.week).toBe(3);
    expect(restored).toEqual(state);
  });

  it('drops snapshot codes that no longer exist in the content', () => {
    const all = [scenario({ code: 'S01' }), scenario({ code: 'S02', day: 2 })];
    const state = startGame(all);
    const saved = serializeGame(state);
    // Content update removed the current scenario
    const restored = restoreGame(saved, [all[1]]);
    expect(restored.phase).toBe('incident');
    expect(restored.current?.code).toBe('S02');
    expect(restored.pending).toHaveLength(0);
  });

  it('refuses to serialize a finished week', () => {
    const all = [scenario()];
    const done = advance(choose(startGame(all), 'A', 1, all));
    expect(() => serializeGame(done)).toThrow();
  });

  it('replays a pre-campaign snapshot as the first week', () => {
    const all = [scenario({ code: 'S01' }), scenario({ code: 'S02', day: 2 })];
    // Exactly what the previous build wrote: no `week`, attempts with no
    // `weekNumber`. A player mid-week when the update lands keeps their run.
    const legacy = {
      cu: 90,
      sla: 95,
      day: 1,
      phase: 'incident',
      currentCode: 'S02',
      pendingCodes: [],
      chainedCodes: [],
      lastAttempt: {
        scenarioCode: 'S01',
        domain: 'implement-manage',
        objective: 'obj',
        chosenOptionKey: 'A',
        correct: true,
        cuCost: 10,
        slaDelta: -5,
        secondsToDecide: 4,
      },
      attempts: [
        {
          scenarioCode: 'S01',
          domain: 'implement-manage',
          objective: 'obj',
          chosenOptionKey: 'A',
          correct: true,
          cuCost: 10,
          slaDelta: -5,
          secondsToDecide: 4,
        },
      ],
    } as unknown as SavedGame;

    const restored = restoreGame(legacy, all);
    expect(restored.week).toBe(WEEKS[0].number);
    expect(restored.weekLength).toBe(WEEKS[0].days);
    expect(restored.cu).toBe(90);
    expect(restored.current?.code).toBe('S02');
    // Backfilled rather than left undefined, so telemetry stays sliceable
    expect(restored.attempts[0].weekNumber).toBe(WEEKS[0].number);
    expect(restored.lastAttempt?.weekNumber).toBe(WEEKS[0].number);
  });
});

describe('running out of capacity', () => {
  /** One scenario, one affordable option and one that costs `cost`. */
  function week(cost: number, startingCu: number) {
    const all = [
      scenario({
        code: 'S01',
        options: [
          option({ optionKey: 'A', cuCost: cost, correct: false }),
          option({ optionKey: 'B', cuCost: 0 }),
        ],
      }),
      scenario({ code: 'S02', day: 2 }),
    ];
    return {
      all,
      state: startGame(all, {
        number: 1,
        title: 'Test week',
        subtitle: '',
        days: 7,
        startingCu,
        startingSla: 100,
      }),
    };
  }

  it('breaches when a decision costs more than the week has left', () => {
    const { all, state } = week(30, 20);
    const after = choose(state, 'A', 1, all);
    expect(after.breach).toEqual({
      scenarioCode: 'S01',
      cost: 30,
      available: 20,
      day: 1,
    });
  });

  it('treats spending the last unit exactly as survival, not a breach', () => {
    const { all, state } = week(20, 20);
    const after = choose(state, 'A', 1, all);
    expect(after.breach).toBeNull();
    expect(after.cu).toBe(0);
    expect(advance(after).phase).toBe('incident');
  });

  it('ends the week instead of playing the next incident', () => {
    const { all, state } = week(30, 20);
    const after = advance(choose(state, 'A', 1, all));
    expect(after.phase).toBe('breach');
    expect(after.current).toBeNull();
    // Left queued on purpose: the report says how many were never reached
    expect(after.pending).toHaveLength(1);
  });

  it('keeps the first overspend rather than the most recent one', () => {
    const { all, state } = week(30, 20);
    const first = choose(state, 'A', 1, all);
    // A second decision on an already-breached state must not relabel it
    const second = choose({ ...first, phase: 'incident' }, 'B', 1, all);
    expect(second.breach).toEqual(first.breach);
  });

  it('refuses to save a breached week, the same as a finished one', () => {
    const { all, state } = week(30, 20);
    expect(() => serializeGame(advance(choose(state, 'A', 1, all)))).toThrow(
      /recorded to history/
    );
  });

  it('carries the breach through a snapshot, so a reload cannot escape it', () => {
    const { all, state } = week(30, 20);
    const breached = choose(state, 'A', 1, all);
    const restored = restoreGame(serializeGame(breached), all);
    expect(restored.breach).toEqual(breached.breach);
    expect(advance(restored).phase).toBe('breach');
  });

  it('reads a snapshot written before breaches existed as an intact run', () => {
    const { all, state } = week(0, 100);
    const saved = serializeGame(choose(state, 'B', 1, all));
    delete (saved as Partial<SavedGame>).breach;
    expect(restoreGame(saved, all).breach).toBeNull();
  });
});

describe('campaign configuration', () => {
  it('reads every week from campaign.json, in order', () => {
    expect(WEEKS.map((w) => w.number)).toEqual(
      [...campaignJson.weeks].map((w) => w.number).sort((a, b) => a - b)
    );
  });

  it('gets tighter on CU with every week, so the curve is visible', () => {
    // What tightens is the headroom over a perfect run, not the raw budget.
    // Later weeks cost much more to play correctly, so their budgets are
    // larger and their margins thinner. Measuring the budget alone would say
    // the campaign got easier, which is the opposite of what happens.
    const headroom = WEEKS.map((w) => {
      const perfect = buildWeek(seedScenarios, w.number).reduce(
        (sum, s) => sum + s.options.find((o) => o.correct)!.cuCost,
        0
      );
      return (w.startingCu - perfect) / perfect;
    });
    for (let i = 1; i < headroom.length; i += 1) {
      expect(headroom[i]).toBeLessThan(headroom[i - 1]);
    }
    // Positive throughout: running out of capacity ends the run, so a week a
    // perfect player cannot afford could never be finished by anyone.
    expect(headroom.every((h) => h > 0)).toBe(true);
  });

  it('unlocks weeks in order', () => {
    expect(isWeekUnlocked(WEEKS[0].number, [])).toBe(true);
    for (let i = 1; i < WEEKS.length; i += 1) {
      const cleared = WEEKS.slice(0, i - 1).map((w) => w.number);
      expect(isWeekUnlocked(WEEKS[i].number, cleared)).toBe(false);
      expect(
        isWeekUnlocked(WEEKS[i].number, [...cleared, WEEKS[i - 1].number])
      ).toBe(true);
    }
  });

  it('points at the first unfinished unlocked week, and stays put once cleared', () => {
    expect(nextWeek([]).number).toBe(WEEKS[0].number);
    for (let i = 1; i < WEEKS.length; i += 1) {
      const cleared = WEEKS.slice(0, i).map((w) => w.number);
      expect(nextWeek(cleared).number).toBe(WEEKS[i].number);
    }
    // Campaign complete: the last week stays selectable rather than a dead end
    const all = WEEKS.map((w) => w.number);
    expect(nextWeek(all).number).toBe(WEEKS[WEEKS.length - 1].number);
  });

  it('reports the week a finished run just unlocked', () => {
    expect(weekAfter(WEEKS[0].number, [WEEKS[0].number])?.number).toBe(
      WEEKS[1].number
    );
    // Week 2 is not cleared yet, so finishing it cannot reveal week 3 early
    expect(weekAfter(WEEKS[1].number, [WEEKS[0].number])).toBeUndefined();
    // Nothing after the last configured week
    const last = WEEKS[WEEKS.length - 1].number;
    expect(weekAfter(last, WEEKS.map((w) => w.number))).toBeUndefined();
  });
});

// Weeks the campaign ships as fully authored chapters. The 15-incident
// count is a content convention for these, not a structural law: a week
// added to campaign.json later is validated by the seed guardrails but is
// free to be a different length.
const AUTHORED_WEEKS = [1, 2, 3];

describe('full weeks with the real seed content', () => {
  it.each(campaignJson.weeks.map((w) => w.number))(
    'week %i plays a perfect run of every incident at 100%% per domain',
    (weekNumber) => {
      const all = seedScenarios;
      // Derived, not hardcoded, so this holds for any configured week.
      const incidents = buildWeek(all, weekNumber).length;
      let state = startGame(all, weekNumber);
      const config = WEEKS.find((w) => w.number === weekNumber)!;
      expect(state.cu).toBe(config.startingCu);

      while (state.phase !== 'summary') {
        const correct = state.current!.options.find((o) => o.correct)!;
        state = advance(choose(state, correct.optionKey, 1, all));
        // A week a perfect player cannot afford is a week nobody can finish.
        // Guarded here rather than left to fail on a null scenario, because
        // this is the assertion that keeps the campaign winnable.
        expect(state.breach).toBeNull();
      }
      expect(state.attempts).toHaveLength(incidents);
      expect(state.day).toBeLessThanOrEqual(config.days);
      expect(state.attempts.every((a) => a.weekNumber === weekNumber)).toBe(true);
      expect(summarize(state.attempts).every((d) => d.percentage === 100)).toBe(
        true
      );
    }
  );

  /** Pick the most damaging option available: a follow-up trigger, else wrong. */
  function worstOption(state: GameState): GameOption {
    const options = state.current!.options;
    return (
      options.find((o) => o.followUpCode) ??
      options.find((o) => !o.correct) ??
      options[0]
    );
  }

  it.each(campaignJson.weeks.map((w) => w.number))(
    'week %i worst run triggers every follow-up in that week',
    (weekNumber) => {
      const all = seedScenarios;
      const incidents = buildWeek(all, weekNumber).length;
      const followUpsInWeek = all.filter(
        (s) => s.week === weekNumber && s.isFollowUp
      ).length;

      // This is about content reachability, not budget. A run this careless
      // breaches long before the week is out, which the test below proves,
      // and raising the budget cannot buy past it because CU is clamped to
      // SCORE_MAX. So the breach is cleared each step, letting the traversal
      // reach every follow-up and show none of them is orphaned.
      let state = startGame(all, weekNumber);
      while (state.phase !== 'summary') {
        const chosen = worstOption(state);
        state = advance({ ...choose(state, chosen.optionKey, 1, all), breach: null });
      }
      expect(state.attempts).toHaveLength(incidents + followUpsInWeek);
      expect(
        state.attempts.filter((a) => a.scenarioCode.endsWith('F'))
      ).toHaveLength(followUpsInWeek);
    }
  );

  it.each(campaignJson.weeks.map((w) => w.number))(
    'week %i breaches on its real budget when every decision is careless',
    (weekNumber) => {
      const all = seedScenarios;
      let state = startGame(all, weekNumber);
      while (state.phase !== 'summary' && state.phase !== 'breach') {
        state = advance(choose(state, worstOption(state).optionKey, 1, all));
      }
      expect(state.phase).toBe('breach');
      expect(state.breach).not.toBeNull();
      // Ended early, so incidents were left unplayed.
      expect(state.pending.length + state.chained.length).toBeGreaterThan(0);
    }
  );

  it('gives every configured week at least one playable incident', () => {
    for (const week of WEEKS) {
      expect(buildWeek(seedScenarios, week.number).length).toBeGreaterThan(0);
    }
  });

  it('runs each authored week to the last day of its own budget', () => {
    for (const weekNumber of AUTHORED_WEEKS) {
      const config = WEEKS.find((w) => w.number === weekNumber)!;
      let state = startGame(seedScenarios, weekNumber);
      while (state.phase !== 'summary') {
        const correct = state.current!.options.find((o) => o.correct)!;
        state = advance(choose(state, correct.optionKey, 1, seedScenarios));
        expect(state.breach).toBeNull();
      }
      expect(state.day).toBe(config.days);
    }
  });

  it('authors 15 playable incidents plus follow-ups in each shipped week', () => {
    for (const weekNumber of AUTHORED_WEEKS) {
      expect(buildWeek(seedScenarios, weekNumber)).toHaveLength(15);
      expect(
        seedScenarios.filter((s) => s.week === weekNumber && s.isFollowUp).length
      ).toBeGreaterThan(0);
    }
  });

  it('covers a distinct set of exam objectives in every week', () => {
    const objectivesByWeek = WEEKS.map(
      (w) =>
        new Set(
          seedScenarios.filter((s) => s.week === w.number).map((s) => s.objective)
        )
    );
    for (let i = 0; i < objectivesByWeek.length; i += 1) {
      for (let j = i + 1; j < objectivesByWeek.length; j += 1) {
        const shared = [...objectivesByWeek[i]].filter((o) =>
          objectivesByWeek[j].has(o)
        );
        expect(shared).toEqual([]);
      }
    }
  });
});
