// Loads the game content and maps it to the plain shapes the game consumes.
//
// The content ships with the bundle (`seed/scenarios.json`) instead of
// coming from a database, so the app is a pure static site with no backend.
// The async signature is deliberate: this function is the single seam where a
// remote content source (API, CMS, SQL) can be reattached later without any
// change to the game or the UI.
//
// Week structure is not here. It lives in seed/campaign.json and is loaded
// by game/campaign.ts; this module only carries the `week` each scenario
// declares.

import { scenarioWeek, type AuthoredOption, type AuthoredScenario } from './validate';

import type { GameOption, GameScenario } from './types';

import raw from '../../seed/scenarios.json';

interface RawContent {
  meta: {
    game: string;
    cert: string;
    company: string;
    domains: { id: string; label: string; weight: string }[];
  };
  scenarios: AuthoredScenario[];
}

const content = raw as RawContent;

/** Title, certification and company the content was authored for. */
export const contentMeta = content.meta;

export type ScenarioLoader = () => Promise<GameScenario[]>;

function toOption(option: AuthoredOption): GameOption {
  return {
    optionKey: option.id,
    optionText: option.text,
    cuCost: option.cuCost,
    slaDelta: option.slaDelta,
    correct: option.correct,
    feedback: option.feedback,
    followUpCode: option.followUp ?? null,
  };
}

function toScenario(scenario: AuthoredScenario): GameScenario {
  return {
    code: scenario.id,
    // Content authored before weeks existed carries no `week` and plays as
    // week 1, matching the entity default.
    week: scenarioWeek(scenario),
    day: scenario.day,
    domain: scenario.domain,
    objective: scenario.objective,
    title: scenario.title,
    incident: scenario.incident,
    isFollowUp: scenario.isFollowUp ?? false,
    options: [...scenario.options]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toOption),
  };
}

/** The full scenario list, mapped once at module load. */
export const scenarios: GameScenario[] = content.scenarios.map(toScenario);

export async function loadScenarios(): Promise<GameScenario[]> {
  return scenarios;
}
