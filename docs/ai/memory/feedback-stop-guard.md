---
name: Stop guard for chain sessions
description: A Stop hook holds chain-mode sessions (marker in .git) so they cannot end a turn by themselves; stops are logged
type: feedback
---
Owner 2026-10-29: Lane K sessions kept stopping despite chain mode, and the model's own explanation was only "my mistake". Fix is enforced, not promised: `.claude/hooks/chain_stop_guard.py` (Stop hook) blocks while `.git/aeterna-chain` exists and `rantai status` is ON; `.git/aeterna-stop-log.jsonl` records every stop. A missing `tokens=` no longer STOPs the gate. To stop on purpose the owner says `rantai off`.
**Why:** self-reports of why a session stopped are unreliable; a hook and a log are checkable.
**How to apply:** do not remove the hook or marker; when asked why a session stopped, read the log first.
