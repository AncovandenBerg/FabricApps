// Seeds Scenario + ScenarioOption from seed/scenarios.json via the typed
// Rayfin data client. Idempotent: upserts on Scenario.code and
// ScenarioOption.optionKey, and deletes options that were removed from the
// JSON. Player telemetry (Session, AttemptEvent) is never touched.
//
// Usage:
//   npm run seed -- --dry-run      validate and print the plan, no network
//   RAYFIN_SEED_PASSWORD=... npm run seed
//
// Auth: signs in as the dedicated seed account (see rayfin/data/seedUser.ts).
// The entity policy grants create/update/delete on the two reference tables
// to that account only; players keep read-only access.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RayfinClient } from '@microsoft/rayfin-client';

import type { CapacityCommandSchema } from '../rayfin/data/schema.js';
import { SEED_USER_EMAIL } from '../rayfin/data/seedUser.js';

interface SeedOption {
  id: string;
  text: string;
  cuCost: number;
  slaDelta: number;
  correct: boolean;
  feedback: string;
  followUp?: string;
}

interface SeedScenario {
  id: string;
  week: number;
  day: number;
  domain: string;
  objective: string;
  title: string;
  incident: string;
  isFollowUp?: boolean;
  options: SeedOption[];
}

interface SeedWeek {
  number: number;
  title: string;
  subtitle: string;
  days: number;
  startingCu: number;
  startingSla: number;
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadRayfinEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  const envFile = readFileSync(join(projectRoot, 'rayfin', '.env'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) vars[match[1].trim()] = match[2].trim();
  }
  return vars;
}

function loadScenarios(): SeedScenario[] {
  const raw = JSON.parse(
    readFileSync(join(projectRoot, 'seed', 'scenarios.json'), 'utf-8')
  );
  return raw.scenarios as SeedScenario[];
}

function loadWeeks(): SeedWeek[] {
  const raw = JSON.parse(
    readFileSync(join(projectRoot, 'seed', 'campaign.json'), 'utf-8')
  );
  return raw.weeks as SeedWeek[];
}

/**
 * Content rules the game depends on. The week checks matter most: a
 * scenario in an unconfigured week is unreachable, and a follow-up that
 * points across a week boundary would drop a player into another week's
 * story mid-incident.
 */
