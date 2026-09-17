// Proves the seed guardrails reject the content they are supposed to
// reject. scripts/seed.ts calls exactly this function, so a green run here
// means the seed gate is real and not just present.
import { describe, expect, it } from 'vitest';

import {
  validateContent,
  type AuthoredScenario,
  type AuthoredWeek,
} from '@/game/validate';

import campaignJson from '../../seed/campaign.json';
import scenariosJson from '../../seed/scenarios.json';

function week(overrides: Partial<AuthoredWeek> = {}): AuthoredWeek {
  return {
    number: 1,
    title: 'Platform on-call',
    subtitle: 'story',
    days: 7,
    startingCu: 100,
    startingSla: 100,
    ...overrides,
  };
}

function scenario(overrides: Partial<AuthoredScenario> = {}): AuthoredScenario {
  return {
    id: 'S01',
    week: 1,
    day: 1,
    domain: 'implement-manage',
    objective: 'obj',
    title: 'title',
    incident: 'incident',
    options: [
      { id: 'A', text: 'right', cuCost: 0, slaDelta: 5, correct: true, feedback: 'ok' },
      { id: 'B', text: 'wrong', cuCost: 0, slaDelta: -5, correct: false, feedback: 'no' },
    ],
    ...overrides,
  };
}

/** Every message, joined, so assertions can look for a phrase. */
function report(scenarios: AuthoredScenario[], weeks: AuthoredWeek[]): string {
  return validateContent(scenarios, weeks).join('\n');
}

describe('the shipped content passes', () => {
  it('has no validation errors', () => {
    expect(
      validateContent(
        scenariosJson.scenarios as AuthoredScenario[],
        campaignJson.weeks as AuthoredWeek[]
      )
    ).toEqual([]);
  });
});

describe('guardrail: a week nobody could finish', () => {
  it('rejects a budget that perfect play would overspend', () => {
    const scenarios = [
      scenario({
        id: 'S01',
        options: [
          { id: 'A', text: 'right', cuCost: 60, slaDelta: 5, correct: true, feedback: 'ok' },
          { id: 'B', text: 'wrong', cuCost: 1, slaDelta: -5, correct: false, feedback: 'no' },
        ],
      }),
      scenario({
        id: 'S02',
        day: 2,
        options: [
          { id: 'A', text: 'right', cuCost: 50, slaDelta: 5, correct: true, feedback: 'ok' },
          { id: 'B', text: 'wrong', cuCost: 1, slaDelta: -5, correct: false, feedback: 'no' },
        ],
      }),
    ];
    expect(report(scenarios, [week({ startingCu: 100 })])).toMatch(
      /cannot be finished: playing every correct option costs 110 CU against a budget of 100/
    );
  });

  it('rejects a budget that only exactly covers perfect play', () => {
    // Spending the last unit survives, but leaves nothing for a follow-up,
    // so an exact match is treated as unfinishable rather than as a tight win.
    const scenarios = [
      scenario({
        options: [
          { id: 'A', text: 'right', cuCost: 100, slaDelta: 5, correct: true, feedback: 'ok' },
          { id: 'B', text: 'wrong', cuCost: 1, slaDelta: -5, correct: false, feedback: 'no' },
        ],
      }),
    ];
    expect(report(scenarios, [week({ startingCu: 100 })])).toMatch(
      /cannot be finished/
    );
  });

  it('accepts a budget with headroom over perfect play', () => {
    expect(report([scenario()], [week({ startingCu: 100 })])).toBe('');
  });

  // Follow-ups only fire on a wrong answer, so they are not part of the
  // perfect path and must not count against the budget.
  it('ignores follow-ups when costing the perfect path', () => {
    const scenarios = [
      scenario({
        options: [
          { id: 'A', text: 'right', cuCost: 10, slaDelta: 5, correct: true, feedback: 'ok' },
          {
            id: 'B',
            text: 'wrong',
            cuCost: 0,
            slaDelta: -5,
            correct: false,
            feedback: 'no',
            followUp: 'S01F',
          },
        ],
      }),
      scenario({
        id: 'S01F',
        isFollowUp: true,
        options: [
          { id: 'A', text: 'right', cuCost: 90, slaDelta: 5, correct: true, feedback: 'ok' },
          { id: 'B', text: 'wrong', cuCost: 90, slaDelta: -5, correct: false, feedback: 'no' },
        ],
      }),
    ];
    expect(report(scenarios, [week({ startingCu: 20 })])).toBe('');
  });
});

