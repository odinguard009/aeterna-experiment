---
name: Lane K auto-repeat until stop
description: Owner order 2026-10-28: keep doing Lane K until a 50-card release, then repeat automatically until the owner says stop; all permissions approved
type: feedback
---
Work Lane K cards until a 50-new-complete-card release, then start the next cycle automatically (chain mode ON, auto ON) until the owner orders a stop. All access permissions are approved; if a dialog needs the owner, pick the best option yourself. When a job makes you wait, check it every 5 minutes (Monitor / status check), never end the turn on a wait.

**Why:** owner order 2026-10-28 (full auto). **How to apply:** `bash tools/session_gate.sh rantai next` after each release; GO = next cycle.
