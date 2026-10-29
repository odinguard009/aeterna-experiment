# Official card data plan (owner request 2026-10-29)

Goal: the official card database (battlespirits.com `cardlist/detail_iframe.php?card_no=<ID>`) becomes the first source for card numbers and heads, so card input is checked against it and effects can be compiled and verified automatically. Nothing already in the library is re-entered: every step edits or reads existing records.

## Measured so far (sample, not the whole pool)
- 200 random cards: 23 differ. Reduction missing 15 (older sets: the Fandom source itself has an empty reduction, 7 of the 15 are `fxComplete: true`), level values 3 (fixed: BS70-021, BS73-042, BS47-046), colours 5 (multi-colour X cards, data model undecided).
- Japanese heads (`[..]`, `『..』`, `《..》`) are a closed vocabulary: 255 distinct over ~1,500 cards; the top 60 cover the heads of 79% of cards, the top 100 cover 89%.
- Japanese effect bodies were NOT shown to be more regular than the English ones (the experiment was not comparable). Re-measure on the same ids after the full fetch.
- Complete cards: the number check passes 373 of 376, but it is too lenient to prove an effect is right.

## Phase 0 - data (after the full fetch)
1. `tools/official_check.py --all --save data/sources/official-fields.json` (cache replay, no new requests). Fields: type, colours, cost, reduction per colour, levels, Brave bp/combine, Japanese name, families, effect text (icons as `{soulcore}`), later Q&A.
2. Archive of the raw pages: `data/sources/official-pages.tar.xz` (images skipped, owner 2026-10-29).
3. Report `docs/reports/official-check.md` (generated): error rate per field, per set, split into complete / partial / staged.

## Phase 1 - numbers (deterministic)
- the R1 apply script (tools/apply_official, not written yet): official value overwrites cost, colours, reduction (colour keys only; `ultimate` / `god` keys kept), level bp/cores, Brave bp/costGe/costLe. Idempotent, dry run by default, one commit per field. Lane K reruns it after each rebase; never touches `wip/lane-k`.
- Decide the multi-colour X card model before touching colours (what does BS47-046 "counts as every colour" mean for the engine).
- A test per new pattern; `npm run -s loop`.

## Phase 2 - audit of the 1,225 complete cards
1. Head check: trigger set, level ranges and keyword set from the Japanese heads against the compiled `effects` (trigger map JP -> engine trigger kept in one file, extended by measurement).
2. Mismatch list -> read each card -> fix with a test, or set `fxComplete: false` with a `residual`. The complete count stays honest even if it drops.
3. Limit: a correct text read applied with a wrong rule (order, edge cases) is not found by text comparison; only per-action tests (`tests/unit/lib/fx-props.mjs`) and Q&A answers cover that.

## Phase 3 - input process (replaces "read every card once")
Current: English Fandom text -> compile_effects/compile_v2 -> Review list -> human reads every card -> promote.
New:
1. Import: numbers and heads from the official fields (not Fandom); Fandom stays for the English text and names.
2. Head parser from the Japanese heads gives trigger, level and keyword for every card; the English body clauses still go through compile_v2.
3. Verifier (Phase 2 check) runs on every compiled card before promotion; only cards it flags are read by hand.
4. `promote_import.py` refuses a card whose numbers differ from the official fields.
5. CI step: `official_check.py` replay against the saved fields on changed cards (no network).
Order of work: block A (26R) first, then by Saga as before.

## Phase 4 - rules from the official Q&A
Every page carries Q&A (id, date, question, answer). Store them with the fields, link them to the mechanic notes. First targets: two-sided Braves (BS38-RV022, BS45-080), Manifest, Mirage.

## Measure before building
Of the cards held by exactly one head blocker (`docs/reports/compile-v2-report.md`), how many open when the head comes from the Japanese page? That is the estimate of "+N complete" for Phase 3; do it before writing the head parser.

## Constraints
No subagent card authoring (A2 rule); new mechanics get a scenario first; update the card-data source order in CLAUDE.md when Phase 1 lands; commits keep their current author setting.
