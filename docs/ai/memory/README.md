# Owner memory backup (portable)

Copy of the assistant's project memory (owner rules and feedback), kept in the repo so a different account or machine starts with the same rules. Project rules themselves live in `/CLAUDE.md` (loaded automatically).

Restore on a new account/machine (from the repo root):

    bash tools/memory_sync.sh restore

Update the copy after memory changes (then commit and push):

    bash tools/memory_sync.sh save

Settings worth re-creating by hand (machine-specific, so not copied): plugins `ui-ux-pro-max`, `tinyfish`; hooks path of the codebase-memory tool; `core.hooksPath .githooks` (`git config core.hooksPath .githooks`). No secrets are stored here.
