# Capacity Command

A DP-700 (Microsoft Fabric Data Engineer) exam prep game, built as a plain
static website. No sign-in, no backend, no database. Drop the built folder on
your site and it runs.

> **Migrated into this repo.** Capacity Command was originally built as a
> Fabric App (Entra sign-in, SQL database) for the Fabric community contest,
> then ported to a plain static build and developed as an npm workspace track
> inside a separate Practiworks site repo. It now lives here as a
> self-contained project: its own Vite build, its own tests, `base: './'` so
> its `dist/` runs from any path, and no import that reaches outside this
> folder. Unlike the other apps in this repo, it does not (yet) use Rayfin —
> see "Known limits" below.

## What it is

Capacity Command is an operational simulator, not a quiz. You are the new
Fabric platform admin at Nordwind Logistics, a fictional company, and you run
its analytics platform through a three-week campaign. Incidents arrive daily:
access requests, failing pipelines, capacity spikes. Every incident maps to a
DP-700 exam objective, every decision costs Capacity Units (CU) and moves your
SLA score, and careless choices trigger chained follow-up incidents. Spend more
capacity than the week has and the platform goes down: the run ends there and
the week has to be done again. You learn trade-off thinking, not answer
memorization.

## The campaign

Three weeks, each with its own story, its own day count and its own capacity
budget. What tightens across the campaign is the headroom, not the number: the
later weeks cost far more to run correctly than they hand you extra budget for.

| Week | Title | Days | Starting CU | Perfect play | Headroom | Story |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Platform on-call | 7 | 100 | 70 | 43% | You inherit the platform and a note reading "Good luck. You will need it." |
| 2 | Peak season | 7 | 130 | 105 | 24% | Parcel volumes are six times normal, finance froze the budget, and week 1's shortcuts are now load bearing. |
| 3 | The merger | 7 | 160 | 140 | 14% | Nordwind absorbed a Belgian carrier. Two platforms, one capacity, and auditors who want everything documented. |

"Perfect play" is what the week costs if every answer is right, which is the
floor a budget has to clear: running out of capacity ends the run, so a week a
perfect player cannot afford is a week nobody could finish. `npm run seed`
enforces that, and the engine tests play all three weeks through to prove it.

Each week holds 15 playable incidents plus follow-ups, and each covers exam
objectives the other weeks do not. Weeks unlock in order: week N+1 opens when
week N is completed. Cleared weeks stay replayable and keep your best result.

## Game rules

- A session is scoped to one campaign week and starts on that week's own CU and
  SLA budget, taken from `seed/campaign.json`
- Each chosen option applies its CU cost and SLA delta (both clamped to 0..200)
- **Spending more capacity than the week has left is a breach: the platform
  goes down and the run ends there.** The decision still shows its feedback,
  then you get a breach report instead of the week report. The week is not
  cleared, nothing new unlocks, and the only way on is to run it again.
  Spending your last unit exactly is survival, not a breach
- Wrong options can enqueue a follow-up incident that plays immediately after
  feedback, always from the same week
- The day advances when its incidents are exhausted; after the week's last day
  you get the end-of-week report, which names the week it just unlocked
- Decision latency (`secondsToDecide`) is captured per attempt
- 45 playable incidents plus 10 follow-ups across three weeks and three exam
  domains

CU costs and SLA deltas are game-balanced values, **not** real Fabric capacity
pricing.

## Run it

Prerequisites: Node 22+. This app is standalone — install its own
dependencies from this folder, not from the repo root.

```bash
npm install
npm run dev             # local dev server, http://127.0.0.1:5180
npm run build           # production build into dist/
npm run preview         # serve the production build locally
npm run lint
npm run typecheck
npm test                # unit and flow tests
npm run seed -- --dry-run   # validate the content, write nothing
npm run seed            # validate, then regenerate seed/seed.sql
```

## Deep links

Wherever this game is hosted, a caller can link directly to one of its
campaign weeks with `?week=<n>` (e.g. `/capacity-command/?week=2`).

`src/game/deepLink.ts` decides what such a link does, and it refuses five
ways: no parameter, unparseable, a week `campaign.json` does not configure, a
week the player has not unlocked, and a link that would discard a *different*
week already in flight. Every refusal falls through to the week list, so a
link to a locked week is safe for the site to publish and the unlock chain
cannot be skipped with a URL.

