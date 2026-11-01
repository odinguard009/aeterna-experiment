# Bulk playable pass 2026-11-01 (hand)

Owner orders, 2026-11-01: (1) the cards still in `data/import` enter the library as **playable** cards now,
with their effects **not wired**; (2) the official Battle Spirits TCG card database is the first source for
card data, not the Fandom export. This pass is a one-time branch and does not touch the active `wip/lane-k` lane.

## Result

- Branch: `official/playable-20261101`, based on `origin/main` v0.204.0 (not merged, no release).
- Promoted: **1,780** staged cards into `data/cards` with `fxComplete: false`, the printed text in `residual`,
  and the A1 note (`Partial card (v0.79.0 ...`). The staging record stays in `data/import`, so a later compiler
  pass can replace the card; a Lane K session completes it in place.
- Playable: **6,922 -> 8,702** of 8,709. Complete: **1,696** (no effect was wired). Staged: 7.
- The cards show the deck builder's "!" mark; their effects do not run, but they can be put in a deck and played.

## Official data first (owner order 2026-11-01)

`tools/apply_official_fix.py` reads `data/sources/official-fields.json` (the cached battlespirits.com card
database pages) and overwrites numbers for `data/cards` and `data/import`: cost, reduction (six colours plus
the `神` god and `極` Ultimate icons), level BP/cores (including filling empty level tables and dropping a
trailing empty table row), and Brave BP/combine data. It also repairs the five malformed English level
brackets. Applied counts: cost 7, levels 92 (including the `cores,bp` key-order normalisation the pack round
trip expects), reduction 2,589 entries (cards appear in both data/cards and data/import), Brave 364, text 5,
symbols 16.

The official fields do **not** expose the printed symbol count, so 16 cards are inferred and marked in the
tool: the 15 Contract Grandwalker Nexuses with `symbols: 0` (the nine Contract Grandwalkers already in the
library all have one symbol) and BS60-XX01 (Fandom counted one symbol per colour = 6; the engine allows 5,
and the card's own text fixes its symbol to 0, so it has one). The official site supplies the Japanese effect
text only; English effect text still comes from the Fandom export.

## The 7 cards that still stay staged

| Card | Name | Why it cannot enter the game yet |
|---|---|---|
| BS55-XX01 | The AbsoluteDragonDeity Amaterasu-Dragon | the official page has no usable level table |
| BS77-AX01 | The QuadrupleBladeHornetKing Fong-Need | no official page |
| BS77-AX02 | The ImperialDeity Galoud | no official page |
| BS77-AX03 | The ArmoredSeaGod Girafa-Rando | no official page |
| BS06-028 | Gabunohashi | the English text is Fandom wiki tabber markup; the official site is Japanese only |
| BS58-015 | The Bal-Masque Margrave SpacePirate Seitz | the English text carries Fandom `{{mdrain}}` / `{{mt}}` wiki templates |
| BS59-057 | The SpacePirate Shariba-Luke | the English text carries Fandom `{{Accel}}` / `{{mt}}` wiki templates |

`python3 tools/promote_playable_bulk.py --dry-run` prints every skipped id with its reason. After the source
row is fixed, rerun the pass (it is idempotent).

## Tests updated for the new state

- `tests/unit/fandom_bs74_bs76_data.test.mjs`: compares BS74-BS76 cost, god reduction and level cores with the
  **official fields** (the Fandom comparison and its recorded differences are gone).
- `tests/unit/fandom_import.test.mjs` I10: `god` is a known reduction key (the official fields add it).
- `tests/unit/data.test.mjs` D09: official promo ids `CP` and `10THX` are accepted.
- `tests/unit/partial_cards_data` A80 / `partial_promotion` PA02 unchanged and green.
- G05 / B06 / RD-3: cards that used to be missing are now in the library.
- `tools/check_staged.mjs` KNOWN_GAPS shrunk to the four cards without official data above.

## Commands used

```
python3 tools/apply_official_fix.py --apply
python3 tools/promote_playable_bulk.py
python3 tools/import_fandom.py                 # sync staging/report; keeps the A1 records
python3 tools/apply_official_fix.py --apply    # restore the official numbers in data/import
python3 tools/tag_effects.py
python3 tools/residual_tags.py
python3 tools/unlock_report.py
node tools/build.mjs
```

## Next

1. Review/merge this branch into the lane work; if `wip/lane-k` has moved, run the same sequence on top of it
   (the promotion script skips cards that already exist).
2. Run Lane K normally: the partial cards are in `data/cards`, so `tools/lane_k_packet.mjs` and the
   completing sessions pick them up; complete counts rise as their effects are wired.
3. Repair the 7 remaining source rows (official level table / official page / English text) before a second pass.
