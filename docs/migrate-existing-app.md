# Bringing an existing app into this repo

Written for Capacity Command, which was built outside this repository, but the steps apply to any
Rayfin project you move in. Work through it in order. The risky part is not the move, it is what comes
along with it.

## 1. Decide what happens to the history

Two options, and they are not equally easy to reverse.

**Clean import (recommended).** Copy the working files in, leave the old history behind. The old repo
stays where it is as an archive. Choose this unless the commit history has value to someone other than
you.

**Keep the history.** Only worth it if the history is interesting or you need the commit trail. From the
root of this repo:

```bash
git remote add capacity-command <url-or-path-of-the-old-repo>
git fetch capacity-command
git subtree add --prefix=apps/capacity-command capacity-command main --squash
```

> [!WARNING]
> Importing history also imports anything that was ever committed to it. If a `.env`, a connection
> string or a workspace identifier was committed once and deleted later, it is still in the history and
> a subtree import republishes it. Run step 2 before you decide.

## 2. Check the old project for committed secrets

If the project is already a git repository:

```bash
cd <old-project>
git log --all --name-only --pretty=format: | sort -u | grep -Ei '\.env|secret|\.pem|\.pfx|credential'
git grep -I -nE '(AccountKey=|Server=tcp:|password=|pwd=|api[_-]?key|Bearer [A-Za-z0-9._-]{20,})' $(git rev-list --all) 2>/dev/null | head -20
```

Anything found means clean import, not subtree. Rewriting history with `git filter-repo` is possible but
not worth it for a contest project.

Also check the working tree, committed or not:

```bash
grep -rIn --exclude-dir=node_modules -E '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' .
```

Workspace and item GUIDs are not credentials, but they identify your tenant and they do not belong in a
public repo.

## 3. Copy the files in

```bash
mkdir -p apps/capacity-command
rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'rayfin/.temp' \
  --exclude 'rayfin/.env' \
  --exclude '.env.fabric*' \
  <old-project>/ apps/capacity-command/
```

The excludes matter more than the copy. Everything in that list either bloats the repo or leaks
something.

## 4. Align the names

Three things should read the same:

| Where | Value |
| --- | --- |
| Folder | `apps/capacity-command` |
| `rayfin/rayfin.yml` → `id` | `capacity-command` |
| Fabric item name | `capacity-command` |

The `id` is used as the Docker Compose project name locally and as the item identifier in Fabric.
Changing it after the app is deployed is not free, so if the deployed item is named something else,
either rename the item or keep the existing `id` and name the folder to match it. Consistency beats
tidiness here.

Also check in `rayfin.yml`:

- `name` and `version` are sensible.
- `services.auth.allowedRedirectUris` still points at the port your dev server actually uses.
- `services.staticHosting.root` and `folder` are still correct relative to the project root, since the
  project root moved.

## 5. Write the .env.example

The real `.env` is ignored. The example is how someone else knows what to set.

```bash
cd apps/capacity-command
sed -E 's/=.*/=/' rayfin/.env > rayfin/.env.example
```

Then read it. Strip anything that is not needed, add a comment per variable, and make sure no default
value survived the substitution.

## 6. Verify it still runs from the new location

```bash
cd apps/capacity-command
npm install
cp rayfin/.env.example rayfin/.env   # then fill it in
npm run dev
```

Relative paths, tsconfig references and build commands are the usual casualties of a move. Fix them now,
not after the commit.

## 7. Scan before you commit

```bash
cd <repo root>
git add -A
./scripts/precommit-check.sh
```

The script checks staged files for secret patterns, oversized files, ignored files that slipped through
and leftover placeholder markers. Fix anything it reports before the first push, because a force push
over a public repo does not reliably unpublish anything.

## 8. Document it

- Write `apps/capacity-command/README.md` from
  [docs/app-readme-template.md](app-readme-template.md).
- Add a screenshot to `docs/img/`.
- Update the status in the root README table from Migrating to whatever is true.
- If the app is deployed and you want to link a demo, remember that Fabric Apps requires Fabric SSO, so
  an outside reader cannot open it. A screenshot or a short recording hosted elsewhere is the only thing
  that works for a public audience.
