#!/usr/bin/env bash
# Scan staged changes before committing. No dependencies beyond git and grep.
#
#   ./scripts/precommit-check.sh          scan staged files
#   ./scripts/precommit-check.sh --all    scan every tracked file
#
# Exits 1 on a hard failure, 0 on warnings only.

set -uo pipefail

MODE="${1:-staged}"
FAIL=0
WARN=0
MAX_BYTES=$((5 * 1024 * 1024))

if [ "$MODE" = "--all" ]; then
  FILES=$(git ls-files)
else
  FILES=$(git diff --cached --name-only --diff-filter=ACM)
fi

if [ -z "$FILES" ]; then
  echo "Nothing to scan. Stage your changes first, or pass --all."
  exit 0
fi

fail() { echo "  FAIL  $1"; FAIL=1; }
warn() { echo "  WARN  $1"; WARN=1; }

echo "Scanning $(echo "$FILES" | wc -l | tr -d ' ') file(s)."
echo ""

# 1. Environment files that should never be committed.
echo "Environment files"
ENV_HIT=0
while IFS= read -r f; do
  case "$f" in
    *.example) continue ;;
    *.env|*/.env|*.env.local|*/.env.fabric*|*/rayfin/.env)
      fail "$f is an environment file. Commit .env.example instead."
      ENV_HIT=1 ;;
  esac
done <<< "$FILES"
[ "$ENV_HIT" -eq 0 ] && echo "  ok"
echo ""

# 2. Secret-shaped content.
echo "Secret patterns"
SECRET_RE='(AccountKey=|Server=tcp:|Data Source=.*Password=|[Pp]assword\s*=\s*[^ "'"'"']|pwd=|client[_-]?secret|api[_-]?key\s*[=:]\s*["'"'"']?[A-Za-z0-9_-]{16,}|Bearer [A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{20,})'
HITS=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    *.example|*.md|scripts/precommit-check.sh) continue ;;
  esac
  if grep -InE "$SECRET_RE" "$f" >/dev/null 2>&1; then
    grep -InE "$SECRET_RE" "$f" | head -3 | while IFS= read -r line; do
      echo "  FAIL  $f: ${line%%:*} looks like a credential"
    done
    HITS=1
  fi
done <<< "$FILES"
if [ "$HITS" -eq 1 ]; then FAIL=1; else echo "  ok"; fi
echo ""

# 3. GUIDs. Not credentials, but they identify your tenant.
echo "Tenant and workspace identifiers"
GUID_RE='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
GUID_HIT=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in *.png|*.jpg|*.gif|*.svg|*lock*) continue ;; esac
  if grep -IoE "$GUID_RE" "$f" >/dev/null 2>&1; then
    warn "$f contains a GUID. Check it is not a workspace, item or tenant id."
    GUID_HIT=1
  fi
done <<< "$FILES"
[ "$GUID_HIT" -eq 0 ] && echo "  ok"
echo ""

# 4. Oversized files.
echo "File sizes"
SIZE_HIT=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  SIZE=$(wc -c < "$f" | tr -d ' ')
  if [ "$SIZE" -gt "$MAX_BYTES" ]; then
    fail "$f is $((SIZE / 1024 / 1024)) MB. Keep data and recordings out of git."
    SIZE_HIT=1
  fi
done <<< "$FILES"
[ "$SIZE_HIT" -eq 0 ] && echo "  ok"
echo ""

# 5. Files that .gitignore should have caught.
echo "Ignored files that slipped through"
IGN=$(git ls-files --cached --ignored --exclude-standard 2>/dev/null)
if [ -n "$IGN" ]; then
  echo "$IGN" | while IFS= read -r f; do echo "  WARN  $f is tracked but matches .gitignore"; done
  echo "        Untrack with: git rm --cached <file>"
  WARN=1
else
  echo "  ok"
fi
echo ""

# 6. Leftover placeholders in documentation.
echo "Placeholders"
PH_HIT=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    *.md) ;;
    *) continue ;;
  esac
  case "$f" in docs/app-readme-template.md|docs/migrate-existing-app.md) continue ;; esac
  if grep -InE '\[\[CONFIRM:|\bTODO\b|\[\[MOCKUP:|your-username' "$f" >/dev/null 2>&1; then
    warn "$f still has placeholder markers"
    PH_HIT=1
  fi
done <<< "$FILES"
[ "$PH_HIT" -eq 0 ] && echo "  ok"
echo ""

if [ "$FAIL" -eq 1 ]; then
  echo "Blocked. Fix the failures above before committing."
  exit 1
fi
if [ "$WARN" -eq 1 ]; then
  echo "Passed with warnings. Read them before pushing to a public repo."
  exit 0
fi
echo "Clean."
exit 0
