// Loads the seeded reference data (Scenario + ScenarioOption) through the
// typed Rayfin client and maps it to the plain shapes the game consumes.

import { getRayfinClient } from '@/services/rayfinClient';

import type { GameOption, GameScenario } from './types';

// Reference data is bounded (55 scenarios, ~186 options across three weeks),
// still well under one page. .first() raises the page cap as a safety margin
// against content growth.
const PAGE_SIZE = 1000;

export type ScenarioLoader = () => Promise<GameScenario[]>;

export async function loadScenarios(): Promise<GameScenario[]> {
  const client = getRayfinClient();

  const scenarioRows = await client.data.Scenario.select([
    'id',
    'code',
    'week',
    'day',
    'domain',
    'objective',
    'title',
    'incident',
    'isFollowUp',
  ])
    .first(PAGE_SIZE)
    .execute();

  const optionRows = await client.data.ScenarioOption.select([
    'optionKey',
    'optionText',
    'cuCost',
    'slaDelta',
    'correct',
    'feedback',
    'followUpCode',
    'scenario.id',
  ])
    .first(PAGE_SIZE)
    .execute();

  const optionsByScenarioId = new Map<string, GameOption[]>();
  for (const row of optionRows) {
    const scenarioId = row.scenario?.id;
    if (!scenarioId) continue;
    const list = optionsByScenarioId.get(scenarioId) ?? [];
    list.push({
      optionKey: row.optionKey,
      optionText: row.optionText,
      cuCost: row.cuCost,
      slaDelta: row.slaDelta,
      correct: row.correct,
      feedback: row.feedback,
      followUpCode: row.followUpCode ?? null,
    });
    optionsByScenarioId.set(scenarioId, list);
  }

  return scenarioRows.map((row) => ({
    code: row.code,
    week: row.week,
    day: row.day,
    domain: row.domain,
    objective: row.objective,
    title: row.title,
    incident: row.incident,
    isFollowUp: row.isFollowUp,
    options: (optionsByScenarioId.get(row.id) ?? []).sort((a, b) =>
      a.optionKey.localeCompare(b.optionKey)
    ),
  }));
}