function validate(scenarios: SeedScenario[], weeks: SeedWeek[]): string[] {
  const errors: string[] = [];
  const codes = new Set(scenarios.map((s) => s.id));
  const weekNumbers = new Set(weeks.map((w) => w.number));
  const daysByWeek = new Map(weeks.map((w) => [w.number, w.days]));

  for (const w of weeks) {
    const playable = scenarios.filter((s) => s.week === w.number && !s.isFollowUp);
    if (playable.length === 0) {
      errors.push(`week ${w.number} ("${w.title}") has no playable scenarios`);
    }
    if (w.days < 1) errors.push(`week ${w.number}: days must be at least 1`);
  }
  if (weekNumbers.size !== weeks.length) {
    errors.push('duplicate week numbers in campaign.json');
  }

  for (const s of scenarios) {
    if (!weekNumbers.has(s.week)) {
      errors.push(`${s.id}: week ${s.week} is not configured in campaign.json`);
    }
    const days = daysByWeek.get(s.week);
    if (days !== undefined && (s.day < 1 || s.day > days)) {
      errors.push(`${s.id}: day ${s.day} is outside week ${s.week} (1..${days})`);
    }
    const correct = s.options.filter((o) => o.correct);
    if (correct.length !== 1) {
      errors.push(`${s.id}: expected exactly 1 correct option, found ${correct.length}`);
    }
    if (s.options.length < 2) {
      errors.push(`${s.id}: needs at least 2 options`);
    }
    for (const o of s.options) {
      if (o.followUp) {
        const target = scenarios.find((t) => t.id === o.followUp);
        if (!target) {
          errors.push(`${s.id}/${o.id}: followUp "${o.followUp}" does not exist`);
        } else if (!target.isFollowUp) {
          errors.push(`${s.id}/${o.id}: followUp target "${o.followUp}" is not marked isFollowUp`);
        } else if (target.week !== s.week) {
          errors.push(
            `${s.id}/${o.id}: followUp "${o.followUp}" is in week ${target.week}, not week ${s.week}`
          );
        }
      }
    }
  }
  return [...errors, ...(codes.size !== scenarios.length ? ['duplicate scenario ids'] : [])];
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const scenarios = loadScenarios();
  const weeks = loadWeeks();

  const errors = validate(scenarios, weeks);
  if (errors.length > 0) {
    console.error('Seed content failed validation:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const optionCount = scenarios.reduce((n, s) => n + s.options.length, 0);
  console.log(
    `Validated ${weeks.length} weeks, ${scenarios.length} scenarios, ${optionCount} options.`
  );

  if (dryRun) {
    for (const w of weeks) {
      const inWeek = scenarios.filter((s) => s.week === w.number);
      const playable = inWeek.filter((s) => !s.isFollowUp).length;
      console.log(
        `Week ${w.number} "${w.title}": ${w.days} days, ${playable} incidents, ` +
          `${inWeek.length - playable} follow-ups, ${w.startingCu} CU / ${w.startingSla} SLA`
      );
      for (const s of inWeek) {
        const tags = s.isFollowUp ? ' [follow-up]' : '';
        console.log(`  upsert ${s.id} (day ${s.day}, ${s.domain})${tags}: ${s.options.length} options`);
      }
    }
    console.log('Dry run only; nothing was written.');
    return;
  }

  const password = process.env.RAYFIN_SEED_PASSWORD;
  if (!password) {
    console.error('RAYFIN_SEED_PASSWORD is required (password for the seed account).');
    process.exit(1);
  }

  const env = loadRayfinEnv();
  const baseUrl = env['RAYFIN_PUBLIC_API_URL'];
  const publishableKey = env['RAYFIN_PUBLIC_PUBLISHABLE_KEY'];
  if (!baseUrl || !publishableKey) {
    console.error('rayfin/.env is missing RAYFIN_PUBLIC_API_URL or RAYFIN_PUBLIC_PUBLISHABLE_KEY. Run npx rayfin up first.');
    process.exit(1);
  }

  const client = new RayfinClient<CapacityCommandSchema>({
    baseUrl: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    publishableKey,
    authStorage: false,
  });

  try {
    await client.auth.signUp({ email: SEED_USER_EMAIL, password });
    console.log(`Created seed account ${SEED_USER_EMAIL}.`);
  } catch {
    // Account already exists; sign-in below is the real gate.
  }
  await client.auth.signIn({ email: SEED_USER_EMAIL, password });
  console.log(`Signed in as ${SEED_USER_EMAIL}.`);

  let created = 0;
  let updated = 0;
  let optsCreated = 0;
  let optsUpdated = 0;
  let optsDeleted = 0;

  for (const s of scenarios) {
    const fields = {
      code: s.id,
      week: s.week,
      day: s.day,
      domain: s.domain,
      objective: s.objective,
      title: s.title,
      incident: s.incident,
      isFollowUp: s.isFollowUp ?? false,
    };

    const existing = await client.data.Scenario.select(['id'])
      .where({ code: { eq: s.id } })
      .execute();

    let scenarioId: string;
    if (existing.length > 0) {
      scenarioId = existing[0].id;
      await client.data.Scenario.update({ id: scenarioId }, fields);
      updated++;
    } else {
      const row = await client.data.Scenario.create(fields);
      scenarioId = row.id;
      created++;
    }

    const existingOpts = await client.data.ScenarioOption.select(['id', 'optionKey'])
      .where({ scenario: { id: { eq: scenarioId } } })
      .execute();
    const staleByKey = new Map(existingOpts.map((o) => [o.optionKey, o.id]));

    for (const o of s.options) {
      // null (not undefined) so a followUp removed from the JSON is cleared
      // on rerun. The typed MutationInput only allows string | undefined,
      // but the runtime serializes null and DAB accepts it, hence the cast.
      const followUpCode = (o.followUp ?? null) as unknown as string | undefined;
      const optionFields = {
        optionKey: o.id,
        optionText: o.text,
        cuCost: o.cuCost,
        slaDelta: o.slaDelta,
        correct: o.correct,
        feedback: o.feedback,
        followUpCode,
        scenario: { id: scenarioId },
      };
      const existingId = staleByKey.get(o.id);
      if (existingId) {
        await client.data.ScenarioOption.update({ id: existingId }, optionFields);
        staleByKey.delete(o.id);
        optsUpdated++;
      } else {
        await client.data.ScenarioOption.create(optionFields);
        optsCreated++;
      }
    }

    // Options removed from the JSON since the last run
    for (const staleId of staleByKey.values()) {
      await client.data.ScenarioOption.delete({ id: staleId });
      optsDeleted++;
    }

    console.log(`  ${s.id}: ok`);
  }

  console.log(
    `Done. Scenarios: ${created} created, ${updated} updated. ` +
      `Options: ${optsCreated} created, ${optsUpdated} updated, ${optsDeleted} deleted.`
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
