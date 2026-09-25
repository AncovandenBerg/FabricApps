# Fabric and Fabric Apps

> A live-talk control room built as a Microsoft Fabric App: the presenter drives the deck from one
> device, the audience joins from their phones and votes, and the projector never needs a hand near the
> keyboard.

> [!WARNING]
> Fabric Apps is in public preview. Breaking changes, shifting APIs and region gaps are expected. This is
> a talk prop, not production code.

## What it does

Three routes, three audiences:

- **`/display`** — the projected screen. Shows a QR code and a live headcount in the lobby, then mirrors
  whatever stage the presenter is on: a Fabric overview, a workload-by-workload zoom, the Fabric Apps
  pitch, a live poll with animated results.
- **`/join`** — anonymous, opened by scanning that QR code. Attendees give a first name, then vote on
  whichever poll the presenter has open and watch the results roll in.
- **`/control`** — the presenter's second device, gated behind Fabric SSO. Steps through the 11 stages of
  the talk, opens and closes polls, and drives the workload-zoom diagram.

All three read the same singleton `Session` row, so opening or closing a poll on `/control` shows up on
`/display` and `/join` within a couple of seconds, no manual refresh anywhere.

The talk this app was built for is *about* Fabric Apps — it's Fabric overview, then Fabric Apps deep dive,
delivered through a live Fabric App instead of a slide deck. `research/fabric-apps-research.md` has the
source notes.

## How it is built

**Data model** (`rayfin/data/`):

| Entity | Purpose | Access |
| --- | --- | --- |
| `Session` | Singleton control row: current stage, workload index, reveal step, active poll | anonymous + authenticated read; only the presenter (`isPresenter` policy) can create/update |
| `Poll`, `PollOption` | Presenter-authored questions and answers | anonymous + authenticated read; presenter-only write |
| `PollResponse` | One row per vote, append-only | anonymous create + read (no update/delete for anyone) — the "feedback form" pattern, so nobody can tamper with someone else's vote via the API |
| `Attendee` | Recorded on name entry, drives the lobby headcount and name pills | anonymous create + read |

The presenter allowlist (`rayfin/data/presenter.ts`) reads from a `PRESENTER_EMAILS` environment variable
rather than hardcoding addresses — the row-level policy compiles to a static SQL string at build/deploy
time, so this has to be read from `rayfin/.env`, not looked up per request. See
[Run it locally](#run-it-locally).

**Backend:** Rayfin generates a SQL database (`mssql` dialect) and a GraphQL API from the entities above,
plus auth and static hosting, all as one Fabric item (`rayfin/rayfin.yml`).

**No push or subscriptions in this preview** — every "live" screen (`Session` state, poll tallies, the
attendee list) polls the GraphQL API on an interval instead (`src/hooks/usePolling.ts`). That's the one
mechanism everything above is built on.

**Frontend:** React + Vite + Tailwind, with `framer-motion` for the stage transitions and vote-count bars,
and `qrcode.react` for the join code. Sign-in is Fabric SSO in production
(`src/services/RayfinAuthService.ts`) and a fixed local email/password account in dev
(`src/services/MockAuthService.ts`) — `bootstrapAuth()` picks between them based on the API URL.

## Repo layout

```text
├── rayfin/
│   ├── rayfin.yml            # Fabric service configuration
│   ├── .env.example          # documented variables, never the real .env
│   └── data/                 # entities — decorators compile to SQL schema + GraphQL API + row-level policy
├── research/
│   └── fabric-apps-research.md   # source notes for the talk itself
└── src/
    ├── routes/                # Control.tsx, Display.tsx, Join.tsx — the three audiences
    ├── components/display/    # one component per talk stage, mounted by Display.tsx
    ├── content/                # stage titles and the Fabric-workload copy shown on screen
    ├── hooks/                  # usePolling, useSession, usePollResults, useAttendees
    └── services/               # Rayfin client, auth (Fabric SSO / local mock), typed CRUD wrappers
```

## Run it locally

```bash
npm install
cp rayfin/.env.example rayfin/.env
# edit rayfin/.env and set PRESENTER_EMAILS to your own address(es)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Local sign-in uses a fixed email/password account
against the bundled local backend, so you don't need Entra ID configured to click around `/control`. Visit
`/control`, sign in, and step through the stages — `/display` and `/join` picks up the state within a
couple of seconds via polling.

## Deploy

```bash
npx rayfin up --workspace "<your-workspace>"
```

Schema changes come from the entities under `rayfin/data/`, not the Fabric portal: edit the model, then
`npx rayfin up` (or `npx rayfin up db apply` for a schema-only push). Once deployed, `/control` requires
Fabric SSO, so anyone signing in needs to match an address in `PRESENTER_EMAILS`.

## What I learned

- **Anonymous data access needs three independent opt-ins** — a tenant-level toggle, an app-level setting,
  and the `@role('anonymous', …)` decorator on the entity itself — before a QR-code attendee can write
  anything at all. Miss one and the write just fails with no obvious hint which switch is off.
- **Row-level policies are compiled, not evaluated at request time.** `isPresenter()` runs once when the
  schema is built, not per GraphQL call — which is why the presenter allowlist has to come from an
  environment variable read at deploy time rather than, say, a database lookup.
- **No push or subscriptions yet.** Every screen that looks "live" — the session stage, the vote tallies,
  the lobby headcount — is polling the GraphQL API on a plain interval. Fine for a room full of people
  voting a few times each; not a pattern to reach for at real scale.
- **The frontend has zero Fabric chrome.** Deployed to a Fabric-hosted URL, `/display` looks like any other
  web app, not "a Fabric item" — which is exactly what makes disguising a live demo as a normal
  presentation possible in the first place.

## Known limits

- Anonymous visitors can also *read* `PollResponse` rows (not just create them) — accepted because the
  data is a first name and a multiple-choice pick, not because it can't be locked down further. Don't
  reuse this entity shape for anything more sensitive without revisiting that decision.
- One global `Session` row — this runs one talk at a time, not concurrent sessions.
- The stage content and poll questions (`src/content/`, `src/components/display/*Scene.tsx`,
  `PLACEHOLDER_POLLS` in `src/routes/Control.tsx`) are this specific talk's material, not a generic
  "author your own deck" template. Repurposing this for a different talk means rewriting those, not
  configuring them.
