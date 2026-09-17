# Entity schema contract

This app has no backend. These files are the **documented shape of the
database** for whenever one is reattached, kept here so the schema and the
client-side record shapes cannot drift apart silently.

They are deliberately **not part of the build**:

- `tsconfig.json` includes only `src`, so nothing here is typechecked or bundled
- `eslint.config.js` ignores this folder
- nothing in `src/` imports from here

They are written against `@microsoft/rayfin-core`, which is not a dependency of
this repo. That is intentional: the Fabric-hosted version of Capacity Command
uses exactly these entity definitions, and holding a copy here means a change
made in one place is visible in the other.

## What the game-side code mirrors

| Entity | Field | Client-side counterpart |
| --- | --- | --- |
| `Scenario` | `week` | `GameScenario.week` in `src/game/types.ts` |
| `Session` | `weekNumber` | `StoredSession.weekNumber` in `src/game/telemetry.ts` |
| `AttemptEvent` | `weekNumber` | `AttemptRecord.weekNumber` in `src/game/types.ts` |

All three default to `1`. A database already holding rows from before the
campaign existed therefore survives the schema change: existing scenarios,
sessions and attempts read back as week 1 rather than null. The same default is
applied client side when reading `localStorage` records written by an earlier
build, and `scripts/seed.ts` emits `ALTER TABLE ... ADD ... DEFAULT 1` guards so
the SQL path behaves identically.

`AttemptEvent.weekNumber` is denormalized on purpose. The analytics notebook
reads that one table with no joins, so mastery can be plotted as a learning
curve across the campaign rather than a single average.

## Week structure is not in here

Week count, day counts and starting budgets live in `seed/campaign.json`. The
entity layer only records which week a row belongs to; it never encodes how many
weeks exist or how long one runs.
