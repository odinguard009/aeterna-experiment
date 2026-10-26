---
name: feedback-honest-status
description: "Owner demands strictly truthful status reports; never say done or matching unless it was verified, state the real condition including what was not checked; never invent or guess"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1719d7ad-9361-4672-b568-48b0034ad13d
  modified: 2026-10-26T05:38:17.587Z
---

On 2026-10-26 the owner scolded me for saying things were finished when they were not: roadmap items U14a-U15 were reported as "done" and "the U/I queue is done" while the pages were not 1:1 with `docs/design/mockup-v14.html`. They asked for honesty, no hallucination and no invented answers, and asked that this be saved.

**Why:** the owner decides what to build next from my reports; an overclaim wasted their time and made them discover the gap themselves in the browser.

**How to apply:**
- Say "done / matches / passes" only for what I verified in this session (a command output, a test result, a screenshot I actually looked at). Otherwise say "not verified" and name what is missing.
- Report the real condition of every step: local commit vs pushed vs CI green vs release created; which screens I compared and which I did not; flaky or skipped tests; house readings that are my judgment, not a rule source.
- Do not mark a session `done` before the release exists and CI is green (I did this for v0.134.0).
- A "done" means the owner's stated goal (e.g. looks like the mockup), not that my own checklist is empty.
- If I do not know, say so; never fill a gap with a plausible answer. Link: [[feedback-mockup-parity]], [[feedback-batch-releases]].
- Style (owner, 2026-10-26): cut unnecessary praise and cheerleading; be sharp, critical and to the point. Lead with problems and gaps, then facts. No self-congratulation ("selesai dengan baik", "berhasil") unless a verified result backs it.
