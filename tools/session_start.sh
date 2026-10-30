#!/usr/bin/env bash
# One-call session setup for Aeterna.
#
# Usage (inside an existing clone):   bash tools/session_start.sh
# Usage (fresh machine, no clone yet): bash <(curl -fsSL https://raw.githubusercontent.com/odinguard009/aeterna-experiment/main/tools/session_start.sh)
#   (on a fresh session the repo must be attached first; then the clone
#    line below is what this script runs for you when it is started outside a clone.)
#
# What it does, in order, and stops at the first real failure:
#   1. Clone (light, sparse) if there is no clone yet.
#   2. Point git at .githooks (pre-push runs check_renames.py).
#   3. Run `npm run -s loop` once as a baseline so a broken state is seen before any edit.
#   0. Overlap guard (owner, 2026-10-16): if the newest commit on origin/main is a v* release commit under 30 minutes old (chore/docs commits do not count) another
#      session may still be running: print OVERLAP and exit 3 (tell the owner instead of starting parallel work).
#      --force skips the guard (owner present and sure).
# Optional: --with-sources adds data/sources (only needed for the Fandom import).
set -euo pipefail

REPO_URL="https://github.com/odinguard009/aeterna-experiment"
DEST="${BS_DEST:-aeterna}"
WITH_SOURCES=0; FORCE=0; BUSY=""
for a in "$@"; do
  [ "$a" = "--with-sources" ] && WITH_SOURCES=1; [ "$a" = "--force" ] && FORCE=1
done

# Already inside a clone?
if git rev-parse --show-toplevel >/dev/null 2>&1 && [ -f "$(git rev-parse --show-toplevel)/tools/loop.mjs" ]; then
  ROOT="$(git rev-parse --show-toplevel)"
elif [ -d "$DEST/.git" ]; then
  ROOT="$(cd "$DEST" && pwd)"
else
  echo "[session_start] cloning (light, sparse) into $DEST"
  git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$DEST"
  git -C "$DEST" sparse-checkout set --no-cone '/*' '!/data/sources/'
  ROOT="$(cd "$DEST" && pwd)"
fi

cd "$ROOT"
git config core.hooksPath .githooks
# public repo: commits carry the owner's GitHub noreply identity, never a private email (migration 2026-10-17)
git config user.name odinguard009
git config user.email 70865815+odinguard009@users.noreply.github.com
if [ "$WITH_SOURCES" = 1 ]; then
  git sparse-checkout add data/sources
fi

git fetch -q origin main 2>/dev/null || true
AGE_MIN=$(( ( $(date +%s) - $(git log -1 --format=%ct origin/main 2>/dev/null || git log -1 --format=%ct) ) / 60 ))
echo "[session_start] newest commit on main: ${AGE_MIN} min ago"
SUBJ=$(git log -1 --format=%s origin/main 2>/dev/null || git log -1 --format=%s)
case "$SUBJ" in v[0-9]*) IS_V=1 ;; *) IS_V=0 ;; esac
# Preferred guard (idle chain, 2026-10-16): the session state on issue #1 (LOCK / MANUAL without DONE or UNLOCK).
# The commit-age rule below is only the fallback when gh cannot read the issue.
if [ "$FORCE" = 0 ] && BUSY=$(bash tools/session_gate.sh busy 2>/dev/null; echo "rc=$?"); [ "${BUSY##*rc=}" != 1 ] && [ -n "${BUSY%%rc=*}" ]; then
  if [ "${BUSY##*rc=}" = 3 ]; then
    echo "[session_start] OVERLAP: ${BUSY%%rc=*}" | tr -d '\n'; echo " - another session is active. Stop and tell the owner (or rerun with --force)."
    exit 3
  fi
elif [ "$AGE_MIN" -lt 30 ] && [ "$FORCE" = 0 ] && [ "$IS_V" = 1 ]; then
  echo "[session_start] OVERLAP: main changed ${AGE_MIN} min ago, another session may still be running. Stop and tell the owner (or rerun with --force)."
  exit 3
fi
echo "[session_start] HEAD: $(git log --oneline -1)"
echo "[session_start] baseline loop (build + lint + smoke tests)"
LOOP_RC=0; npm run -s loop || LOOP_RC=$?   # v0.60.2: print the summary even when the baseline fails, exit with its code at the end
# short summary (owner, 2026-10-16): enough context to pick the work without reading more files
echo "[session_start] version $(node -p "require('./package.json').version")"
git log --oneline -5 | sed 's/^/[session_start]   /'
grep -m1 -o '\*\*Next:.*' CLAUDE.md | cut -c1-400 | sed 's/^/[session_start] /' || true
node tools/lane_next.mjs 2>/dev/null | sed 's/^/[session_start] /' || true   # lane order: F, S1 Standard Magic, U/I queue, then K Standard first (owner, 2026-10-21)
# Lane K release per 50 (owner, 2026-10-28): new complete cards since the last released version, and local commits older than 24 h
# Baseline = the complete count printed in the newest CHANGELOG release ("1,368 -> 1,419 of 8,709"); the nearest git tag is wrong in a shallow
# clone (measured 2026-10-30: it said v0.195.0 and printed 110/50 when 9 cards were new). The tag stays the fallback; the 24 h check counts from the last commit that touched CHANGELOG.md.
REL=$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null)
python3 - "$REL" <<'PY' | sed 's/^/[session_start] /' || true
import json, re, subprocess, sys, time
rel = sys.argv[1]
now = json.load(open('docs/reports/card-counts.json'))['complete']
m = re.search(r'->\s*([\d,]+)\s+of\s+[\d,]+', open('CHANGELOG.md').read().split('\n## ', 2)[1])
if m: old, src = int(m.group(1).replace(',', '')), 'the newest CHANGELOG release'
elif rel: old, src = json.loads(subprocess.check_output(['git', 'show', rel + ':docs/reports/card-counts.json']))['complete'], rel
else: sys.exit(0)
new = now - old
print(f"K release: {new}/50 new complete cards since {src}" + (" -> RELEASE DUE" if new >= 50 else ""))
last = subprocess.run(['git', 'log', '-1', '--format=%H', '--', 'CHANGELOG.md'], capture_output=True, text=True).stdout.strip()   # the release commit
if last:
    ts = subprocess.run(['git', 'log', last + '..HEAD', '--format=%ct'], capture_output=True, text=True).stdout.split()
    if ts and time.time() - min(map(int, ts)) > 86400 and new > 0:
        print("K release: unreleased commits are older than 24 h -> RELEASE DUE")
