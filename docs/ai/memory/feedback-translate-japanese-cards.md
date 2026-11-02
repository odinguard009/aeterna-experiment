---
name: feedback-translate-japanese-cards
description: Owner (2026-11-02) - Japanese-text cards are translated to English before they are entered or wired
metadata:
  type: feedback
---

When a card to be entered or wired has Japanese text, translate it to English first, then write the effect from the English reading.

**Why:** the owner wants the card data and notes in English; the engine and docs are English.
**How to apply:** put the English wording in the card `text` or the commit/test note; flag any translation doubt in the release disclosures instead of guessing silently. Official Japanese text stays the source of truth when the translation is unclear.
