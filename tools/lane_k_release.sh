#!/usr/bin/env bash
# Lane K release at 50 new complete cards: version + CHANGELOG + build + push main,
# dispatch Regression, no waiting for CI/Regression (the next 50-cycle checks them).
# Usage: bash tools/lane_k_release.sh [--dry-run] [--force] [--version X.Y.Z] [--notes FILE]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DRY=0; FORCE=0; VERSION_ARG=""; NOTES="build/lane-k-release-notes.md"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --force) FORCE=1 ;;
    --version) VERSION_ARG="${2:?--version needs X.Y.Z}"; shift ;;
    --notes) NOTES="${2:?--notes needs a file}"; shift ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

branch=$(git branch --show-current)
[ "$branch" = "wip/lane-k" ] || { echo "release runs from wip/lane-k (now: $branch)" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "worktree is not clean; commit or restore first" >&2; git status --porcelain | head >&2; exit 1; }
git fetch -q origin main 2>/dev/null || true

# New complete cards since the newest CHANGELOG release (same rule as tools/session_start.sh).
read -r new baseline complete < <(python3 - <<'PY' | tr -d '\r'
import json, re, subprocess
now = json.load(open('docs/reports/card-counts.json', encoding='utf-8'))['complete']
m = re.search(r'->\s*([\d,]+)\s+of\s+[\d,]+', open('CHANGELOG.md', encoding='utf-8').read().split('\n## ', 2)[1])
if m:
    old = int(m.group(1).replace(',', ''))
else:
    tag = subprocess.check_output(['git', 'describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], text=True).strip()
    old = json.loads(subprocess.check_output(['git', 'show', tag + ':docs/reports/card-counts.json'], text=True))['complete']
print(now - old, old, now)
PY
)
echo "[release] complete=$complete baseline=$baseline new=$new/50"
if [ "$new" -lt 50 ] && [ "$FORCE" = 0 ]; then echo "[release] not due ($new/50); nothing to do"; exit 0; fi

if [ -n "$VERSION_ARG" ]; then next="$VERSION_ARG"; else
  next=$(node -e "const v=require('./package.json').version.split('.').map(Number); console.log(v[0]+'.'+(v[1]+1)+'.0')")
fi
nextTarget=$((complete + 50))
nextVer=$(node -e "const v='$next'.split('.').map(Number); console.log(v[0]+'.'+(v[1]+1)+'.0')")
echo "[release] v$next at complete $complete; next cycle v$nextVer at complete $nextTarget"
[ -s "$NOTES" ] || { echo "[release] write $NOTES first (bullets: what changed, then limits)" >&2; exit 1; }

if [ "$DRY" = 1 ]; then
  echo "[dry-run] would rebase wip onto origin/main, bump v$next, insert the CHANGELOG section, build,"
  echo "[dry-run] commit, fast-forward main, push main and wip/lane-k, dispatch Regression, update the mission file."
  echo "[dry-run] release notes:"; sed 's/^/  /' "$NOTES" | head -20
  exit 0
fi

if ! git rebase origin/main; then git rebase --abort 2>/dev/null || true; echo "[release] rebase conflict; resolve by hand" >&2; exit 1; fi
node - "$next" <<'NODE'
const fs = require('fs');
const v = process.argv[2];
const f = 'packages/engine/src/01-cards.js';
const s = fs.readFileSync(f, 'utf8');
const t = s.replace(/const VERSION = '[^']+'/, `const VERSION = '${v}'`);
if (t === s) throw new Error('VERSION line not found in packages/engine/src/01-cards.js');
fs.writeFileSync(f, t);
const p = 'package.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.version = v;
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
NODE
node - "$next" "$baseline" "$complete" "$new" "$NOTES" <<'NODE'
const fs = require('fs');
const [ver, baseline, complete, newCards, notesFile] = process.argv.slice(2);
const notes = fs.readFileSync(notesFile, 'utf8').trim().replace(/^\uFEFF/, '');
const cl = fs.readFileSync('CHANGELOG.md', 'utf8');
const i = cl.indexOf('\n## v');
if (i < 0) throw new Error('CHANGELOG.md has no release section');
const n = Number(newCards).toLocaleString('en-US');
const b = Number(baseline).toLocaleString('en-US');
const c = Number(complete).toLocaleString('en-US');
const head = `## v${ver}\n- Lane: K\n- **Lane K: +${newCards} complete cards (${b} -> ${c} of 8,709; ${n} in this release)**\n${notes}\n\n`;
fs.writeFileSync('CHANGELOG.md', cl.slice(0, i + 1) + head + cl.slice(i + 1));
NODE

# Mission state for the next cycle (part of the release commit).
sed -i -E "s/^- last release:.*/- last release: v$next (complete $complete)/" docs/ai/lane-k-mission.md
sed -i -E "s/^- next release:.*/- next release: v$nextVer (complete $nextTarget)/" docs/ai/lane-k-mission.md
sed -i -E "s/^- cycle:.*/- cycle: 0\/50 new complete cards since v$next/" docs/ai/lane-k-mission.md

node tools/build.mjs
bash tools/release_docs.sh
npm run -s check
git add -A
git commit -m "release v$next: Lane K, +$new complete cards ($complete of 8,709)"
git checkout main
git merge --ff-only wip/lane-k
git push origin main
git checkout wip/lane-k
git push origin HEAD:wip/lane-k

# Backup every 5 releases (best effort).
B=$(git ls-remote --heads origin 'backup/*' | sed 's#.*refs/heads/##' | sort -V | tail -1 || true)
if [ -n "${B:-}" ]; then
  n=$(gh api "repos/odinguard009/aeterna-experiment/compare/$B...main" --jq '[.commits[].commit.message | select(test("^v[0-9]"))] | length' 2>/dev/null || echo 0)
  if [ "${n:-0}" -ge 5 ]; then git push -q origin "HEAD:refs/heads/backup/v$next" && echo "[release] backup/v$next pushed"; fi
fi

# Regression: dispatch, do not wait.
if due=$(bash tools/regression_due.sh 2>/dev/null); then
  sims=$(printf '%s' "$due" | sed -n 's/^DUE sims=\([0-9]*\).*/\1/p')
  gh api -X POST "repos/odinguard009/aeterna-experiment/actions/workflows/regression.yml/dispatches" \
    -f ref=main -f "inputs[sims]=${sims:-30}" >/dev/null 2>&1 \
    && echo "[release] Regression dispatched (${sims:-30} sims, not awaited)" \
    || echo "[release] Regression dispatch failed; next cycle must check it"
else echo "[release] Regression: $due"; fi

echo "[release] v$next pushed to main; CI and the GitHub Release run in the background."
echo "[release] next boundary: check CI green, Release v$next exists, newest Regression green before the next 50-cycle."
