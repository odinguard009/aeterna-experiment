#!/usr/bin/env bash
# SessionStart hook (owner, 2026-11-04): in a cloud session only, give the session the owner's settings, tools, skills, memory and MCP servers.
# Local sessions exit at once. Idempotent; every step may fail without stopping the rest. No secrets are stored (GitHub access comes from the cloud session itself).
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"
[ -e .mcp.json ] || cp docs/ai/settings/mcp.cloud.json .mcp.json     # project MCP list (untracked, see .gitignore)
bash tools/settings_sync.sh restore || echo "WARN: settings restore failed" >&2
bash tools/memory_sync.sh restore   || echo "WARN: memory restore failed" >&2
