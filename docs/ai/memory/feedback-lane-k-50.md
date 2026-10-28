---
name: Lane K release per 50 cards
description: Owner rule 2026-10-28: Lane K commits go to wip/lane-k; release (version, CHANGELOG, main push) only at 50 new complete cards
type: feedback
---
Lane K: commit per pack bundle and push `HEAD:wip/lane-k`; release to `main` only at 50 new complete cards (early for schema/rule changes, commits older than 24 h, or an owner order). Regression is always due after a K release.

**Why:** fewer releases and CI runs per card; owner order 2026-10-28. **How to apply:** `bash tools/session_start.sh` prints the "K release: N/50" line; CLAUDE.md holds the full rule.
