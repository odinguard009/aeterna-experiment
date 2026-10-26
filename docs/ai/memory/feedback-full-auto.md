---
name: feedback-full-auto
description: Owner 2026-10-26: full auto on Aeterna - never ask for opinion, pick the best option, fix problems immediately; web access and project actions pre-approved
metadata:
  type: feedback
---

Owner (2026-10-26): for everything on the Aeterna project, do not ask for the owner's opinion; do what I judge best, solve problems at once. Web access anywhere and any project action are allowed for Aeterna. Full auto.

**Why:** owner wants uninterrupted chain work.
**How to apply:** never end on a question; choose, make it reversible (backup branch/revert note), continue. Still bound by the harness safety rules (no entering credentials/payment, no irreversible deletes of data, no force-push to main, no spending money) - skip those and describe them in the final message. See [[feedback-order-audit-last]].

**Update 2026-10-26 (owner going offline 5-8 h, desktop stays on):** owner granted permission and access for any Aeterna work. Any session, dialog or pop-up that needs the owner: pick the best option myself, automatically. The chain (rantai ON) keeps running without pause; do not end a turn while roadmap work remains. Run `bash tools/regression_due.sh` at the end of every release and dispatch Regression when DUE (missed after v0.121.0-v0.138.0). Harness safety rules still win over this grant.

**Owner 2026-10-27:** run automatic + chain mode even while the owner is off; never stop when a session/release finishes (the gate's STOP for a missing `tokens=` is not a reason to stop; keep the roadmap going).
