#!/usr/bin/env bash
# Lane K status: mission state, cycle, block progress, repo tips, gate and last CI/Regression.
# Read-only. Usage: bash tools/lane_k_status.sh [--fetch] [--no-gh]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
FETCH=0; NOGH=0
for a in "$@"; do
  case "$a" in
    --fetch) FETCH=1 ;;
    --no-gh) NOGH=1 ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
if [ "$FETCH" = 1 ]; then git fetch -q origin main 2>/dev/null || echo "warning: git fetch failed"; fi

echo "== Lane K mission =="
grep -E '^- (status|target|last release|next release|cycle|handoff):' docs/ai/lane-k-mission.md | sed 's/^- /  /'
echo
echo "== progress =="
node tools/lane_k_packet.mjs --summary | while IFS='=' read -r k v; do printf '  %-18s %s\n' "$k" "$v"; done
echo
echo "== repo =="
printf '  %-18s %s\n' branch "$(git branch --show-current)"
printf '  %-18s %s\n' main "$(git rev-parse --short origin/main 2>/dev/null || echo '?')"
printf '  %-18s %s\n' wip "$(git rev-parse --short origin/wip/lane-k 2>/dev/null || echo '?')"
dirty=$(git status --porcelain | head -5 || true)
if [ -n "$dirty" ]; then printf '  %-18s %s\n' dirty "$dirty"; fi
if [ "$NOGH" = 0 ]; then
  echo
  echo "== gate / CI / Regression =="
  bash tools/session_gate.sh status 2>/dev/null | tail -1 | sed 's/^/  /' || echo "  gate: unavailable"
  gh api "repos/odinguard009/aeterna-experiment/actions/workflows/ci.yml/runs?per_page=1" \
    --jq '"  CI: \(.workflow_runs[0].status) \(.workflow_runs[0].conclusion // "-") \(.workflow_runs[0].created_at)"' 2>/dev/null \
    || echo "  CI: gh failed"
  gh api "repos/odinguard009/aeterna-experiment/actions/workflows/regression.yml/runs?per_page=1" \
    --jq '"  Regression: \(.workflow_runs[0].status) \(.workflow_runs[0].conclusion // "-") \(.workflow_runs[0].created_at)"' 2>/dev/null \
    || echo "  Regression: gh failed"
fi
