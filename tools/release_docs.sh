#!/usr/bin/env bash
# Regenerates every generated doc of a release in ONE call (owner, 2026-10-20: docs go into the release commit, no separate
# `docs:` commit, so a release costs one pre-push run instead of two). Run it after the last task commit and BEFORE the push:
#   bash tools/release_docs.sh && git add -A && git commit --amend --no-edit
# Hand-written parts stay yours: docs/roadmap-data.json (statuses, updated, next), the CLAUDE.md **Next:** line and the finished
# items in docs/ai/roadmap-open.md; edit them first, then run this (the mind map is generated from roadmap-data.json).
#
# v0.80.0 (A2 prep a, docs/ai/token-economy.md section 10 "one end script"): `bash tools/release_docs.sh --end` runs every
# step AFTER the push in one call: waits for CI on the pushed commit, dispatches Regression when tools/regression_due.sh
# says DUE (not waited for), pushes backup/vX.Y.Z when 5+ releases followed the newest backup, copies index.html to the
# outputs folder, runs tools/session_end_check.mjs and prints the counts, auto-mode and chain-mode lines for the final message.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" = "--end" ]; then
  REPO=odinguard009/aeterna-experiment; OUT=${OUT:-/mnt/user-data/outputs}; ver=$(node -p "require('./package.json').version")
  head=$(git rev-parse HEAD)
  # CI ignores docs/**, *.md and .claude/** (ci.yml paths-ignore): a docs-only HEAD never gets a CI run, so wait on the newest commit that CI does run on
  # (v0.90 time review: waiting on the docs-only HEAD burned the full ~15 min timeout in every release); fall back to HEAD when none is in the clone
  sha=$(git log -1 --format=%H -- . ':(exclude,glob)docs/**' ':(exclude,glob)**/*.md' ':(exclude,glob).claude/**' 2>/dev/null); sha=${sha:-$head}
  echo "[end] v$ver at ${head:0:7} (CI commit ${sha:0:7})"
  # 1. CI on the pushed commit (needed for the GitHub Release); up to ~15 min
  for i in $(seq 1 60); do
    ci=$(gh api "repos/$REPO/actions/workflows/ci.yml/runs?head_sha=$sha&per_page=1" --jq '.workflow_runs[0] | "\(.status) \(.conclusion // "-") \(.id)"' 2>/dev/null || echo "gh-error - -")
    case "$ci" in completed*) break;; esac; sleep 15
  done
  echo "[end] CI: ${ci:-none}"
  # 2. Regression only when due
  if due=$(bash tools/regression_due.sh); then
    sims=$(printf '%s' "$due" | sed -n 's/^DUE sims=\([0-9]*\).*/\1/p')
    gh api -X POST "repos/$REPO/actions/workflows/regression.yml/dispatches" -f ref=main -f "inputs[sims]=${sims:-30}" >/dev/null 2>&1 \
      && echo "[end] Regression dispatched: $due" || echo "[end] Regression dispatch FAILED: $due"
  else echo "[end] Regression: $due"; fi
  # 3. Backup every 5 releases (skill bs-session-runner End step 3)
  B=$(git ls-remote --heads origin 'backup/*' | sed 's#.*refs/heads/##' | sort -V | tail -1)
  n=$(gh api "repos/$REPO/compare/$B...main" --jq '[.commits[].commit.message | select(test("^v[0-9]"))] | length' 2>/dev/null || echo 0)
  nb=--no-backup
  if [ "$n" -ge 5 ]; then git push -q origin "HEAD:refs/heads/backup/v$ver" && nb= && echo "[end] backup/v$ver pushed ($n releases since $B)"; else echo "[end] backup not due ($n releases since $B)"; fi
  # 4. Game file + end check
  mkdir -p "$OUT" && cp index.html "$OUT/aeterna-v$ver.html"
  node tools/session_end_check.mjs $nb --out "$OUT" || echo "[end] END CHECK FAILED"
  # 5. Lines for the final message
  python3 tools/unlock_report.py --line
  echo "Mode otomatis: $(bash tools/session_gate.sh switch 2>/dev/null | tail -1)"
  bash tools/session_gate.sh rantai status 2>/dev/null | tail -1
  exit 0
fi
python3 tools/unlock_report.py > /dev/null && echo "unlock report ok"
python3 tools/pack_plan.py --measure --steps 60 | tail -1
# mechanic inventory only when this session touched mechanics or imports (P0 B6)
base=$(git rev-parse --verify -q origin/main || echo HEAD~1)
if ! git diff --quiet "$base" -- data/glossary/mechanics.json data/import; then python3 tools/mechanic_inventory.py | tail -1; fi
node tools/gen_roadmap.mjs | tail -1
