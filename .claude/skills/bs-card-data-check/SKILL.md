---
name: "bs-card-data-check"
description: "Use when checking or fixing Aeterna card data conflicts (god icons, BS74-BS76) against the official Battle Spirits card list and Fandom."
---

# Aeterna card data check

Rules: `docs/ai/cards-and-rules.md` (read it). Never AI guesses; never overwrite blindly; live Fandom may return 403: do not bypass it.

## Source order (owner, 2026-10-15; updated 2026-10-16)
1. Fandom export in the repo (`data/import`, `data/sources` via `git sparse-checkout add data/sources`): checked first, no website needed; Fandom values win over cardrush/yuyu-tei.
2. Official Battle Spirits card list and rule PDFs (asia-en.battlespirits.com / battlespirits.com, WebFetch).
3. Live Fandom wiki. If WebFetch/WebSearch fails because a page cannot be rendered or needs a login or click: use the built-in browser, then Claude in Chrome, without asking (owner). If a tool declines the site (403 or a refusal), do not go around it (no curl, python, mirror or browser): say the page is not reachable and rely on the repo export.
4. yuyu-tei / cardrush-bs.jp product pages (lowest priority, only to break a tie).
5. Card images only when 1-4 cannot settle it (skill `bs-card-image-reader`, contact sheets of ~20 cropped corners, one colour at a time).

## Workflow
1. List the cards to check from the open data issue, if any (`gh api "repos/odinguard009/aeterna-experiment/issues?labels=data&state=open" --jq '.[] | "#\(.number) \(.title)"'`; the old card-conflict issue was settled in v0.48.2) or a one-line `python3 -c` query on `data/cards/saga-*.json` (only the fields needed).
2. Batch: independent read-only lookups may run as parallel `Agent` calls (they inherit Opus) (one batch or deck per agent). Each agent returns, per card: id, field, current value, value found, source URL, confidence. Agents never edit files or run git.
3. Merge in the main session. Apply only values confirmed by a source; a card where sources disagree keeps its value plus a `note`, and goes into the issue as still open.
4. `python3 tools/build_cards.py && python3 tools/tag_effects.py && npm run -s loop`; add data tests for the corrected fields.
5. One commit for the batch (`Fixes #N` or `Refs #N`), patch version bump, release notes listing each change with its source; update the issue checklist.