The decision is a pure function for the same reason the engine is: the
interesting part is the refusals, and they are far easier to prove in
`src/__tests__/deepLink.test.ts` than through a rendered screen. `GamePage`
reads `window.location.search` by default and takes a `search` prop so tests
never touch the real location.

## Put it on your website

`npm run build` produces a `dist/` folder containing `index.html` and an
`assets/` folder. Asset URLs are **relative** (`base: './'` in
`vite.config.ts`), so the same build works from any path without a rebuild.

**As a page on some other site**, copy `dist/` to a subfolder and link to it:

```text
yoursite.com/certprep/          <- contents of dist/
```

No web-server configuration is needed. The app is a single page with no
client-side router, so there is no SPA fallback/rewrite rule to add.

**Embedded in an existing page**: the layout is a fixed 420px-wide column that
centers itself, so it sits well in an iframe:

```html
<iframe
  src="/certprep/"
  title="Capacity Command, DP-700 exam prep"
  style="width: 100%; max-width: 460px; height: 820px; border: 0"
  loading="lazy"
></iframe>
```

The app writes to `localStorage`, which is per-origin. Serving the iframe from
your own domain keeps progress working; a cross-site iframe may have storage
blocked by the browser, in which case the game still plays but nothing is
remembered.

**Fonts** are loaded from Google Fonts in `index.html`. If your site must avoid
third-party requests, self-host Cormorant Garamond and Lora and update that
`<link>`.

## Content and campaign structure

Two files, two jobs. Nothing in the frontend hardcodes a week count, a week
length or a starting budget.

- **`seed/campaign.json`** is the week structure: per week a number, title,
  subtitle, day count, starting CU and starting SLA. This is the file to edit
  when adding, removing or rebalancing a week. `src/game/campaign.ts` loads it
  and is the only module that knows its layout.
- **`seed/scenarios.json`** is the scenario content. Each scenario has a code,
  a `week`, a day, an exam domain, an objective, a title, incident text, and
  2 to 4 options; each option has a CU cost, an SLA delta, a correctness flag,
  feedback text, and optionally a `followUp` code pointing at another scenario
  in the same week. `src/game/data.ts` maps it to the shapes the game consumes.

### Adding a fourth week

A JSON edit, nothing else:

1. Append a week object to `seed/campaign.json` with the next `number`, its
   `title`, `subtitle`, `days`, `startingCu` and `startingSla`.
2. Add scenarios to `seed/scenarios.json` carrying that `week` number, with
   days inside `1..days`.
3. Run `npm run seed -- --dry-run` to check it, then `npm test`.

`startingCu` is the one value worth working out rather than guessing. It has to
clear what the week's correct answers cost, with room to spare, or the week
cannot be finished. The seed gate rejects a budget that does not, and the
engine tests play the week through to be sure.

The campaign list, the week map title, the day counter, the CU and SLA bars,
the unlock chain and the end-of-week report all pick it up with no code change.
A scenario with no `week` field is treated as week 1.

### Content guardrails

`npm run seed` validates before doing anything and exits non-zero on any
problem. The rules live in `src/game/validate.ts`, are pure, and are covered by
`src/__tests__/validate.test.ts`, so the gate is proven rather than merely
present. It fails on:

- a scenario in a week that `campaign.json` does not configure
- a day outside its own week's range (measured per week, not against a global 7)
- a follow-up pointing at a scenario in a different week, which would drop the
  player into another week's story mid-run
- a configured week with no playable incidents, which could not be started
- a week whose correct answers cost more than its budget, which no player could
  finish, since running out of capacity ends the run
- a scenario without exactly one correct option, or with fewer than two options
- duplicate scenario ids, duplicate option ids, duplicate week numbers, and
  nonsensical week balance

## Player data

Everything is stored in the visitor's browser under the `capacity-command:*`
`localStorage` keys. Nothing is sent anywhere; there is no analytics and no
network call at runtime beyond the font stylesheet.

| Key | Contents |
| --- | --- |
| `capacity-command:player` | Guest id and display name |
| `capacity-command:<player-id>` | Weeks cleared, best result per week, breaches per week, per-domain tallies, exam date, week in progress |
| `capacity-command:telemetry` | Session and per-decision history, each stamped with its week |

