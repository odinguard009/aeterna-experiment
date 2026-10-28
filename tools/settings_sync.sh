#!/usr/bin/env bash
# save: copy the user-level Claude settings (settings.json, agents, hooks, own skills) into docs/ai/settings; restore: the other way (never overwrites existing files).
# Account-synced skills (~/.claude/skills/synced) and anything secret are not copied. Model/advisor settings also live in .claude/settings.json (auto-loaded).
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
src="$HOME/.claude"; dst="$root/docs/ai/settings"
case "$1" in
  save)
    mkdir -p "$dst/skills" "$dst/agents" "$dst/hooks"
    cp "$src/settings.json" "$dst/settings.json"
    cp -r "$src"/agents/. "$dst/agents/"
    cp -r "$src"/hooks/. "$dst/hooks/"
    for d in "$src"/skills/*/; do n=$(basename "$d"); [ "$n" = synced ] || cp -r "$d" "$dst/skills/"; done
    echo "saved to $dst" ;;
  restore)
    mkdir -p "$src/skills" "$src/agents" "$src/hooks"
    [ -e "$src/settings.json" ] || cp "$dst/settings.json" "$src/settings.json"
    cp -rn "$dst"/agents/. "$src/agents/"; cp -rn "$dst"/hooks/. "$src/hooks/"; cp -rn "$dst"/skills/. "$src/skills/"
    git -C "$root" config core.hooksPath .githooks
    echo "restored to $src (hooks in settings.json call /root/.local/bin/codebase-memory-mcp: install that binary or delete those hooks)" ;;
  *) echo "usage: settings_sync.sh save|restore"; exit 1 ;;
esac
