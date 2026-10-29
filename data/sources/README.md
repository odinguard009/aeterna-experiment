# Raw card sources

Reference data only. The game does not load these files; import tools read them and every card is still checked against the card image (colour from the corner icons) before it goes into `data/cards/`.

## fandom-cards-bs01-bs77.json
- Source: battle-spirits.fandom.com, read through the wiki's MediaWiki API in the owner's browser on 2026-10-14.
- 8,158 rows from the card lists of the 77 booster sets BS01-BS77 (starter decks, promos and special sets not included).
- Fields per card: `id`, `set`, `name`, `name_jp`, `type`, `color`, `cost`, `reduction`, `symbols` (counted from the wiki's core icons), `families`, `keyword`, `levels` (`lv`, `cores`, `bp`), `effect` (English, wiki markup removed), `rarity`, `secret_variant`, `source`, `missing`.
- Known gaps: BS77 lists only 18 cards so far and its 3 AX cards have no page; about 300 cards have no effect text (mostly vanilla Spirits); 116 card numbers appear twice (Secret or variant rows in the set lists) and must be merged on import.

## fandom-cards-26r.json (v0.62.0)
- Source: battle-spirits.fandom.com set pages of Standard block A (26RSD01-10, 26RBS01-03, 26RCB01, 26RDB01) and their card pages, read with `curl` through the wiki API by `tools/fetch_fandom_std.py` on 2026-10-18 (read-only, 50 titles per call).
- 681 rows (one per card number on a set page), same fields as the export above plus `ex_symbols` (EX symbols, counted as symbols: Standard CR 2-10-3); page disambiguation such as "(26RCB01-029)" is dropped from names. `tools/import_fandom.py` stages them as Saga 50 (block "A"); these rows win over the same numbers listed in a BS set (the six 26RSD Soul Magic cards of BS75).

## fandom-brave-combine.tsv (v0.60.0)
- Source: battle-spirits.fandom.com card pages, fields `bravecondition` and the Brave line of `level`, read through the wiki API in the owner's built-in browser on 2026-10-17 (the export above drops them).
- 441 page titles (460 staged Brave cards; some pages hold several card numbers). `tools/import_fandom.py` (`brave_of`) turns the conditions the engine can check (cost N or more, families, family & cost, no condition) into `brave`; the rest (two-sided Left/Right, Ultimates, Grandwalker Nexus, symbol or keyword holders, "or less") stay without data and are listed as `brave_unparsed` in `data/import/report.json`.

## fandom-nexus-levels.tsv (v0.60.3)
- Source: the `level` field of all 1,375 pages in Category:Nexus, read through the wiki API in the owner's built-in browser on 2026-10-18 (the export above drops Nexus levels).
- Key = first 6 hex digits of SHA-1 of the page title, value = cores per level. `tools/import_fandom.py` fills `levels` of staged Nexus cards without levels (717 filled, 43 without a page match: `nexus_levels_missing` in `data/import/report.json`).

## fandom-ultimate-trigger.tsv (v0.60.3)
- Source: the `{{tk|Ultimate Trigger|...}}` parameter of the pages in Category:Ultimate Trigger (same read, 130 staged titles); the export drops this `[LVn] (timing)` line.
- `tools/import_fandom.py` writes it back after each bare "Ultimate Trigger" paragraph head (119 cards; wiki typos `LV4]` and `[V3]` fixed on import).

## official-fields.json (v0.186.0)
- Source: the official card database pages `https://www.battlespirits.com/cardlist/detail_iframe.php?card_no=<ID>` (read-only, one request per card, 2026-10-29; HTTP 403/429 would have stopped the run, none came). 8,628 of the 8,709 library and staging card numbers have a page; 81 have none (for example BS77).
- Written by `python3 tools/official_check.py --all --save data/sources/official-fields.json`; a rerun replays the cached pages without network (cache = the extracted `official-pages.tar.xz`).
- Fields per card: `type`, `colors`, `cost`, `reductionBy` (colour icons) and `reductionIcons` (every icon, god included), `levels` ([BP, cores] pairs), `braveBp`, `combine`, `nameJp`, `familiesJp`, `textJp` (effect paragraphs; inline icons as `{name}`), `rarity`, `blockIcons`, `collab` (work icons), `products`, `qa` (id, date, question, answer). No images.
- Not a ground truth for effects: a number match proves the number only. Report: `docs/reports/official-check.md`.

## official-pages.tar.xz (v0.186.0)
- The raw official pages behind `official-fields.json` (one `<ID>.html` per card, 1.2 MB packed), so a parser change can be replayed without new requests: `mkdir -p $DIR && tar -C $DIR -xJf data/sources/official-pages.tar.xz && python3 tools/official_check.py --all --cache $DIR`.
