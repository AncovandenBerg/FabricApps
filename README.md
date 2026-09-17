# Fabric Apps

> Small, self-contained Microsoft Fabric Apps built on European open data, with the source and the
> reasoning behind each one.

[![Licence](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)
[![Fabric Apps](https://img.shields.io/badge/Microsoft%20Fabric-Apps%20(preview)-1F6FEB)](https://learn.microsoft.com/en-us/fabric/apps/overview)

> [!WARNING]
> Fabric Apps is in public preview. Breaking changes, shifting APIs and region gaps are expected.
> Nothing here is production code, and none of it runs on client data.

## What is in here

| App | What it does | Data source | Status |
| --- | --- | --- | --- |
| **wind-fingerprint** | Joins air quality measurements to wind direction so you can see where a station's pollution actually comes from. | EEA air quality | Planned |
| **wake** | Explores maritime CO2 reporting under ETS and FuelEU, vessel by vessel. | THETIS-MRV | Planned |
| **half-life** | Survival curves for vehicle registrations, the DAX-heavy one of the set. | RDW open vehicle registry | Planned |

Nothing is built yet. The folder links appear in this table as each app lands, so an empty
column here means an empty folder in the repo.

## Why this repo exists

Fabric Apps turns a Fabric workspace into somewhere you can host an actual web application, with the SQL
database, GraphQL API, Entra ID sign-in and static hosting all provisioned as one item. That is a real
shift for anyone who has scoped a Power BI Embedded project, and the fastest way to find out where the
edges are is to build several small things rather than read about it.

These are deliberately small apps on public data. The point is the pattern, not the dataset.

## Repository layout

```text
FabricApps/
├── apps/
│   ├── wind-fingerprint/       one Rayfin project per app
│   │   ├── rayfin/
│   │   │   ├── data/           entity definitions and schema.ts
│   │   │   ├── rayfin.yml      service configuration
│   │   │   └── .env.example    documented variables, never the real .env
│   │   ├── src/                frontend
│   │   ├── package.json
│   │   └── README.md           what it does, how to run it, what it taught me
│   ├── wake/
│   └── half-life/
├── docs/
│   ├── setup.md                one-time tenant, capacity and CLI setup
│   ├── app-readme-template.md  the shape every app README follows
│   └── img/                    screenshots and diagrams
├── LICENSE
└── README.md
```

Conventions worth knowing before you add an app:

- One folder per app under `apps/`, in kebab case.
- The folder name, the `id` in `rayfin.yml` and the Fabric item name all match. The `id` doubles as the
  Docker Compose project name locally and as the item identifier in Fabric, so keeping them aligned saves
  a lot of confusion later.
- No shared code between apps. Each project is deployed from its own root, so a shared package would have
  to be published rather than imported across folders. Repeated patterns get written up in `docs/`
  instead.
- Every app README follows [the same template](docs/app-readme-template.md), which is what keeps the
  table above honest.

## Before you start

- A Fabric workspace with capacity assigned. Fabric Apps consumes capacity units from it.
- The **Fabric Apps (preview)** tenant setting enabled by an admin. Without it the App item type does not
  appear under New item.
- A supported region. Fabric Apps is not available everywhere yet.
- Node.js and Docker, since the local stack runs in containers.

Full walkthrough in [docs/setup.md](docs/setup.md).

## Run an app locally

```bash
git clone https://github.com/AncovandenBerg/FabricApps.git
cd FabricApps/apps/wind-fingerprint
npm install
cp rayfin/.env.example rayfin/.env
npm run dev
```

The dev stack runs the backend in Docker and the frontend on Vite. Local sign-in uses email and password,
so you do not need Entra ID configured to click around.

## Deploy to your own workspace

```bash
npx rayfin up --workspace "<your-workspace>"
```

This creates the App item and its child services (SQL database, authentication, static content) in the
target workspace. Schema changes come from the code, not from the portal: edit the entities under
`rayfin/data/`, then run `npx rayfin up db apply`. Editing the database directly in the portal will
eventually break the app.

## Secrets and data

> [!IMPORTANT]
> Static content is served from a public URL. Nothing secret belongs in the frontend, in `rayfin.yml`, or
> anywhere in this repository.

- `rayfin/.env` is ignored. `rayfin/.env.example` documents the variables with dummy values.
- `rayfin/.temp/` and the `.env.fabric-*` files written by `rayfin up` are ignored too. They contain
  generated artefacts and workspace identifiers.
- Datasets are not committed. Each app documents where its data comes from and ships a script to fetch it.
- Every dataset here is public and European. Attribution and licence terms are listed in each app README.

## Source of truth

Fabric git integration syncs a workspace to a repository for item types like notebooks, pipelines and
semantic models. The App item is not in that list as far as the current documentation shows, so this
repository is the source of truth and `rayfin up` is how code reaches Fabric. If that changes during
preview, this section changes with it.

## What this is not

Not a framework, not a starter template, and not production-hardened. No external users: deployed Fabric
Apps authenticate through Fabric SSO only, so none of these can be shared outside a tenant. If you need
anonymous or customer-facing access, you still need Power BI Embedded.

## Questions

Open an issue. Corrections about how Fabric Apps actually behaves in preview are especially welcome,
since the documentation is moving quickly.

## Licence

MIT. See [LICENSE](LICENSE).
