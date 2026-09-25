# Microsoft Fabric Apps — Research Notes (Sept 2026)

Research compiled for an internal talk (Fabric overview → Fabric Apps deep dive), where the talk itself is delivered via a live Fabric App.

## TL;DR

The three source blogs originally supplied, plus official Microsoft Learn docs, describe a **brand-new preview feature launched at Microsoft Build 2026 (June 2, 2026)**: **Fabric Apps (Preview)**, built on an open-source SDK/CLI called **Rayfin**. This is *not* the older, mature Power BI-style "org app" packaging feature (which just wraps existing reports/dashboards for an audience — publish, set up audiences, share a link — and cannot accept live input). Fabric Apps is a genuine code-first backend-as-a-service: you define data models in TypeScript, and Fabric auto-generates a SQL database, a GraphQL API, authentication, and static hosting for a fully custom frontend.

## What it is

- A managed backend-as-a-service Fabric item type. You define data models in **TypeScript** using decorators: `@entity()`, `@text()`, `@uuid()`, `@boolean()`, `@date()`, `@one()`, `@many()`, `@role()`.
- Fabric auto-generates from that model:
  - A **SQL database in Fabric** with your schema.
  - A **GraphQL API** at `/api/graphql` — read (queries) and write (mutations) only; no documented subscription/push support.
  - **Row-level authorization** compiled from `@role()` policies.
  - Type-safe client methods via a generated `RayfinClient`.
- Also included out of the box:
  - **Authentication** at `/auth`.
  - **Static hosting** at `/storage` for a custom frontend (typically React + Vite), served at a public **App URL**.
- One app = one backend URL `https://<app>-app.rayfin.windows.net/` fronting GraphQL/auth/storage, plus a separate public App URL serving the built frontend.
- Item permissions inside a workspace: **Run and interact** (read+execute, default for workspace members) vs **Edit** (deploy/manage) vs **Reshare** (grant others access, needs workspace admin).

## How you build and deploy it

