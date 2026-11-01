#!/usr/bin/env bash
# save: copy the user-level Claude settings (settings.json, agents, hooks, own skills) into docs/ai/settings; restore: the other way (never overwrites existing files).
# Account-synced skills (~/.claude/skills/synced) and anything secret are not copied. Model/advisor settings also live in .claude/settings.json (auto-loaded).
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
src="$HOME/.claude"; dst="$root/docs/ai/settings"

# Installed from upstream by `restore` (not copied by `save`): Karpathy guidelines + obra/superpowers skills.
EXTERNAL_SKILLS="karpathy-guidelines brainstorming diagnosing-superpowers dispatching-parallel-agents executing-plans finishing-a-development-branch receiving-code-review requesting-code-review subagent-driven-development systematic-debugging test-driven-development using-git-worktrees using-superpowers verification-before-completion writing-plans writing-skills"
warn() { echo "WARN: $*" >&2; }
# install: MCP binary + servers + upstream skills + hooks. Idempotent; each step may fail without stopping the rest. Needs npm/uv/curl/git network access.
install_extras() {
  bin="$HOME/.local/bin"; mkdir -p "$bin"
  if [ ! -x "$bin/codebase-memory-mcp" ]; then   # official npm package of DeusData/codebase-memory-mcp (postinstall fetches the native binary)
    npm install -g codebase-memory-mcp >/dev/null 2>&1 && ln -sf "$(command -v codebase-memory-mcp)" "$bin/codebase-memory-mcp" || warn "codebase-memory-mcp install failed"
  fi
  if command -v claude >/dev/null 2>&1; then     # user-scope MCP servers; they load at the NEXT session start, not in the running one
    have=$(claude mcp list 2>/dev/null || true)
    add() { n=$1; shift; echo "$have" | grep -q "^$n:" || claude mcp add -s user "$n" -- "$@" >/dev/null 2>&1 || warn "mcp add $n failed"; }
    add codebase-memory-mcp "$bin/codebase-memory-mcp"
    add context7 npx -y @upstash/context7-mcp
    add sequential-thinking npx -y @modelcontextprotocol/server-sequential-thinking
    add serena uvx --from serena-agent serena start-mcp-server --context ide-assistant --project-from-cwd
  else warn "claude CLI not found: MCP servers not registered"; fi
  # hooks for codebase-memory (settings.json is never overwritten, so merge only the hooks key when missing)
  python3 - "$dst/settings.json" "$src/settings.json" <<'PY' || warn "hook merge failed"
import json,sys
a,b=sys.argv[1:3]; cur=json.load(open(b))
if "hooks" not in cur: cur["hooks"]=json.load(open(a)).get("hooks",{}); json.dump(cur,open(b,"w"),indent=2)
PY
  [ -d "$src/skills/karpathy-guidelines" ] || { mkdir -p "$src/skills/karpathy-guidelines" && curl -fsS -m 30 -o "$src/skills/karpathy-guidelines/SKILL.md" https://raw.githubusercontent.com/forrestchang/andrej-karpathy-skills/main/skills/karpathy-guidelines/SKILL.md || { rm -rf "$src/skills/karpathy-guidelines"; warn "karpathy skill download failed"; }; }
  if [ ! -d "$src/skills/using-superpowers" ]; then  # skills only, no SessionStart hook (it clashes with the repo's full-auto rule)
    t=$(mktemp -d); if timeout 120 git clone -q --depth 1 https://github.com/obra/superpowers.git "$t/sp" 2>/dev/null; then cp -rn "$t"/sp/skills/. "$src/skills/"; else warn "superpowers clone failed"; fi; rm -rf "$t"
  fi
}
case "$1" in
  save)
    mkdir -p "$dst/skills" "$dst/agents" "$dst/hooks"
    cp "$src/settings.json" "$dst/settings.json"
    cp -r "$src"/agents/. "$dst/agents/"
    cp -r "$src"/hooks/. "$dst/hooks/"
    for d in "$src"/skills/*/; do n=$(basename "$d"); [ "$n" = synced ] && continue; case " $EXTERNAL_SKILLS " in *" $n "*) continue;; esac; cp -r "$d" "$dst/skills/"; done
    # stop/prompt hooks installed by the cloud environment (not referenced in settings.json): reference copy only
    mkdir -p "$dst/harness"; for f in stop-hook-git-check.sh stop-hook-reply-gate.py user-prompt-submit-reply-reminder.py; do [ -e "$src/$f" ] && cp "$src/$f" "$dst/harness/"; done
    echo "saved to $dst" ;;
  restore)
    mkdir -p "$src/skills" "$src/agents" "$src/hooks"
    [ -e "$src/settings.json" ] || cp "$dst/settings.json" "$src/settings.json"
    cp -rn "$dst"/agents/. "$src/agents/"; cp -rn "$dst"/hooks/. "$src/hooks/"; cp -rn "$dst"/skills/. "$src/skills/"
    for f in "$dst"/harness/*; do [ -e "$f" ] && [ ! -e "$src/$(basename "$f")" ] && cp "$f" "$src/"; done
    git -C "$root" config core.hooksPath .githooks
    install_extras
    echo "restored to $src (MCP servers and new skills load at the next session start)" ;;
  *) echo "usage: settings_sync.sh save|restore"; exit 1 ;;
esac
