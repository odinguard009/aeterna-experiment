# Bulk playable pass 2026-11-01 (hand)

Owner order, 2026-11-01: the cards still in `data/import` enter the library as **playable** cards now, with their
effects **not wired**; a Lane K session completes them in place later. This pass is a one-time branch, so it does not
touch the active `wip/lane-k` lane.

## Result

- Branch: `bulk/playable-20261101`, based on `origin/main` v0.203.0 (not merged, no release).
- Promoted: **1,637** staged cards into `data/cards` with `fxComplete: false`, the printed text in `residual`, and
  the A1 note (`Partial card (v0.79.0 ...`). The staging record stays in `data/import`, so a later compiler pass can
  replace the card; a Lane K session completes it in place.
- Playable: **6,922 -> 8,559** of 8,709. Complete: **1,643** (unchanged: no effect was wired). Staged: 150.
- The cards show the deck builder's "!" mark; their effects do not run, but they can be put in a deck and played.
- Tool: `tools/promote_playable_bulk.py` (`--dry-run` prints the counts and the skipped cards). Sequence:
  promote -> `tools/import_fandom.py` (keeps the A1 records, drops the complete vanilla card) ->
  `tools/tag_effects.py` -> `tools/residual_tags.py` -> `tools/unlock_report.py` -> `node tools/build.mjs`.
- Tests updated for the new state: `contractor_hermes_deck` G05, `contractor_nuadha_deck` B06, `ready_decks` RD-3
  (cards that used to be missing are now in the library). Full quick set: everything passes except the Windows-only
  Stop-hook test S3 (the hook's `shell=True` runs the test's `|` command through `cmd.exe`; CI is Linux).

## The 14 cards that cannot be loaded at all

`node tools/check_staged.mjs` reports 7,073 / 7,087 loadable; these 14 are rejected by the game's own `parseCard`
and stay staged:

| Card | Name | Why it cannot enter the game |
|---|---|---|
| BS14-008 | Pentaceratop | levels: the Fandom export has no level table (Spirit needs 1-6 levels) |
| BS14-X01 | The DragonHero Sieg-Yamato-Fried | levels: the Fandom export has no level table |
| BS16-036 | The IceSaint Jeanne-da-Arc | levels: the Fandom export has no level table |
| BS18-009 | The FireBeast Hanu-Marg | levels: the Fandom export has no level table |
| BS42-006 | The DinosaurAlliance PinnedSkinAmperosa | levels: the Fandom export has no level table |
| BS42-021 | Exoknight Dragon | levels: the Fandom export has no level table |
| BS42-038 | The NobleOrder E-N09 | levels: the Fandom export has no level table |
| BS55-XX01 | The AbsoluteDragonDeity Amaterasu-Dragon | levels: the Fandom export has no level table |
| BS77-AX01 | The QuadrupleBladeHornetKing Fong-Need | levels: the Fandom export has no level table |
| BS77-AX02 | The ImperialDeity Galoud | levels: the Fandom export has no level table |
| BS77-AX03 | The ArmoredSeaGod Girafa-Rando | levels: the Fandom export has no level table |
| BS42-074 | The NobleGun Rebellion | Brave: no combine data (bp/family/name/nexus) in the export |
| BS44-072 | Jackal-Arms | Brave: no combine data (bp/family/name/nexus) in the export |
| BS60-XX01 | The OracleTwentyOnePillars 0 The Fool | symbols: six colours on one Spirit (the engine allows 5) |

## The other 136 staged cards the shipped-data checks reject

They load, but promoting them would break the shipped-data and regression checks; they stay staged until their
source row is repaired:

| Count | Check | Meaning |
|---|---|---|
| 48 | data.test D04-D09 | duplicate/false level core thresholds, missing cost or symbols, or an id outside the shipped id pattern |
| 62 | `fandom_bs74_bs76_data` | cost / god reduction / level cores differ from the Fandom export (mostly a missing `god` reduction) |
| 15 | `symbol_cost_reduction` R19 | Contract Grandwalker Nexus has `symbols: 0`, so it has no symbol to reduce its colour |
| 8 | `ui_button_labels` U19 | malformed level bracket in the source text (`[LV1][LV2[LV3]`) |
| 3 | `fandom_bs74_bs76_data` | a blue reduction on a card that is not blue (BS74-039, BS74-073 and one more) |

`python3 tools/promote_playable_bulk.py --dry-run` prints every skipped id with its reason. After the source row is
fixed, rerun the pass (it is idempotent).

## Next

1. Review/merge this branch into the lane work; if `wip/lane-k` has moved, apply the same sequence on top of it
   (the promotion script skips cards that already exist).
2. Run Lane K normally: the partial cards are in `data/cards`, so `tools/lane_k_packet.mjs` and the completing
   sessions pick them up; complete counts rise as their effects are wired.
3. Repair the 150 skipped source rows (levels, Brave combine data, `god` reduction, Contract Grandwalker symbols,
   malformed text) before a second pass.
