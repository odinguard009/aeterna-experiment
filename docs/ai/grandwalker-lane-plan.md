# Plan: Lane K ordered per Grandwalker Nexus (proposal, owner decides)

Status: proposal only. Nothing in `roadmap-open.md` or the greedy order changes until the owner accepts it.

## Data (generated, official fields only)
- `python3 tools/grandwalker_data.py` writes `data/kb/grandwalker-nexus.json` and `docs/reports/grandwalker-families.md` (`--check` fails when stale). Source: `data/sources/official-fields.json` (no network), English names from `data/cards`.
- 76 Nexus cards: 52 Grandwalker Nexus (《神託》) and 24 Contract Grandwalker Nexus (《真・神託》), sorted newest first printing first. 81 target families (Japanese name + English name).
- Per Nexus: the Core Charge target brackets (families + cost), the other bracket groups (Nexus / Brave / Ultimate / named card), the two Core Charge triggers (core on summon, +1 core per target card among 3 cards sent from decktop to Trash), products, `deck_cards`, `deck_incomplete`, `order_cards`.
- Deck cards = library cards of BS44+/SD44+ whose family is one of the Nexus' own families. Generic support families (target of 30%+ of the Nexus of one kind: 化神, 界渡, 眷属, 締皇) are not counted as a Nexus' own family, otherwise they would pull in thousands of cards. 古竜 and 天渡 stay real families. If a Nexus has only generic families, those are used as a fallback.

## Proposed order
1. Nexus newest first (the table order). 2. Inside a Nexus: its open cards oldest series first (SD44 ... BS77). 3. A card already queued under a newer Nexus is skipped (`order_cards`), so each card appears once. The Nexus card itself leads its own queue. Queue total now: 2,488 open cards (each once).
4. Unit of work = one Nexus: its engine mechanic first (if any), then its family cards; a release still happens per 100 new complete cards (existing rule), so one release covers several Nexus.

## Engine work this order needs
- Only Neo-Core Charge is wired. The normal Oracle Core Charge target (family + cost) and the secondary target groups must be checked per Nexus before its deck is queued.
- Flag Nexus "Contract Advent" is not built (`docs/ai/lane-k-mission.md`); Flag Nexus are family Flag/Bannerace, not Grandwalker, and are excluded from the data.

## Interaction with the existing order
- Today block order is the greedy `residual_tags.py --block A` order (fewest-new-mechanics first). Per-Nexus order trades some of that efficiency for decks that become fully playable one at a time. Hybrid option: inside a Nexus, still take cards by greedy tag order instead of by series.
- Expect many cards in a Nexus' queue to need mechanics not yet built; the pace metric (+N cards per schema bump) will be lower early on.

## Known limits of the data
- 7 Nexus have no family token at all in the first bracket (promo/XX/CP Nexus with a cost-only target, e.g. BS44-XX02, BS47-XX02); only the Nexus card itself is queued for them.
- Checked: every 創界神 Nexus/contract row matched the Oracle pattern; no target-family card is missing from the library; no Nexus name is duplicated.
- Newer Nexus take shared cards, so older Nexus can show 0 in queue even though their decks have cards (see `Deck cards` vs `Queue`).
- "First set" uses the earliest product; SD vs BS with the same number is assumed BS first (a guess, not from the official site).
- BS77 cards are only present if already in the repo's official fields; the official site may not list them yet.
- The Core Charge text is parsed from the first 2 ◆ bullets; an unusual Nexus text may be mis-parsed. Spot-check before queueing.