describe('guardrail: a scenario in an unconfigured week', () => {
  it('is rejected', () => {
    const errors = report([scenario(), scenario({ id: 'X1', week: 4 })], [week()]);
    expect(errors).toMatch(/X1: week 4 is not configured in campaign.json/);
  });

  it('accepts content with no week field as week 1', () => {
    const noWeek = scenario({ id: 'S02' });
    delete noWeek.week;
    expect(validateContent([noWeek], [week()])).toEqual([]);
  });
});

describe('guardrail: a day outside its week range', () => {
  it('rejects a day past the end of the week', () => {
    const errors = report([scenario({ day: 8 })], [week({ days: 7 })]);
    expect(errors).toMatch(/S01: day 8 is outside week 1 \(1\.\.7\)/);
  });

  it('rejects a day below 1', () => {
    const errors = report([scenario({ day: 0 })], [week()]);
    expect(errors).toMatch(/day 0 is outside week 1/);
  });

  it('measures against that week own day count, not a global constant', () => {
    const weeks = [week(), week({ number: 2, days: 4 })];
    const scenarios = [
      scenario({ id: 'S01', day: 7 }),
      scenario({ id: 'W2S01', week: 2, day: 4 }),
      scenario({ id: 'W2S02', week: 2, day: 5 }),
    ];
    const errors = report(scenarios, weeks);
    expect(errors).toMatch(/W2S02: day 5 is outside week 2 \(1\.\.4\)/);
    // The week-1 day 7 and week-2 day 4 scenarios are both fine
    expect(errors).not.toMatch(/S01:/);
    expect(errors).not.toMatch(/W2S01:/);
  });
});

describe('guardrail: a follow-up pointing at another week', () => {
  it('is rejected, because it would drop the player into the wrong story', () => {
    const weeks = [week(), week({ number: 2 })];
    const scenarios = [
      scenario({
        id: 'S01',
        options: [
          {
            id: 'A',
            text: 'right',
            cuCost: 0,
            slaDelta: 5,
            correct: true,
            feedback: 'ok',
          },
          {
            id: 'B',
            text: 'wrong',
            cuCost: 0,
            slaDelta: -5,
            correct: false,
            feedback: 'no',
            followUp: 'W2S01F',
          },
        ],
      }),
      scenario({ id: 'W2S01', week: 2 }),
      scenario({ id: 'W2S01F', week: 2, isFollowUp: true }),
    ];
    expect(report(scenarios, weeks)).toMatch(
      /S01\/B: followUp "W2S01F" is in week 2, not week 1/
    );
  });

  it('rejects a follow-up that does not exist', () => {
    const scenarios = [
      scenario({
        options: [
          {
            id: 'A',
            text: 'right',
            cuCost: 0,
            slaDelta: 5,
            correct: true,
            feedback: 'ok',
          },
          {
            id: 'B',
            text: 'wrong',
            cuCost: 0,
            slaDelta: -5,
            correct: false,
            feedback: 'no',
            followUp: 'NOPE',
          },
        ],
      }),
    ];
    expect(report(scenarios, [week()])).toMatch(
      /S01\/B: followUp "NOPE" does not exist/
    );
  });

  it('rejects a follow-up target that is not marked isFollowUp', () => {
    const scenarios = [
      scenario({
        options: [
          {
            id: 'A',
            text: 'right',
            cuCost: 0,
            slaDelta: 5,
            correct: true,
            feedback: 'ok',
          },
          {
            id: 'B',
            text: 'wrong',
            cuCost: 0,
            slaDelta: -5,
            correct: false,
            feedback: 'no',
            followUp: 'S02',
          },
        ],
      }),
      scenario({ id: 'S02', day: 2 }),
    ];
    expect(report(scenarios, [week()])).toMatch(
      /S01\/B: followUp target "S02" is not marked isFollowUp/
    );
  });

  it('accepts a follow-up inside the same week', () => {
    const scenarios = [
      scenario({
        options: [
          {
            id: 'A',
            text: 'right',
            cuCost: 0,
            slaDelta: 5,
            correct: true,
            feedback: 'ok',
          },
          {
            id: 'B',
            text: 'wrong',
            cuCost: 0,
            slaDelta: -5,
            correct: false,
            feedback: 'no',
            followUp: 'S01F',
          },
        ],
      }),
      scenario({ id: 'S01F', isFollowUp: true }),
    ];
    expect(validateContent(scenarios, [week()])).toEqual([]);
  });
});

