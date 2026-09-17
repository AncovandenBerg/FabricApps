// Content guardrails for seed/campaign.json + seed/scenarios.json.
//
// Pure: takes already-parsed content, returns a list of problems, does no
// I/O and reads no files. scripts/seed.ts is the thin shell that loads the
// two JSON files and calls in here, and the unit tests call the same
// function with hand-built bad content, so the rules are proven rather
// than merely present.
//
// The week rules are the ones that matter most. A scenario in an
// unconfigured week is unreachable, a day outside its week's range can
// never come up, and a follow-up pointing across a week boundary would
// drop the player into another week's story mid-run.

/** One option exactly as authored in scenarios.json. */
export interface AuthoredOption {
  id: string;
  text: string;
  cuCost: number;
  slaDelta: number;
  correct: boolean;
  feedback: string;
  /** Code of the incident this option triggers when picked. */
  followUp?: string;
}

/** One scenario exactly as authored in scenarios.json. */
export interface AuthoredScenario {
  id: string;
  /** Campaign week. Absent means week 1, so pre-campaign content stays valid. */
  week?: number;
  day: number;
  domain: string;
  objective: string;
  title: string;
  incident: string;
  /** Present (and true) only on incidents reached through a followUp. */
  isFollowUp?: boolean;
  options: AuthoredOption[];
}

/**
 * One week exactly as authored in campaign.json. Structurally identical to
 * WeekConfig in game/campaign.ts, declared separately so the validator has
 * no dependency on the loaded campaign and stays importable from a script.
 */
export interface AuthoredWeek {
  number: number;
  title: string;
  subtitle: string;
  days: number;
  startingCu: number;
  startingSla: number;
}

/** The week a scenario plays in; absent means week 1. */
export function scenarioWeek(scenario: AuthoredScenario): number {
  return scenario.week ?? 1;
}

/**
 * Every rule the game depends on, checked in one pass. Returns one message
 * per problem, empty when the content is sound; the caller decides whether
 * that is a warning or a non-zero exit.
 */
export function validateContent(
  scenarios: AuthoredScenario[],
  weeks: AuthoredWeek[]
): string[] {
  const errors: string[] = [];
  const weekNumbers = new Set(weeks.map((w) => w.number));
  const daysByWeek = new Map(weeks.map((w) => [w.number, w.days]));
  const byId = new Map(scenarios.map((s) => [s.id, s]));

  if (weeks.length === 0) {
    errors.push('campaign.json configures no weeks');
  }
  if (weekNumbers.size !== weeks.length) {
    errors.push('duplicate week numbers in campaign.json');
  }
  if (byId.size !== scenarios.length) {
    errors.push('duplicate scenario ids in scenarios.json');
  }

  for (const week of weeks) {
    // A week with no playable incidents cannot be started at all: the
    // engine has nothing to put in the day queue.
    const playable = scenarios.filter(
      (s) => scenarioWeek(s) === week.number && !s.isFollowUp
    );
    if (playable.length === 0) {
      errors.push(`week ${week.number} ("${week.title}") has no playable incidents`);
    }
    if (week.days < 1) {
      errors.push(`week ${week.number}: days must be at least 1, got ${week.days}`);
    }
    if (week.startingCu < 1) {
      errors.push(
        `week ${week.number}: startingCu must be at least 1, got ${week.startingCu}`
      );
    }
    if (week.startingSla < 1) {
      errors.push(
        `week ${week.number}: startingSla must be at least 1, got ${week.startingSla}`
      );
    }

    // Running out of capacity ends the run, so a week whose correct answers
    // cost more than its budget cannot be finished by anyone, however well
    // they play. Follow-ups are excluded because a perfect run never triggers
    // one. This is measured per week against that week's own budget.
    const perfectCost = playable.reduce(
      (sum, s) => sum + (s.options.find((o) => o.correct)?.cuCost ?? 0),
      0
    );
    if (playable.length > 0 && perfectCost >= week.startingCu) {
      errors.push(
        `week ${week.number} ("${week.title}") cannot be finished: playing every ` +
          `correct option costs ${perfectCost} CU against a budget of ${week.startingCu}`
      );
    }
  }

  for (const scenario of scenarios) {
    const week = scenarioWeek(scenario);

    if (!weekNumbers.has(week)) {
      errors.push(`${scenario.id}: week ${week} is not configured in campaign.json`);
    }

    const days = daysByWeek.get(week);
    if (days !== undefined && (scenario.day < 1 || scenario.day > days)) {
      errors.push(
        `${scenario.id}: day ${scenario.day} is outside week ${week} (1..${days})`
      );
    }

    // Exactly one correct option: the feedback panel, the mastery
    // percentages and the perfect-run test all assume a single right answer.
    const correct = scenario.options.filter((o) => o.correct);
    if (correct.length !== 1) {
      errors.push(
        `${scenario.id}: expected exactly 1 correct option, found ${correct.length}`
      );
    }
    if (scenario.options.length < 2) {
      errors.push(
        `${scenario.id}: needs at least 2 options, found ${scenario.options.length}`
      );
    }

    const optionKeys = new Set(scenario.options.map((o) => o.id));
    if (optionKeys.size !== scenario.options.length) {
      errors.push(`${scenario.id}: duplicate option ids`);
    }

    for (const option of scenario.options) {
      if (!option.followUp) continue;
      const target = byId.get(option.followUp);
      if (!target) {
        errors.push(
          `${scenario.id}/${option.id}: followUp "${option.followUp}" does not exist`
        );
      } else if (!target.isFollowUp) {
        errors.push(
          `${scenario.id}/${option.id}: followUp target "${option.followUp}" is not marked isFollowUp`
        );
      } else if (scenarioWeek(target) !== week) {
        errors.push(
          `${scenario.id}/${option.id}: followUp "${option.followUp}" is in week ` +
            `${scenarioWeek(target)}, not week ${week}`
        );
      }
    }
  }

  return errors;
}
