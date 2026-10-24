---
name: "bs-effect-mechanic-adder"
description: "Use when adding a new card effect, trigger, action or mechanic to the Aeterna data-driven effect engine and testing it."
---

# Adding effects and mechanics to the Aeterna engine (v0.30+)

CLAUDE.md loads automatically: do not re-read it. Since v0.60.1 the code lives in `packages/engine/src/NN-name.js` (engine) and `apps/web/src/NN-name.js` (UI), joined into one classic script by `node tools/build.mjs` (`index.html` is generated). The effect engine is split over `packages/engine/src/02a`-`02k` (code map: `docs/ai/code-map.md`; `02b` = the `FX_ACTIONS` table; main names: `FX_TRIGGERS`, `FX_ACTIONS`, `fxMatch`, `fxIf`, `ownerOf`, `staticBp`, `removeNexus`, `fxPickTarget`, `parseEffects`, `fireFx`, `fireFxMulti`, `runActions`, `asResolving`); rules helpers `06-rules.js`, turn flow `07-turn.js`, battle `08-battle.js`, CPU `09-cpu.js`. Find code with `grep -n` in `packages/engine/src/` and `apps/web/src/`, never by reading `index.html`.

## Vocabulary basics (full lists: `FX_TRIGGERS`, `FX_ACTIONS`, `fxIf`)
- Modifiers: `lv` (level gate, index+1), `once` (per turn, `inst.fxUsed[idx]===G.turnNo`), `optional` (human gets a prompt, CPU decides), `match` {name[], family[]} (name match is case-insensitive substring).
- A card with only partly implemented text sets `fxComplete:false` and lists the rest in `residual`; the UI then shows what is not implemented.
- Hook points: `bpOf` adds `staticBp(i)`; `doBattle` wraps `doBattleInner` (sets/clears `G.attacker`, fires ATTACKS, ALLY_ATTACKS, ALLY_BLOCKED); SUMMONED fires after `summon()`; parseCard/registerImported read `effects`/`fxComplete`.

## Manual first
Read `docs/manual-notes.md`; fetch the official PDF only for a rule that is missing and add it there. Each mechanic gets: a glossary entry in `data/glossary/effects.json` with a `rule` note citing the manual, an entry in `data/kb/rule-obligations.json` (source page, status, proving test; `python3 tools/check_obligations.py` must report 0 problems), and lines in `docs/rules-coverage.md` and `docs/reports/effect-coverage.md` (repo only: the Project holds just `claude/CLAUDE.md` and `claude/card-list.md`). Mark partial as partial.

## Workflow
1. Read the card text exactly; write the card's `effects` JSON in `data/cards/saga-NN.json` before touching engine code (data: the Fandom export in the repo first, `data/import` and `data/sources` (needs `git sparse-checkout add data/sources`), then the official card list; card images only when those cannot settle it; never AI guesses).
2. If a trigger/action/condition is missing, add it to the tables with a validation rule so bad JSON is rejected. This changes the effect format (`docs/ai/effect-format.md`): raise `SCHEMA_VERSION` in `tools/fx_schema.mjs`, run `node tools/fx_schema.mjs`, commit `packages/engine/fx-schema.json` and add a line under "Versions" there (the loop's `fx validate` step fails until then). Also run `node tools/compiler_wiring.mjs` (`docs/reports/compiler-wiring.md` lists the engine actions the compilers still cannot emit).
3. Expose new helpers through `window.BS` (in `16-events.js`) when tests need them.
4. `python3 tools/build_cards.py && python3 tools/tag_effects.py && python3 tools/residual_tags.py && npm run -s loop` (loop = build + lint + smoke tests + changed test files).
5. **Verify against the source text (the compiler is a measurement tool, never the source of correctness):** for each promoted card run `python3 tools/card_verify.py <id>` and confirm every printed clause maps to an action or is named in `residual`; a clause that is neither is a false complete. `fxComplete: true` must mean every printed effect runs.
6. Tests, cheapest first: Node engine tests in the style of `tests/unit/engine.test.mjs` (quiet board via `BS.testSetup()`; positive, negative/condition false, once-per-turn, human prompt vs CPU) -> `npm run test:quick`; a scenario (`tests/scenarios`, `BS.loadScenario`) or a `tests/suites/vNN_tests.py` case for UI prompts; `npm run test:props` for CPU-vs-CPU with the card in a deck. Then the release gate in `docs/ai/release.md`.
7. If the glossary entry is listed in `tests/unit/known-gaps.json`, remove it once it has a rule note (the ratchet test enforces this).
8. Close the matching GitHub issue (`Fixes #N` in the commit; tick the checklist in the roadmap issue).

## Roadmap
Open items live in `docs/ai/roadmap-open.md` (read the lines for the mechanic you touch; delete an item there when done) and in GitHub Issues. Rules follow the latest official manuals (Eternal 17.x, Standard 1.x); re-read them when in doubt rather than relying on memory.