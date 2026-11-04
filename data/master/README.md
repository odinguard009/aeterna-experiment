# Card master database

`cards.json.gz` is one record per card number (15,554 numbers) merged from three sources: the Aeterna library (`data/cards`, `data/import`), the official card database (JP) and the Fandom wiki (EN). Rebuild with `python3 tools/master/build.py` (reads the caches in `data/master/cache`, no network). Import into the library with `python3 tools/import_master.py` (see its docstring); the report is `docs/reports/master-import.md` (`python3 tools/master/report.py`).

## Identity
A card is its normalized number (spaces removed, upper case). The same name does not mean the same card.

## Classes (`class`)
- `standalone`: the group head, or a card with its own data.
- `alt_art`: same data as its head, same set (another illustration).
- `reprint`: same data as its head, another set.
- `token`: cannot go in a deck. `stub`: a Fandom row without card data.
Groups are keyed by Japanese name + text + type + cost + colours + level BPs; the head is the earliest set.

## Fields
number, id, sources, library_status (in_library / missing / staging_only), set, kind, type, contract, token, color, cost, rarity, name_jp, text_jp, family_jp, levels, reduction_colors (or fandom_reduction / fandom_symbols for Fandom-only cards), products, image, block_icon, collab_icon, name_en, text_en, families_en, fandom_title, fandom_sets, aeterna, conflicts, group_key, group_id, canonical_number, group_size, class.

## Limits
- English name/text exist only where Fandom has them; otherwise the library card keeps the Japanese text and says so in `note`.
- Imported cards are partial ("!" mark, `fxComplete: false`) unless they print no text; effects are not wired.
- Symbols are not on the official page: copied from a library card with the same name and stats, else 1 for Spirits/Ultimates and 0 otherwise (note says so).
