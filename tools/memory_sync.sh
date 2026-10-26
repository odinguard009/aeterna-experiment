#!/usr/bin/env bash
# save: copy the assistant memory of this project into docs/ai/memory; restore: the other way (never overwrites newer files).
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
key=$(echo "$root" | sed -E 's#^/([a-zA-Z])/#\1--#; s#^([a-zA-Z]):[/\]#\1--#; s#[/\. _]#-#g')
mem="$HOME/.claude/projects/$key/memory"
case "$1" in
  save) mkdir -p "$root/docs/ai/memory"; cp "$mem"/*.md "$root/docs/ai/memory/"; echo "saved from $mem" ;;
  restore) mkdir -p "$mem"; cp -un "$root"/docs/ai/memory/[!R]*.md "$mem"/; cp -un "$root/docs/ai/memory/MEMORY.md" "$mem/" 2>/dev/null || true; echo "restored to $mem" ;;
  *) echo "usage: memory_sync.sh save|restore"; exit 1 ;;
esac
