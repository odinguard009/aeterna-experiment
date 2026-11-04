
## Not copied (2026-11-02)
Third-party skills that install from their own source are not stored here (size, licence): hallmark, impeccable, taste-skill, playwright-cli, reverse-engineer-anything and the tinyfish-* skills (the tinyfish plugin is listed in `enabledPlugins` in `settings.json`). `graphify` is copied because the global CLAUDE.md depends on it.

## Cloud sessions start with these settings (owner, 2026-11-04)
`.claude/settings.json` has a SessionStart hook running `tools/cloud_bootstrap.sh`. It does nothing locally; in a cloud session (`CLAUDE_CODE_REMOTE=true`) it copies `mcp.cloud.json` to an untracked `.mcp.json` (context7, sequential-thinking, serena, codebase-memory-mcp), then runs `settings_sync.sh restore` and `memory_sync.sh restore` (settings, agents, hooks, skills, MCP user scope). Not stored (local only or secret): basic-memory/Obsidian vault, github MCP token (the cloud session has its own GitHub access), rea, TinyFish connector. Untested in a real cloud session: if MCP servers are missing in the first turn, they load from the second session on. Revert: delete the SessionStart hook.
