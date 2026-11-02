---
name: measure-before-claiming
description: "Check real numbers (gh run timings, test output) before stating durations or causes; the owner catches wrong claims"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 54c471bc-907b-4109-a9d5-6812ad472b8e
  modified: 2026-11-02T09:49:52.964Z
---

CI on main takes about 4 minutes (4 shards, 2-4 min each); the "~20 min" in CLAUDE.md is the full quick set run locally. I mixed them up and the owner had to correct me (2026-11-02).

**Why:** the owner reads my claims as facts; wrong ones cost trust ([[feedback-honest-status]]).
**How to apply:** before giving a duration, cause or count, read it from `gh run view --json jobs`, test output or the file. Node 24 test output prints `ℹ pass`, not `# pass`, so grep for that. Before pushing UI/template changes, run the tests whose area changed (deckbuilder_*, library_*), not only `npm run -s loop` (it runs only changed test files).
