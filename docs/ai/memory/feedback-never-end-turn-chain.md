---
name: feedback-never-end-turn-chain
description: Chain mode stalls when a turn ends with a push still running; never end a turn with wrap-up mid-chain
metadata:
  type: feedback
---

Owner 2026-10-27: the chain stopped because I ended the turn (wrap_up + closing text) while `git push` was still running in the background; the push died and nothing continued.

**Why:** gate was ON, but the chain only lives while I keep taking turns.
**How to apply:** while rantai is ON never call wrap_up or write a closing message after a release. Run the push with run_in_background, keep working (read-only prep for the next item) until the completion notification, then regression_due, `session_gate.sh done ...`, `rantai next`, and start the next item at once. See [[feedback-full-auto]].