- `npm create @microsoft/rayfin@latest -- "<name>" --template <template> --workspace <workspace>` scaffolds a new project; `npx rayfin init .` scaffolds into an existing folder.
- Confirmed/observed template slugs: `blankapp` (bare Fabric-authenticated React+Vite app, no data layer), a Todo-app-with-auth flavor (CRUD entity + full auth wiring), and `dataapp` (binds to an *existing* Power BI semantic model via `.dax` query files + Vega-Lite/D3 chart specs — "visualization as code" against data you already have, not data you're writing live).
- `npm run dev` runs the full local dev loop — but this still talks to the **real deployed backend** in the real Fabric workspace (there's no fully offline/mocked backend in this preview), it just serves the frontend locally via Vite.
- `npx rayfin up` deploys everything (schema + backend config + static frontend build); `npx rayfin up db apply` applies schema-only changes; `--dry-run --verbose` previews a deploy without applying it; `npx rayfin up staticapp deploy` redeploys just the frontend.
- Prerequisites: a Fabric workspace with **capacity** assigned, and a **tenant admin** must enable the "Fabric apps (preview)" workload in tenant settings (org-wide or per security group) before anyone can create the item type.

## Authorization model — `@role()` and anonymous access

- Built-in roles are `authenticated` and `anonymous` (custom roles can also be referenced in policy logic, e.g. via a `claims.role` claim).
- `@role('authenticated', actions, { policy })` — the `policy` callback gets typed `(claims, item)` access; supports `.eq()`, `.and()`, `.or()` for expressing ownership/row-level rules (e.g. `claims.sub.eq(item.userId)`).
- `@role('anonymous', actions)` — no `options.policy` is possible here, since there's no signed-in identity/claims to check. This is a genuinely new mechanism (added *after* the initial June launch — the anonymous-access docs page is dated August 2026) for exposing specific operations to visitors with **zero sign-in**.
  - Anonymous access requires **three independent switches**, all of which must be on:
    1. A **tenant-level** toggle ("Anonymous data access" under Fabric apps tenant settings — separate from the base Fabric Apps enablement toggle).
    2. An **app-level** setting that allows anonymous requests to reach that specific app's data service.
    3. The **per-entity `@role('anonymous', ...)` decorator** itself, specifying exactly which operations (`create`/`read`/`update`/`delete`) are exposed.
  - Anonymous and authenticated roles can coexist on the same entity (e.g. anyone can `read`, only the authenticated owner can `update`/`delete`).
  - Microsoft's own guidance: grant the minimum needed (prefer `read` or `create` alone), never expose personal/confidential/financial data via the anonymous role, and validate/rate-limit public writes since "callers can send requests without using your frontend" — the API is reachable directly, not just through your UI.
- Field-level permissions: `include`/`exclude` options on a `@role()` decorator restrict which fields that role can see/set.
- You cannot `@one()`-relate an entity to the built-in system user — to tie a row to a signed-in user, add a plain `@text()` field and populate it from `claims.sub`.
- Composite/multi-field DB-level uniqueness (e.g. "one row per user per poll") isn't clearly documented — only single-field `{ unique: true }` is.

## Regular authentication (for the signed-in/presenter side)

- Two modes: **email/password** (local development only — doesn't work once deployed) and **Fabric SSO via Microsoft Entra ID** (production, for deployed apps — only works when the app is opened from/through Fabric).
- First sign-in via Fabric SSO auto-provisions the user; no separate sign-up step.
- Configured in `rayfin/rayfin.yml` under `services.auth` (`enabled`, `allowedRedirectUris`, `fabric.enabled`, `password.enabled`). Deployment fails if `services.auth.enabled` is `false` — auth is mandatory for any deployment (though which *methods* are exposed to end users is controlled by role/UI design, not by disabling auth entirely).
- The SDK exposes a `session` concept (`client.auth`) — authenticated state, `id`/`email`, custom claims, and change events — rather than raw tokens.

## Fit for a "disguised live presentation + audience polling" use case

- A Fabric App's frontend is 100% custom code — no forced Power BI chrome — so it can be styled as anything (an interactive explainer, a dashboard, a product-tour site) with no visual tell that it's a "Fabric item."
- Anonymous data access is the mechanism that makes a public, no-account audience-interaction flow possible at all, since the classic model requires Entra SSO for every visitor.
- No push/subscription support means any "live updating" visual (e.g. a bar chart of poll results) has to poll the GraphQL API on an interval rather than subscribe to changes.

## Sources

1. [Beyond the Analytics — Microsoft Fabric Apps and Rayfin: What the New App Layer Does](https://beyondtheanalytics.com/blog/microsoft-fabric-apps)
2. [Tabular Editor — Fabric Apps Explained: Visualization as Code in a Data App Dashboard](https://tabulareditor.com/blog/fabric-apps-explained-visualization-as-code-in-a-data-app-dashboard)
3. [HexaView — Microsoft Fabric Apps: The Next Step in Data Application Development](https://www.hexaviewtech.com/blog/microsoft-fabric-apps-the-next-step-in-data-application-development)
4. [Microsoft Learn — What is Fabric Apps (Preview)?](https://learn.microsoft.com/en-us/fabric/apps/overview) *(official, primary source)*
5. [Microsoft Learn — Create your first Fabric apps project](https://learn.microsoft.com/en-us/fabric/apps/create-app) *(official)*
6. [Microsoft Learn — Define data permissions](https://learn.microsoft.com/en-us/fabric/apps/data-permissions) *(official — `@role` reference)*
7. [Microsoft Learn — Anonymous data access in Fabric apps](https://learn.microsoft.com/en-us/fabric/apps/anonymous-data-access) *(official — the key enabler for public polling)*
8. [Microsoft Learn — Authentication for Fabric Apps](https://learn.microsoft.com/en-us/fabric/apps/authentication) *(official)*
9. [Jihwan Kim / PowerBIMVP — Building My First Fabric App with the Rayfin CLI to Analyze a Semantic Model](https://powerbimvp.com/posts/fabric-app-rayfin-semantic-model-analyzer.html) *(independent hands-on build log)*
10. [The New Stack — Microsoft Build 2026: Rayfin, Microsoft's Answer to the Gap Between Vibe Coding and Enterprise Production](https://thenewstack.io/microsoft-build-2026-rayfin-replit-vibe-coding/) *(editorial context on the launch)*

Corroboration only (not individually quoted above): the Microsoft Fabric Community "Introducing Rayfin" and "Introducing anonymous data access for Fabric Apps (Preview)" announcement posts, and the `microsoft/rayfin` / `microsoft/awesome-rayfin` GitHub repositories.
