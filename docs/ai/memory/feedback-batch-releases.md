---
name: feedback-batch-releases
description: "Owner wants UI roadmap items bundled into one release per batch (pre-push hook runs once per batch), commits stay per item"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1719d7ad-9361-4672-b568-48b0034ad13d
  modified: 2026-10-26T03:19:20.377Z
---

From 2026-10-26 the owner chose per-batch releases: bundle several UI items into one release, one push, one CI wait; keep one commit per item.

**Why:** the pre-push hook runs the full quick test set serially (~10 min per push) and release.sh waits for CI (up to ~20 min); per-item releases made the chain slow.

**How to apply:** group coherent items (e.g. U14i + U15 parts) into one version bump; run `npm run -s loop` per commit; never use `--no-verify`; do not edit files while a push or release.sh is running. Bigger items (U15) may still ship alone. See [[feedback-chain-mode]].
