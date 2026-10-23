#!/usr/bin/env bash
# Is the GitHub Regression due for this release? (process cleanup, owner 2026-10-19: "too many tests").
# Run after the push at session end. Prints one line and exits 0 = due (prints the sims count), 1 = skip.
#   DUE sims=30 (reason)  -> dispatch: gh api -X POST repos/$REPO/actions/workflows/regression.yml/dispatches -f ref=main -f "inputs[sims]=30"
#   SKIP (reason)         -> no dispatch; the weekly scheduled Regression (Sunday) still runs everything
# Due when any of:
#   - no earlier Regression run is found, or the newest one did not succeed (the fix must be confirmed)
#   - 3+ release commits (subject "vX.Y.Z ..." or, since v0.80, "docs: vX.Y.Z release docs"; fixed v0.94.0) on main since the commit the newest Regression ran on
#   - core engine files changed since then (turn, battle, rules, state, zones, match, CPU, effect base/parse/resolve):
#     these get 30 sims; everything else gets 10
# gh failure = DUE sims=30 (never skip by accident).
set -u
REPO=odinguard009/aeterna-experiment
CORE='^packages/(protocol/src|engine/src/(0[5-8]|09|15|02a|02c|02d))'
last=$(gh api "repos/$REPO/actions/workflows/regression.yml/runs?branch=main&per_page=10" \
  --jq '[.workflow_runs[] | select(.status=="completed" and .conclusion!="cancelled")][0] | "\(.head_sha) \(.conclusion)"' 2>/dev/null) \
  || { echo "DUE sims=30 (gh failed: run it to be safe)"; exit 0; }
sha=${last%% *}; concl=${last#* }
if [ -z "$sha" ] || [ "$sha" = "null" ]; then echo "DUE sims=30 (no earlier Regression run)"; exit 0; fi
cmp=$(gh api "repos/$REPO/compare/$sha...main" \
  --jq '"\([.commits[].commit.message | select(test("^v[0-9]|^docs: v[0-9]+[.][0-9]+[.][0-9]+ release docs"))] | length) \([.files[].filename] | join(","))"' 2>/dev/null) \
  || { echo "DUE sims=30 (compare failed: run it to be safe)"; exit 0; }
rel=${cmp%% *}; files=${cmp#* }
core=$(printf '%s\n' "$files" | tr ',' '\n' | grep -cE "$CORE" || true)
sims=10; [ "$core" -gt 0 ] && sims=30
if [ "$concl" != "success" ]; then echo "DUE sims=$sims (newest Regression on ${sha:0:7} was $concl)"; exit 0; fi
if [ "$core" -gt 0 ]; then echo "DUE sims=30 ($core core engine file(s) changed since ${sha:0:7})"; exit 0; fi
if [ "$rel" -ge 3 ]; then echo "DUE sims=10 ($rel releases since the last Regression on ${sha:0:7})"; exit 0; fi
echo "SKIP ($rel release(s) since the last green Regression on ${sha:0:7}, no core engine file changed)"; exit 1
