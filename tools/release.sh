#!/usr/bin/env bash
# One-command release after the semantic edits are committed and pushed (owner, 2026-10-24: "buat
# semua sesi release otomatis"). The version bump, CHANGELOG section and roadmap edits are still the
# session's work; this script does the mechanical tail that used to be skipped when a session got
# interrupted (Codespace suspend/resume): dispatch CI, wait for green, create the GitHub Release.
#
#   bash tools/release.sh [VERSION]
#
# VERSION defaults to package.json. Steps:
#   1. wait for the CI run of the commit (dispatch one only if none exists) and wait for it to finish (up to ~20 min);
#   2. fail loudly (no release) when CI is red, so a broken build never ships;
#   3. create the missing release vVERSION with the game file via tools/make_releases.sh.
#
# Pushes start CI now (docs/ai/release.md, 2026-10-26); this script waits for that run and only dispatches one when none exists.
# Set BS_TEST_CONC=1 before the push itself to run the pre-push quick tests serially when the
# Codespace is memory-tight.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
REPO=odinguard009/aeterna-experiment
ver="${1:-$(node -p "require('./package.json').version")}"
head=$(git rev-parse HEAD)
echo "[release] v$ver at ${head:0:7}"

# 1. CI on the newest commit CI actually runs on (docs-only commits are ignored by ci.yml paths-ignore).
sha=$(git log -1 --format=%H -- . ':(exclude,glob)docs/**' ':(exclude,glob)**/*.md' ':(exclude,glob).claude/**' 2>/dev/null); sha=${sha:-$head}
# v0.137.1: pushes DO start CI now, and ci.yml cancels any older run on main, so dispatching a second run on top of
# a running or green one made them cancel each other. Dispatch only when no usable (not cancelled) run exists for the sha.
have=$(gh api "repos/$REPO/actions/workflows/ci.yml/runs?head_sha=$sha&per_page=10" --jq '[.workflow_runs[] | select(.conclusion != "cancelled" and .conclusion != "failure")] | length' 2>/dev/null || echo 0)
if [ "${have:-0}" -gt 0 ]; then echo "[release] CI run for ${sha:0:7} already exists, not dispatching"; else
  echo "[release] dispatch CI for ${sha:0:7}"
  gh workflow run CI --ref main >/dev/null 2>&1 || { echo "[release] CI dispatch FAILED"; exit 1; }
fi

# 2. Wait for that run to finish.
for i in $(seq 1 40); do
  ci=$(gh api "repos/$REPO/actions/workflows/ci.yml/runs?head_sha=$sha&per_page=10" --jq '[.workflow_runs[] | select(.conclusion != "cancelled")][0] | "\(.status) \(.conclusion // "-")"' 2>/dev/null || echo "gh-error -")
  echo "[release] CI: ${ci:-none}"
  case "$ci" in completed*) break;; esac
  sleep 30
done
if [ "${ci%% *}" != "completed" ] || [ "${ci#* }" != "success" ]; then
  echo "[release] CI not green (${ci:-none}); release skipped" >&2
  exit 1
fi
echo "[release] CI green"

# 3. Create the missing release (idempotent: skips versions that already exist).
CI_OK=1 bash tools/make_releases.sh "$head" "$ver"
