---
name: feedback-background-job-watch
description: "Every background job (tests, push, CI, builds) must be verified as really running and watched with a 5-minute status Monitor; never assume it runs"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1719d7ad-9361-4672-b568-48b0034ad13d
  modified: 2026-10-26T05:48:52.153Z
---

On 2026-10-26 I told the owner a push was running when the background job had never started (no output file, `origin/main` unchanged). The owner asked for a check every 5 minutes (owner changed it from 2 to 5 on 2026-10-26) for every background job, not only tests.

**Why:** a silent dead job looks identical to a slow one; the owner decides from my reports ([[feedback-honest-status]]).

**How to apply:**
- Right after starting any background job, verify it exists: output file present, process alive (`tasklist | grep -i "node.exe\|git.exe"`), bytes growing.
- Start a Monitor that prints every 300 s: time, live process count, output bytes, last line; it ends itself on the final marker and prints the summary. Re-arm it if it expires (30 min).
- Report from that evidence only. Zero processes or an unchanged size = stalled or empty; say so at once.
- Start jobs with `run_in_background` on one plain command, not a trailing `&` in a compound command (that one died silently).
