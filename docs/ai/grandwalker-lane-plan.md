# Plan: Lane K ordered per Grandwalker Nexus

Status: **accepted by the owner on 2026-11-03; Lane K work on it has NOT started and is on hold until the owner says start.** Once started, this order replaces the greedy block-A order of `roadmap-open.md` item K for Lane K. The reporting rule and the revival rule are in `CLAUDE.md` (bullet "Grandwalker order"). Revert note: delete that bullet, the hold line in `roadmap-open.md` item G and this file's use.

## 1. Data (generated, official fields only)
- `python3 tools/grandwalker_data.py` writes `data/kb/grandwalker-nexus.json`, `docs/reports/grandwalker-families.md` and `docs/reports/grandwalker-family-table.md`; `--check` fails when they are stale. Source: `data/sources/official-fields.json` (no network); English names from `data/cards`.
- 76 Nexus cards: 52 Grandwalker Nexus (`《神託》`) and 24 Contract Grandwalker Nexus (`《真・神託》`), 81 target families (Japanese + English name).
- Per Nexus: Core Charge target brackets (families + cost), other bracket groups, products, `deck_cards`, `deck_incomplete`, `revival_open`, `order_cards`. Top level: `shared_families_jp`, `revival_cards`, `family_cards`.
- Deck cards = library cards of BS44+/SD44+ with one of the Nexus' own families. Generic support families (target of 30%+ of the Nexus of one kind: 化神, 界渡, 眷属, 締皇) are not own families; 古竜 and 天渡 are real families. If a Nexus has only generic families, those are the fallback.

## 2. Order
1. **Pool (separate).** Families with 100+ cards in BS44+/SD44+ form a pool: 起幻 Primal, 天渡 Celeste, 剣獣 Blade Beast, 機獣 Machine Beast, 原初 Primordial (about 724 open cards). They are not in any Nexus queue, so one Nexus cannot hold the lane.
2. **Nexus queue.** Nexus newest first (earliest product; id prefix for promo-only cards), cards oldest series first, each card once (dedupe against newer Nexus), the Nexus card first in its own queue. 1,789 open cards over 64 Nexus (13 add nothing new, median 29, max 105 for BS50-XX02). Seven cost-only Nexus (BS51-XX03, BS50-CP01, BS47-XX02, BS47-XX03, BS45-XX02, BS44-CP02, BS44-XX02) queue only the Nexus card. Pool-only Nexus (BS72-CX03, BS69-CX02, BS52-X08, BS45-X07, BS44-X09) and BS50-XX02 (generic families only) wait for the pool.
3. **Pool quota.** Per release of 100 new complete cards, about 25 from the pool (greedy `residual_tags.py --block A` order inside it) and about 75 from the Nexus queue. Starting value; adjust if a release stalls.
4. **A Nexus is done** when all its non-pool families are complete.
5. **Revival between bundles.** Revival = reprint with a new effect under the same name, Revival logo, card number `<set>-RV<nnn>` (e.g. SD57-RV001). Scope: set 44 or higher (BS, SD, PB44/PB46). 228 cards: 38 complete, 190 open (87 share an own family with some Nexus; 48 have no official family data). Between two Nexus bundles take up to 5 open revival cards: first those matching the Nexus just finished or about to start, then oldest set first. About 38 gaps for about 50 Nexus bundles, so the list ends inside the Nexus order.
6. **Unit of work** = one Nexus: its engine mechanic first (if any), then its family cards. Releases stay per 100 new complete cards, so one release covers several Nexus.

## 3. Reports
Every progress report (session summary, CHANGELOG bullet, handoff, release notes) names the Grandwalker Nexus (id and name), the family part (own, pool or revival) and the cards done, e.g. `BS74-CX01 Ometeotl: 溶魚 +5, revival +2`.

## 4. Engine work this order needs
- Only Neo-Core Charge is wired. The normal Oracle Core Charge (family + cost) and secondary target groups must be checked per Nexus before its deck is queued.
- Flag Nexus "Contract Advent" is not built (`docs/ai/lane-k-mission.md`); Flag Nexus are family Flag/Bannerace and are excluded from the data.

## 5. Interaction with the greedy order
The greedy `residual_tags.py --block A` order is the fewest-new-mechanics-first order. Per-Nexus order trades some of that efficiency for decks that become playable one at a time; expect a lower "+N cards per schema bump" early on. Hybrid option: inside a Nexus take cards by greedy tag order instead of by series.

## 6. Known limits
- Same-number BS vs SD order is assumed BS first (a guess, not from the official site).
- BS77 cards appear only if already in the repo's official fields.
- The Core Charge text is parsed from the first 2 bullets; unusual texts may be mis-parsed. Spot-check before queueing.
- Newer Nexus take shared cards, so older Nexus can show 0 in queue though their decks have cards.
- English family names are display-only.
- Engine support per Nexus is not yet checked beyond Neo-Core Charge.
