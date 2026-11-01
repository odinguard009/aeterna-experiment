#!/usr/bin/env bash
# Cheap pre-release gate (~1 min): the checks that broke CI after Lane K releases. Run before a push to main.
# Usage: bash tools/pre_release_check.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
fail=0
run() { local n="$1"; shift; if "$@" >/tmp/prc.$$ 2>&1; then echo "ok   $n"; else echo "FAIL $n"; tail -n 15 /tmp/prc.$$; fail=1; fi; }
run "import_fandom --check" python3 tools/import_fandom.py --check
run "staging_sync --check"  python3 tools/staging_sync.py --check
run "audit_heads"           python3 tools/audit_heads.py
run "compiler_wiring --check" node tools/compiler_wiring.mjs --check
run "engine_load_order + destroy_filters" node --test tests/unit/engine_load_order.test.mjs tests/unit/destroy_filters.test.mjs
run "size budgets B01-B04" node --test --test-name-pattern="^B0[1-4] " tests/unit/budget.test.mjs
rm -f /tmp/prc.$$
[ "$fail" = 0 ] && echo "pre-release gate: ok" || { echo "pre-release gate: FAILED" >&2; exit 1; }
