#!/usr/bin/env bash
# Lane K guard: one preflight before a bundle. Fetch, clean tree, gate, status.
# Usage: bash tools/lane_k_guard.sh [--no-gate] [--rebase] [--baseline]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
NOGATE=0; REBASE=0; BASELINE=0
for a in "$@"; do
  case "$a" in
    --no-gate) NOGATE=1 ;;
    --rebase) REBASE=1 ;;
    --baseline) BASELINE=1 ;;
    -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

git fetch -q origin main 2>/dev/null || echo "warning: git fetch failed (continuing)"
branch=$(git branch --show-current)
if [ -n "$(git status --porcelain)" ]; then
  echo "worktree is not clean; commit or restore before a Lane K bundle:" >&2
  git status --porcelain | head -10 >&2
  exit 1
fi
if [ "$branch" != "wip/lane-k" ]; then
  echo "warning: branch is $branch; Lane K normally runs on wip/lane-k" >&2
fi
if [ "$REBASE" = 1 ]; then
  if ! git rebase origin/main; then
    git rebase --abort 2>/dev/null || true
    echo "rebase conflict: resolve by hand, then run the guard again" >&2
    exit 1
  fi
fi
if [ "$NOGATE" = 0 ]; then
  rc=0
  busy=$(bash tools/session_gate.sh busy 2>/dev/null) || rc=$?
  case "$rc" in
    0) echo "gate: no other session" ;;
    3) echo "OVERLAP: $busy" >&2; exit 3 ;;
    *) echo "gate unavailable: ${busy:-unknown} (continuing)" >&2 ;;
  esac
fi
if [ "$BASELINE" = 1 ]; then npm run -s loop; fi
bash tools/lane_k_status.sh --no-gh
echo
echo "next: node tools/lane_k_packet.mjs   (writes build/lane-k-packet.md)"
