# Rebirth import 2026-11-01 (hand)

Owner order: show Rebirth cards in the Library and the Deck Builder, and import them; effects may stay
partial, the cards only need to be playable.

## What was imported

- Source: the Fandom pages in `Category:Rebirth Side A` (the lower-cost front face of each Rebirth pair).
- 264 pages read, **206 front cards imported** into `data/cards` as partial playable cards
  (`fxComplete: false`, printed text in `residual`, A1 note). 58 pages stay out: their Fandom `image` field
  is a descriptive file name with no card number (mostly collab/promo reprints such as "Past Anubis" or
  "Bright Hope"), or the set has no Saga (PB09/U-B).
- Each imported card carries `rebirthTo: "<id>B"`, a synthetic id for the back face. The back faces are not
  imported yet because the flip rule does not exist; the front card is playable in a deck.
- Sets imported: Rebirth Saga (114), True Rebirth Saga (76), Cycle (16); the collab ranges CB13-22 and
  SD55-63 are mapped to Saga 11/12 per `docs/saga-map.md`.
- Tool: `tools/import_rebirth.py` (idempotent; `--dry-run` reports the pages and skips). It fixes the two
  data-shape issues the engine exposed: a one-colour `colors` array is invalid (omit it) and a Spirit's first
  level needs at least one core (SD57-006 prints 0 on Fandom).

## UI / engine display

- `rebirthTo` is enough for the existing Rebirth group check, the ↻ badge and the double frame; no new
  engine rule was added. The Library's default "Complete" filter hides partial cards, so selecting the
  **Rebirth** chip now lets the 206 partial Rebirth cards through (they are all marked "!").
- The Deck Builder shows them as normal partial cards; the Rebirth chip filters them.
- Back faces (`<id>B`) are deliberately absent: flipping/reborn is still unimplemented.

## Counts

- Playable 8,707 -> **8,913** of 8,915 (2 staged: BS77-AX02/AX03); complete 1,696 -> **1,705** (the
  no-effect Rebirth cards count as complete by the existing rule, the rest are marked "!").
- Tests: data (16), partial-promotion (7), U19 (35) and pack (9) pass; new `rebirth_import` test covers the
  206 links and the Library/Deck Builder filter result.

## Next

1. Add the 58 skipped pages by resolving their card numbers (set-list pages / card images).
2. Import the back faces and implement the flip/reborn rule; the data model is already ready
   (`rebirthSide: true`, `rebirthTo`).

## Side B (2026-11-01, display only)
The 206 back faces are imported by `tools/import_rebirth_sides.py` into the sidecar `data/index/rebirth-sides.json` (keyed by front id; 206/206 matched from Fandom `Category:Rebirth Side B`). They are **not** `CARDS` entries, so counts, the Library list, decks, packs and the CPU never see them. The build embeds the sidecar as `BUILTIN_SIDES` (budget B16); the Library card page and the card detail modal show a "↻ Side B / ↻ Side A" button (no flip on a hand card mid-match). The flip rule itself is still not implemented; back effects are shown as text only. Side B art has no mirror yet, so generated art is used.
Revert: `git revert` the UI commit; the sidecar can stay.