The telemetry log keeps the same record shapes the database-backed version
wrote, capped at 50 sessions / 2000 attempts so it cannot grow without bound.
Players can download it as JSON from the profile tab. "Reset my progress" in
the profile tab clears all three keys.

Because storage is per-browser, progress does not follow a player across
devices, and clearing site data erases it.

### Upgrading from the single-week build

Saved data written before the campaign existed is migrated on read, never
discarded:

- progress with a non-zero `weeksCompleted` counts as week 1 cleared, so
  returning players find week 2 already unlocked
- a week that was mid-run resumes as week 1, on week 1's budget
- sessions and attempts with no `weekNumber` read back as week 1
- lifetime domain tallies and the exam date are preserved as they were
- progress with no breach counts reads as never having lost a week, and a
  snapshot saved before breaches existed resumes as an intact run

## Repo layout

```text
├── index.html
├── seed/
│   ├── campaign.json            # Week structure (the campaign)
│   ├── scenarios.json           # All scenario content
│   └── seed.sql                 # Generated: idempotent T-SQL upsert
├── schema/                      # Entity schema contract, not built
├── scripts/seed.ts              # Content validation + SQL generation
├── src/
│   ├── game/                    # Engine, campaign, content mapping, deep links, telemetry, progress, player
│   ├── components/              # Screens: home, week list, week map, incident, report, breach, stats, profile
│   ├── pages/GamePage.tsx       # Flow orchestration
│   ├── hooks/usePlayer.ts       # Local guest identity as React state
│   └── __tests__/               # Engine, campaign, guardrail, progress, telemetry, UI flow
```

The engine (`src/game/engine.ts`) is pure: no I/O, no clocks, no storage.
Callers pass `secondsToDecide` in and telemetry happens outside, so the whole
loop is unit-testable. A game is always scoped to a single week and receives
one week config at a time.

Dates in this project are written as DD.MM.YYYY.

## Adding a backend later

The app was ported from a Microsoft Fabric version that used Entra sign-in and
a SQL database. The seams where those attach are kept deliberately narrow:

- **Content**: `loadScenarios()` in `src/game/data.ts` is `async` even though
  it resolves immediately. Point it at an API and nothing else changes.
- **Telemetry**: `createTelemetry()` in `src/game/telemetry.ts` returns a
  `GameTelemetry` implementation. Write a server-backed one with the same four
  methods and swap it in; `GamePage` takes it as an optional prop. The stored
  record shapes (`StoredSession`, `StoredAttempt`) already match what a
  relational table would hold, and `AttemptEvent` records stay denormalized
  (week, domain, objective, correctness copied onto each row) so they can be
  read without joins.
- **Identity**: `src/game/player.ts` mints the guest id. A real sign-in would
  replace `ensurePlayer()` and keep the rest of the app untouched.
- **Schema**: `schema/` holds the entity definitions the Fabric-hosted version
  uses, as a contract. `Scenario.week`, `Session.weekNumber` and
  `AttemptEvent.weekNumber` all default to 1, so a database already holding
  pre-campaign rows survives the schema change. See `schema/README.md`.
- **Seeding**: `npm run seed` regenerates `seed/seed.sql`, an idempotent script
  that creates the tables if absent, adds the campaign columns with a DEFAULT
  of 1 where they are missing, and MERGEs the content on its business keys.

`AttemptEvent.weekNumber` sitting on the event itself is what lets the
analytics notebook read one table with no joins and show mastery as a learning
curve across the campaign instead of a single average. The stats tab does the
same thing client side, from the best result recorded per week.

## Deploy

There is no `rayfin/rayfin.yml` here, unlike the other apps in this repo:
this is currently a static build, not a Fabric App item. Run `npm run build`
and host `dist/` anywhere that serves static files (see "Put it on your
website" above). Turning it back into a deployed Fabric App means scaffolding
a Rayfin project around it and wiring `schema/` into `rayfin/data/`, per
"Adding a backend later" above.

## Known limits

- No Rayfin scaffold yet, so it does not deploy through `npx rayfin up` like
  the rest of this repo. It runs as a static site instead.
- No sign-in and no server-side storage: progress lives in the browser's
  `localStorage` only, per player, per origin.
- CU costs and SLA deltas are game-balanced values, not real Fabric capacity
  pricing.
