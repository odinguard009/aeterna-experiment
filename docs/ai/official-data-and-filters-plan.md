# Plan: official data, card-input process and grouping dropdowns (APPROVED 2026-10-29)

Status: approved by the owner on 2026-10-29 and entered in `docs/ai/roadmap-open.md` (item R, U/I queue R0-R8). Nothing is implemented yet. Section D lists the conflicts; the owner's answers are recorded in item R of the roadmap. This file merges two requests: `docs/ai/official-data-plan.md` (phases 0-4, official data and the new input process) and the new dropdown filters for the deck builder and the Library. Phase details live in the first file; this one fixes the order, the sessions and the open decisions.

## A. Grouping dropdowns (deck builder and Library)

Exists today (`apps/web/src/13a-deckbuilder.js`, `14-images.js`): colour, cost 0-10+, type (incl. Contract, Mirage, Rebirth), Group (Legacy, EX, Burst, True Release, Manifest, High Speed, Token), set, free-text Family, "Complete only", sort.

| # | New dropdown | Official source | Data state | Needs |
|---|---|---|---|---|
| 1 | Family list (about 330, searchable, OR/AND) | `system[]` | `families` exists | UI only |
| 2 | Colour match mode (any / all) | `attribute[]` | `colors` exists | UI only |
| 3 | BP range, core count | card page | `levels` exists | UI only |
| 4 | Block icon | `block_icon[]` | field `block` exists; value meaning NOT yet checked against the official icon | check, then UI |
| 5 | Product / set | `prodid` | exists | align names with official |
| 6 | Official category (10 values) | `category[]` | `type` + flags, not 1:1 | map, then UI |
| 7 | Rarity (20) | `rarity[]` | missing | fetch |
| 8 | Collaboration | `collabo[]` | missing | fetch |
| 9 | Reduction (count / colour) | card page | 7.5% of cards empty (source gap) | Phase 1 first |
| 10 | Symbols | card page | empty for older cards | Phase 1 first |
| 11 | Work icon | card page | not parsed | parse |

How to get 7 and 8 without guessing: the official list search filters by rarity and collaboration, so one query per value (about 20 + a few) returns the card numbers for it. This is a few dozen requests, not 8,709. Whether the detail page also shows rarity is unverified; the list query does not depend on it.

UI rules (CLAUDE.md "UI"): reuse the existing dropdown component (`ddList`/`ddButton`), keep both layouts and every function, no redesign. Each UI step: own commit, `backup/vX` first, one screenshot per layout, revert note, one read-only player-view pass (`bs-playwright-tester`). Risk: `apps/web/styles.css` was ~120 bytes under its 90 KB budget (B04); check the budget before the first UI session, raise it or trim CSS as an explicit step. A filter whose data is incomplete (9, 10) is not shipped until the data is filled, otherwise it hides cards silently.

## B. Official data and input process
Unchanged from `official-data-plan.md`: Phase 0 save fields and raw pages, Phase 1 the R1 apply script for numbers, Phase 2 audit of the 1,225 complete cards, Phase 3 new input process (official heads, verifier, `promote_import.py` guard, CI replay), Phase 4 official Q&A. Current measured state: the full fetch is still running (about 6,400 of 8,709 at last look), so final error rates are not known yet.

## C. Proposed session order (each ends with its own release)
| Session | Content | Lane | Depends on |
|---|---|---|---|
| R0 | Full fetch finished; Phase 0: the official fields file (data/sources/official-fields.json), pages archive, `docs/reports/official-check.md`; list-query fetch of rarity, collaboration, block, product | U/I (infra) | owner approval |
| R1 | Decide the multi-colour X model; Phase 1 the R1 apply script (dry run, one commit per field, tests); fills reduction and symbols where the official page has them | U/I | R0 |
| R2 | Filters part 1: items 1, 2, 3, 5 (no new data), UI rules above | U/I | styles budget check |
| R3 | Filters part 2: items 4, 6, 7, 8, 9, 10, 11 as the data allows | U/I | R0, R1 |
| R4 | Phase 2 audit of the complete cards, first half (by set); mismatches fixed with tests or set to `fxComplete: false` | K-audit | R1 |
| R5 | Phase 2 second half; the complete count is reported as it is, even if it drops | K-audit | R4 |
| R6 | "Measure before building": how many single-blocker cards open with Japanese heads; go / no-go for the head parser | U/I | R0 |
| R7 | Phase 3: head parser, verifier before promotion, `promote_import.py` refuses mismatching numbers, CI replay | U/I | R6 go |
| R8 | Phase 4: Q&A capture, first rule notes (two-sided Brave, Manifest, Mirage) | U/I | R0 |
| then | back to Lane K, Standard block A, with the new input process | K | R7 |

R2 does not need R0 beyond the budget check and can run first if the owner wants a visible result sooner. R4-R5 may be merged into one session if R1 shows few mismatches.

## D. Conflicts with the current working agreement (owner decides)
1. "Standard block A only; pause all other card work": R4-R5 touch cards that are already complete and R7 changes the input path. Needs an explicit exception, or the plan waits for block A.
2. Lane K is running on `wip/lane-k`. the R1 apply script edits `data/cards` and `data/import`; Lane K must rebase onto `main` before each bundle (already its rule). A K release in between is fine, but R1 must be re-run after it.
3. The `CLAUDE.md` card-data source order and the lane order text change when R0/R1 land; that edit is part of those sessions, not done now.
4. Images stay out of scope (owner 2026-10-29). Copyright and commit-author notes: owner said to ignore.

## E. Honest limits
- Official numbers and heads do not prove that an effect is implemented with the right rule; only tests and the Q&A cover that.
- BS77 is not on the official site; about 64+ ids had no page so far.
- Whether Japanese bodies compile more easily than the English ones is unproven; R6 measures it before R7 is built.
- Rarity/collaboration availability on the detail page is unchecked; the list-query route is the fallback.
