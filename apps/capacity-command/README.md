# Capacity Command

A DP-700 (Microsoft Fabric Data Engineer) exam prep game, built with **Rayfin on Microsoft Fabric** for the Fabric Apps community contest.

**Play it now (no account needed):** https://fleet-wind-acd40beca5-westeurope.webapp.fabricapps.net

## What it is

Capacity Command is an operational simulator, not a quiz. You are the new Fabric platform admin at Nordwind Logistics, a fictional company, and you run its analytics platform through a campaign of simulated 7-day weeks. Incidents arrive daily: access requests, failing pipelines, capacity spikes. Every incident maps to a DP-700 exam objective, every decision costs Capacity Units (CU) and moves your SLA score, and careless choices trigger chained follow-up incidents. You learn trade-off thinking, not answer memorization.

Three weeks ship with the game, each with its own story and a tighter budget than the last:

| Week | Title | Setting | Budget |
| --- | --- | --- | --- |
| 1 | Platform on-call | Your first week on the job | 100 CU |
| 2 | Peak season | Black Friday volumes, frozen capacity budget | 90 CU |
| 3 | The merger | Nordwind absorbs a Belgian carrier, auditors arrive | 80 CU |

Weeks unlock in order: finishing one opens the next. Each week has 15 incidents plus its own follow-ups, and no objective is repeated across weeks.

The meta layer: **the game's backend is itself a DP-700 exercise.** Every decision is written as an append-only `AttemptEvent` to the Rayfin SQL database, which lands in OneLake. A Fabric notebook transforms this telemetry (bronze) into per-domain mastery scores (gold), feeding a Direct Lake semantic model and a Power BI report. The app teaches Fabric while its own telemetry pipeline demonstrates it.

## Game rules

- A session plays one campaign week and starts on that week's configured CU and SLA budget
- Each chosen option applies its CU cost and SLA delta (both clamped to 0..200)
- Wrong options can enqueue a follow-up incident that plays immediately after feedback
- The day advances when its incidents are exhausted; after the week's last day you get the report
- Decision latency (`secondsToDecide`) is captured per attempt
- 15 regular incidents per week plus that week's follow-ups, spread over the 3 exam domains
- Week N+1 unlocks when week N is completed; cleared weeks stay replayable

CU costs and SLA deltas are game-balanced values, **not** real Fabric capacity pricing.

## Configuring the campaign

The campaign is data, not code. Two files own it:

- **`seed/campaign.json`** defines which weeks exist and how each is balanced: `number`, `title`, `subtitle`, `days`, `startingCu`, `startingSla`. Add an object here and a fourth week appears in the app, in the week list, and in the unlock chain.
- **`seed/scenarios.json`** holds the incidents. Every scenario carries a `week` field that must match a configured week number, and a `day` that must fall inside that week's `days`.

`npm run seed -- --dry-run` validates both and prints a per-week summary. It fails on a scenario in an unconfigured week, a day outside its week, a follow-up pointing across a week boundary, a week with no playable incidents, or a scenario without exactly one correct option. Nothing about week count or week length is hardcoded in the frontend; `src/game/campaign.ts` reads `campaign.json` and everything else derives from it.

After editing either file, run `npm run seed:sql` and apply the generated `seed/seed.sql`.

## Architecture

```text
React + Vite frontend (this repo)
        |  typed GraphQL client (@microsoft/rayfin-client)
Rayfin AppBackend on Fabric (schema generated from decorators in rayfin/data/)
        |  Fabric SQL database
        |  (mirrors to OneLake automatically)
Fabric notebook: bronze -> gold mastery scores        (outside this repo)
Direct Lake semantic model + Power BI report          (outside this repo)
```

**Entities** (`rayfin/data/`):

| Entity | Purpose | Access |
| --- | --- | --- |
| `Scenario`, `ScenarioOption` | Game content, seeded from `seed/scenarios.json` | read for everyone; writes only for the seed identity (row-level policy on a claims literal) |
| `Session` | One playthrough of one week: `weekNumber`, CU, SLA, day, completion | signed-in players scoped by `claims.sub`; guests create/update only |
| `AttemptEvent` | One row per decision, **append-only** | signed-in players create/read own rows; guests create only |

`AttemptEvent` is deliberately denormalized (week, domain, objective, correctness copied onto each row) so the analytics notebook reads one table with no joins. `weekNumber` on the event is what lets the gold layer show mastery as a learning curve across the campaign, not just a single average. The analytics layer should filter to sessions with `completed = 1` or at least one attempt, since opening the report screen pre-creates the next session row.