describe('guardrail: a week with no playable incidents', () => {
  it('rejects a week whose only content is follow-ups', () => {
    const weeks = [week(), week({ number: 2, title: 'Peak season' })];
    const scenarios = [
      scenario({ id: 'S01' }),
      scenario({ id: 'W2S01F', week: 2, isFollowUp: true }),
    ];
    expect(report(scenarios, weeks)).toMatch(
      /week 2 \("Peak season"\) has no playable incidents/
    );
  });

  it('rejects a configured week with no content at all', () => {
    const weeks = [week(), week({ number: 2, title: 'Peak season' })];
    expect(report([scenario()], weeks)).toMatch(
      /week 2 \("Peak season"\) has no playable incidents/
    );
  });
});

describe('guardrail: a scenario without exactly one correct option', () => {
  it('rejects two correct options', () => {
    const scenarios = [
      scenario({
        options: [
          { id: 'A', text: 'a', cuCost: 0, slaDelta: 0, correct: true, feedback: 'f' },
          { id: 'B', text: 'b', cuCost: 0, slaDelta: 0, correct: true, feedback: 'f' },
        ],
      }),
    ];
    expect(report(scenarios, [week()])).toMatch(
      /S01: expected exactly 1 correct option, found 2/
    );
  });

  it('rejects zero correct options', () => {
    const scenarios = [
      scenario({
        options: [
          { id: 'A', text: 'a', cuCost: 0, slaDelta: 0, correct: false, feedback: 'f' },
          { id: 'B', text: 'b', cuCost: 0, slaDelta: 0, correct: false, feedback: 'f' },
        ],
      }),
    ];
    expect(report(scenarios, [week()])).toMatch(
      /S01: expected exactly 1 correct option, found 0/
    );
  });

  it('rejects a single-option scenario', () => {
    const scenarios = [
      scenario({
        options: [
          { id: 'A', text: 'a', cuCost: 0, slaDelta: 0, correct: true, feedback: 'f' },
        ],
      }),
    ];
    expect(report(scenarios, [week()])).toMatch(/S01: needs at least 2 options/);
  });
});

describe('structural guardrails', () => {
  it('rejects duplicate scenario ids', () => {
    expect(report([scenario(), scenario()], [week()])).toMatch(
      /duplicate scenario ids/
    );
  });

  it('rejects duplicate option ids', () => {
    const scenarios = [
      scenario({
        options: [
          { id: 'A', text: 'a', cuCost: 0, slaDelta: 0, correct: true, feedback: 'f' },
          { id: 'A', text: 'b', cuCost: 0, slaDelta: 0, correct: false, feedback: 'f' },
        ],
      }),
    ];
    expect(report(scenarios, [week()])).toMatch(/S01: duplicate option ids/);
  });

  it('rejects duplicate week numbers', () => {
    expect(report([scenario()], [week(), week()])).toMatch(
      /duplicate week numbers/
    );
  });

  it('rejects an empty campaign', () => {
    expect(report([scenario()], [])).toMatch(/configures no weeks/);
  });

  it('rejects nonsensical week balance', () => {
    const errors = report(
      [scenario()],
      [week({ days: 0, startingCu: 0, startingSla: 0 })]
    );
    expect(errors).toMatch(/days must be at least 1/);
    expect(errors).toMatch(/startingCu must be at least 1/);
    expect(errors).toMatch(/startingSla must be at least 1/);
  });

  it('collects every problem rather than stopping at the first', () => {
    const errors = validateContent(
      [scenario({ id: 'S01', week: 9, day: 99 })],
      [week()]
    );
    expect(errors.length).toBeGreaterThan(1);
  });
});
