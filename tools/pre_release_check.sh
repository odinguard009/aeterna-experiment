#!/usr/bin/env bash
# Cheap pre-release gate (~15 s, checks run in parallel): the checks that broke CI after Lane K releases. Run before a push to main.
# Usage: bash tools/pre_release_check.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
names=(); i=0
run() { local n="$1"; shift; names[$i]="$n"; ( "$@" >"$tmp/$i.log" 2>&1; echo $? >"$tmp/$i.rc" ) & i=$((i+1)); }
run "import_fandom --check" python3 tools/import_fandom.py --check
run "staging_sync --check"  python3 tools/staging_sync.py --check
run "grandwalker_data --check" python3 tools/grandwalker_data.py --check
run "audit_heads"           python3 tools/audit_heads.py
run "compiler_wiring --check" node tools/compiler_wiring.mjs --check
run "engine_load_order + destroy_filters" node --test tests/unit/engine_load_order.test.mjs tests/unit/destroy_filters.test.mjs
run "size budgets B01-B04" node --test --test-name-pattern="^B0[1-4] " tests/unit/budget.test.mjs
wait
fail=0
for ((k=0; k<i; k++)); do
  if [ "$(cat "$tmp/$k.rc")" = 0 ]; then echo "ok   ${names[$k]}"; else echo "FAIL ${names[$k]}"; tail -n 15 "$tmp/$k.log"; fail=1; fi
done
[ "$fail" = 0 ] && echo "pre-release gate: ok" || { echo "pre-release gate: FAILED" >&2; exit 1; }
