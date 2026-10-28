# Owner memory backup (portable)

Copy of the assistant's project memory (owner rules and feedback), kept in the repo so a different account or machine starts with the same rules. Project rules themselves live in `/CLAUDE.md` (loaded automatically).

Restore on a new account/machine (from the repo root):

    bash tools/memory_sync.sh restore

Update the copy after memory changes (then commit and push):

    bash tools/memory_sync.sh save

Settings: `bash tools/settings_sync.sh restore` on a new account/machine (copies `docs/ai/settings`: user settings.json, agents, hooks, own skills; sets `core.hooksPath .githooks`); `save` after changes. Model/advisor settings are also in `.claude/settings.json` (auto-loaded). Still by hand: plugins `ui-ux-pro-max`, `tinyfish`, the codebase-memory binary, MCP registrations and logins. No secrets are stored here.