PY
python3 tools/unlock_report.py --line 2>/dev/null | sed 's/^/[session_start] /' || true
python3 tools/priority_report.py --line 2>/dev/null | sed 's/^/[session_start] /' || true   # v0.60.3
python3 tools/rules_audit.py --line 2>/dev/null | sed 's/^/[session_start] /' || true
RC=$(python3 -c "import json;print(json.load(open('docs/rules-audit-verdicts.json'))['checked'])" 2>/dev/null || echo 2000-01-01)
[ $(( ( $(date +%s) - $(date -d "$RC" +%s) ) / 86400 )) -gt 30 ] && echo "[session_start] WARNING rules checked $RC (>30 days): repeat Rules audit R1 (docs/manual-notes.md sources table)" || true
BL=$(grep -o "BAN_LIST_INFO = { effective: '[0-9-]*', checked: '[0-9-]*'" packages/engine/src/00-config.js | grep -o "[0-9]\{4\}-[0-9-]*" | tail -1 || echo 2000-01-01)
[ $(( ( $(date +%s) - $(date -d "$BL" +%s) ) / 86400 )) -gt 30 ] && echo "[session_start] WARNING ban list last checked $BL (>30 days): check https://asia-en.battlespirits.com/rule/limited.php for a newer list and for a Standard list, then update BAN_LIST_INFO (effective, checked) and BAN_LISTS (00-config.js)" || true
# v0.98.0 (Standard rules item): dated reminders, printed from their date on; delete a line when its work is done
while IFS="|" read -r D MSG; do if [ -n "$D" ] && [ "$(date +%s)" -ge "$(date -d "$D" +%s)" ]; then echo "[session_start] CALENDAR $D: $MSG"; fi; done <<'CAL'
2026-12-26|26RCB02 + 26RSD12 are released: import both sets (data/import, skill bs-card-data-check) and add the 26RSD12 deck recipe to the Standard starters
2027-03-01|Standard rotation on 2027-04-01 (block A only until 2027-03-31, kb SJP:deck): read the official announcement, update STANDARD_BLOCKS in packages/engine/src/00-config.js and the Standard decks
CAL
if command -v gh >/dev/null 2>&1; then
  gh api "repos/odinguard009/aeterna-experiment/issues?state=open" --jq '.[] | "[session_start] issue #\(.number) \(.title)"' 2>/dev/null || echo "[session_start] open issues: use list_issues (gh failed)"
else echo "[session_start] open issues: gh not available here, use the GitHub tools (list_issues)"; fi
# v0.60.2: Regression is not awaited at session end; the next session reads it here (failure = fix first)
if command -v gh >/dev/null 2>&1; then
  gh api "repos/odinguard009/aeterna-experiment/actions/workflows/regression.yml/runs?per_page=1" --jq '.workflow_runs[0] | "[session_start] last Regression: \(.status) \(.conclusion // "-") on \(.head_sha[0:7]) run \(.id)"' 2>/dev/null || echo "[session_start] last Regression: unknown (gh failed)"
fi
# v0.69.3 (P0 B3): chain-stop state and the newest handoff, so the skill's start steps 2 and 4 are one call
if [ -f docs/ai/chain-stop.md ]; then echo "[session_start] CHAIN-STOP: docs/ai/chain-stop.md exists - stop unless the owner is present and has answered (then delete it)"; else echo "[session_start] chain-stop: none"; fi
if command -v gh >/dev/null 2>&1; then
  # only a handoff newer than the newest release commit matters (older ones were finished by a later session)
  HO=$(gh api "repos/odinguard009/aeterna-experiment/issues/comments?sort=created&direction=desc&per_page=100" \
    --jq '[.[] | select((.issue_url|endswith("/issues/3")) and (.body|test("^\\s*Handoff";"i")))][0] | if . == null then "" else "\(.created_at)\t\(.body|gsub("\\s+";" ")|.[0:300])" end' 2>/dev/null) || HO="?"
  RELT=$(git log -1 --format=%ct --grep='^v[0-9]' 2>/dev/null); RELT=${RELT:-$(git log -1 --format=%ct)}   # light clone (depth 1): HEAD time
  if [ "$HO" = "?" ]; then echo "[session_start] newest handoff: unknown (gh failed)"
  elif [ -n "$HO" ] && [ "$(date -d "${HO%%$'\t'*}" +%s)" -gt "$RELT" ]; then echo "[session_start] OPEN HANDOFF ${HO%%$'\t'*}: ${HO#*$'\t'}"
  else echo "[session_start] handoff: none newer than the last release"; fi
fi
if [ "$LOOP_RC" != 0 ]; then echo "[session_start] baseline loop FAILED (see above): fix it first"; exit "$LOOP_RC"; fi
echo "[session_start] ready"
