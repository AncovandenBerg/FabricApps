# Setup

One-time setup for running and deploying anything in this repository. Each app README links here rather
than repeating it.

## 1. Tenant setting

A Fabric tenant administrator has to switch the workload on before the App item type appears:

1. Open the [Fabric admin portal](https://app.fabric.microsoft.com/admin-portal).
2. Go to **Tenant settings**.
3. Under **Fabric Apps (preview)**, set it to **Enabled**, for the whole organisation or for a security
   group.
4. Apply, then wait a few minutes for it to propagate.

If you are not an admin, this is the thing to ask for first. Everything else is blocked on it.

## 2. Workspace and capacity

The workspace needs Fabric capacity assigned, including a trial capacity. Fabric Apps consumes capacity
units from whatever is attached, so a shared production capacity is a poor choice for experiments.

Fabric Apps is not available in every region yet. Check
[region availability](https://learn.microsoft.com/en-us/fabric/admin/region-availability) before
wondering why the item type is missing in an enabled tenant.

## 3. Local tooling

- Node.js, current LTS.
- Docker, because the local backend stack runs in containers.
- The Rayfin CLI, which arrives with the project scaffold rather than as a separate global install.

## 4. Scaffold a new app

Create the App item in the workspace first (**New item**, then **App**), then pull it down locally:

```bash
npm create @microsoft/rayfin@latest -- "<app-item-name>" --template todoapp --workspace "<workspace>"
```

Move the generated project into `apps/<app-name>/` in this repository, and make the folder name, the `id`
in `rayfin/rayfin.yml` and the Fabric item name match.

## 5. Run locally

```bash
cd apps/<app-name>
npm install
cp rayfin/.env.example rayfin/.env
npm run dev
```

Local authentication uses email and password. Fabric SSO applies once the app is deployed.

## 6. Deploy

```bash
npx rayfin up --workspace "<workspace>"
```

Schema changes come from the code:

```bash
npx rayfin up db apply
```

Switch the target workspace with `npx rayfin switch --workspace "<workspace>"`.

## Troubleshooting

**The backend is using an old schema or old config.** Stop the dev stack and restart it. The generated
artefacts in `rayfin/.temp/` are rebuilt on start.

**Schema conflicts after editing in the portal.** The SQL database is read-only by design here. Make
schema changes in `rayfin/data/` and redeploy. Editing the database directly will eventually break the
app.

**The App item type is missing.** In order of likelihood: the tenant setting is off, the workspace has no
capacity, or the region does not support it yet.

## Reference

- [What is Fabric Apps](https://learn.microsoft.com/en-us/fabric/apps/overview)
- [Project structure](https://learn.microsoft.com/en-us/fabric/apps/project-structure)
- [CLI reference](https://learn.microsoft.com/en-us/fabric/apps/cli-reference)
