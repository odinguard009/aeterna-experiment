---
name: Session end checklist (mistakes of 2026-10-28)
description: Three mistakes in the v0.184.0 release session and how to avoid them
type: feedback
---
Before ending a release session, do ALL of these (owner order 2026-10-28: make sure the mistakes do not happen again):
1. Push the session branch too (`git push -u origin HEAD:<session branch from the system prompt>`), not only `wip/lane-k` / `main`; the stop hook blocks on unpushed commits (35 were left).
2. Wait for the GitHub Release `vX.Y.Z` to exist (Release workflow after green CI, ~15 min; check every 5 min) and dispatch Regression when `tools/regression_due.sh` says DUE (workflow dispatch via `mcp__github__actions_run_trigger`). Never report a release as done before this.
3. Close with `bash tools/session_gate.sh done vX.Y.Z next=Sonnet start=<tokens at start> budget=<tokens left now>` (copy both numbers from the session counter; a bare `done` makes `rantai next` answer STOP "no tokens=" and the chain dies). Then `rantai next`; GO = start the next cycle in the same chat.
4. Scheduled prompt must call `mcp__claude-code-remote__add_repo` (owner odinguard009, repo aeterna-experiment, access push) as its first tool; plain "add_repo" text failed.

**Why:** v0.184.0 session ended with STOP, an unconfirmed release, no Regression and 35 unpushed commits on the session branch.
