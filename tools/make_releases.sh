#!/usr/bin/env bash
# Creates the missing GitHub Releases (C5, v0.59.7). Run by .github/workflows/release.yml after CI succeeds on main
# (sessions cannot create releases or push tags: the API answers 403 for this session type).
#   bash tools/make_releases.sh [HEAD_SHA] [VERSION ...]
# With no VERSION: every "## vX.Y.Z" heading of CHANGELOG.md from v0.57.1 on (older versions live in the private archive).
# For each version without a release: tag + release vX.Y.Z on the newest main commit that still carries that version
# (so later fixes of the same version are included), body = that version's CHANGELOG section, asset aeterna-vX.Y.Z.html
# (the committed index.html of that commit; CI checks that index.html is the build of its sources).
# DRY_RUN=1 prints the plan only; CI_OK=1 (set by the workflow after a green CI run on HEAD_SHA) adds the CI line. Needs full history (actions/checkout fetch-depth: 0) and GH_TOKEN with contents: write.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
HEAD_SHA="${1:-$(git rev-parse HEAD)}"; shift || true
FLOOR="0.57.1"
ver_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]; }   # $1 >= $2

if [ "$#" -gt 0 ]; then versions=("$@"); else
  mapfile -t versions < <(grep -hoE '^## v[0-9][0-9.]*\s*$' CHANGELOG.md CHANGELOG-archive.md | sed -E 's/^## v//; s/\s+$//')
fi
# oldest first, so the newest version is created last and stays "Latest" on the Releases page
mapfile -t versions < <(printf '%s\n' "${versions[@]#v}" | sort -V)
top="${versions[-1]}"

# newest first-parent commit (at or before HEAD_SHA) for each package.json version
declare -A COMMIT
for c in $(git rev-list --first-parent "$HEAD_SHA"); do
  v=$(git show "$c:package.json" 2>/dev/null | sed -nE 's/^\s*"version": "([^"]+)".*/\1/p' | head -1)
  [ -n "$v" ] && [ -z "${COMMIT[$v]:-}" ] && COMMIT[$v]=$c
done

made=0; skipped=0; out="${RUNNER_TEMP:-build}/releases"; mkdir -p "$out"
for v in "${versions[@]}"; do
  v="${v#v}"
  [[ "$v" =~ ^[0-9]+(\.[0-9]+)*$ ]] || { echo "::warning::not a version: $v"; continue; }
  ver_ge "$v" "$FLOOR" || continue
  c="${COMMIT[$v]:-}"
  if [ -z "$c" ]; then echo "::warning::v$v: no main commit carries this version; skipped"; continue; fi
  if [ -z "${DRY_RUN:-}" ] && gh release view "v$v" >/dev/null 2>&1; then skipped=$((skipped + 1)); continue; fi
  notes="$out/v$v.md"
  awk -v h="## v$v" '$0 == h {f = 1; next} f && /^## / {exit} f' CHANGELOG.md CHANGELOG-archive.md | sed -e '/./,$!d' > "$out/body.md"
  # v0.106.0: the first two bullets are always "- Lane:" and "- Time:", so skip both for the title
  # (the releases up to v0.105.0 are all titled "Time" because of that)
  title=$(grep -vE '^- (Lane|Time):' "$out/body.md" | grep -m1 '^- ' | sed -E 's/^- //; s/\*\*//g; s/`//g; s/[(:].*$//; s/[ .,;]+$//' | cut -c1-70)
  # v0.96.0: data/cards/all-cards.json left git; cardsAtRev reads the old file at older commits and joins the Saga files at newer ones
  n=$(node -e "import('./tools/all_cards.mjs').then(m => console.log(m.cardsAtRev(process.argv[1]).length.toLocaleString('en-US')))" "$c")
  {
    cat "$out/body.md"
    echo
    t=$(git show "$c:README.md" | sed -nE 's/^Current build: .* of ([0-9,]+) cards playable.*/\1/p'); t=${t:-8,041}   # v0.62.0: total from the README build line
    echo "Playable: $n of $t cards. Game file: \`aeterna-v$v.html\` (open it in Chrome or Edge; no install)."
    if [ "$c" = "$HEAD_SHA" ] && [ -n "${CI_OK:-}" ]; then echo "Built from ${c:0:7}; CI green on this commit."
    else echo "Built from ${c:0:7}, the last main commit of this version."; fi
  } > "$notes"
  asset="$out/aeterna-v$v.html"
  git show "$c:index.html" > "$asset"
  if [ -n "${DRY_RUN:-}" ]; then echo "would release v$v at ${c:0:7}: v$v - $title ($(wc -c < "$asset") bytes)"; made=$((made + 1)); continue; fi
  latest=false; [ "$v" = "$top" ] && latest=true
  gh release create "v$v" "$asset" --target "$c" --title "v$v - $title" --notes-file "$notes" --latest="$latest"
  echo "released v$v at ${c:0:7}"; made=$((made + 1))
done
echo "[releases] created $made, already there $skipped"
