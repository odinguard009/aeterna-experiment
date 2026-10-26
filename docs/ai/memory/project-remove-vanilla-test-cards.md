---
name: project-remove-vanilla-test-cards
description: "Owner order 2026-10-26: after the frontend audit and before Lane K restarts, delete the vanilla test cards (grey no-art placeholder Spirits/Nexus in the library)"
metadata:
  type: project
---

The owner showed a library screenshot full of grey blank cards (SPI/NEX, BP 2000-7000, no art) and said: after the frontend audit is finished and before Lane K starts again, delete the vanilla test cards.

**Why:** they clutter the library and are not real cards.

**How to apply:** order is UI parity -> frontend audit -> remove vanilla test cards -> Lane K. Before deleting, identify them (which file/ids; check they are not used by tests or fixtures; the screenshot is the evidence, ids not yet checked) and keep tests green. Do not touch while a push hook runs. Link: [[feedback-mockup-parity]].

**Owner 2026-10-27 clarification:** delete ONLY the unofficial vanilla cards the program generated for testing (not real cards). Official Battle Spirits TCG vanilla cards (in data/sources, official list or Fandom) must stay. Identify by origin (generated/test ids, not in official source data) before deleting; verify the count and list before removal.