**Guest mode:** the app is playable from a bare link. Guests get a browser-local `guest-<uuid>` identity and write telemetry through Rayfin's anonymous role, which is create-only: nobody can browse telemetry anonymously. Guest and organization players are distinguishable in the data by the `userId` prefix.

## Repo layout

```text
├── rayfin/
│   ├── rayfin.yml            # Fabric service configuration
│   └── data/                 # Entity model (decorators -> SQL schema + GraphQL API)
├── seed/
│   ├── campaign.json         # Week structure: which weeks exist and their balance
│   ├── scenarios.json        # All game content (single source of truth)
│   └── seed.sql              # Generated idempotent T-SQL seed (see rough edges)
├── scripts/
│   ├── seed.ts               # Typed-client seed (local backends only, see rough edges)
│   └── seed-sql.ts           # Generates seed/seed.sql from scenarios.json
└── src/
    ├── game/                 # Pure game engine, data mapping, telemetry, progress
    ├── components/           # Screens: home, week map, incident, report, stats, profile
    ├── pages/GamePage.tsx    # Flow orchestration
    └── services/             # Rayfin client + auth (Entra SSO, local mock, guest)
```

Game content changes go in `scenarios.json` and week structure in `campaign.json`; nothing is hardcoded in components.

## Setup

Prerequisites: Node 22+, a Microsoft Fabric workspace with the **Fabric data apps (preview)** tenant setting enabled. For shared-link guest play, the tenant admin must also grant anonymous access for Fabric Apps (see rough edges).

```bash
npm install
npx rayfin login          # Entra ID sign-in
npx rayfin up             # deploy backend + schema + static app to Fabric
npm run seed:sql          # regenerate seed/seed.sql from scenarios.json
# run seed/seed.sql against the workspace SQL database (Fabric portal query editor)
npm run dev               # local frontend against the deployed backend
```

Dates in this project are written as DD.MM.YYYY.

## Rough edges

Rayfin on Fabric is a public preview. These are the walls we hit, kept here because they are half the story of building on a preview platform (versions: `@microsoft/rayfin-* 1.34`, CLI 1.34):

1. **Scaffolding on Windows:** `npm create @microsoft/rayfin@latest` can fail in an empty directory with a spurious "Missing package.json" + ENOENT. Workaround: run `npx @microsoft/create-rayfin@latest` directly or `npm init -y` first.
2. **Password auth is hard-disabled on deployed backends** even with `services.auth.password.enabled: true` in `rayfin.yml`, and even though the official docs demonstrate a seed script using email/password sign-up. Deployed apps are Entra SSO only. Consequence: the documented typed-client seeding pattern cannot work against Fabric. Workaround: `scripts/seed-sql.ts` generates idempotent T-SQL to run against the workspace SQL database directly.
3. **No elevated seed mechanism:** only two roles exist (`anonymous`, `authenticated`) and there are no service keys for data access, so read-only reference data can only be made writable by encoding a specific account identity as a literal in a row-level policy.
4. **Anonymous access needs an undocumented tenant-admin grant.** The `@anonymous()` decorator docs never mention it; you find out when the schema apply fails with 403 at deploy time.
5. **Anonymous create-without-read errors even though the write succeeds.** DAB performs the mutation, then returns "the mutation was successful but the current user is unauthorized to view the response". Workaround: generate primary keys client-side and treat that specific error as success.
6. **`rayfin up` prints a success banner even when the database apply step fails.** Check the log lines, not the party emoji.
7. **`rayfin up status` can show the wrong SQL database** when an older deployment with a similar name exists in the workspace. Cost us an hour staring at an empty database.
8. **Docs vs typings mismatches:** the permissions guide calls the policy option `check`, the shipped typings call it `policy`. The docs say to filter by FK column (`scenario_id`), the shipped `FilterInput` typings require a nested relationship filter (`scenario: { id: { eq } }`).
9. **The typed mutation input forbids `null`** for optional fields although the runtime serializes it and DAB accepts it, so clearing an optional column requires a type cast.
10. **`@text()` without `max`** generates NVARCHAR(MAX) columns that can break GraphQL schema generation at runtime (documented in known limitations, easy to hit).
11. The advertised `--gen-config-only` CLI flag does not exist in CLI 1.34; use `--dry-run` or the exported `SchemaAnalyzer`/`ConfigGenerator` from `@microsoft/rayfin-core/analysis`.
12. Cosmetic: `rayfin up status` prints "Invalid JSON response" on its health probe even when the endpoint is healthy.

## Contest

Built for the Microsoft Fabric Apps community contest (Builder track). Deadline 01.09.2026.
