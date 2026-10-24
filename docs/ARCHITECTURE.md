# Aeterna architecture

How the pieces fit. Other docs link here instead of repeating it. Rules for agents live in `CLAUDE.md`; where each kind of file goes: skill `bs-doc-convention`; one-line index of every doc: `docs/README.md`.

## 1. Build: sources -> `index.html`
The shipped game is ONE offline HTML file. Never edit `index.html` or `build/`.

```
apps/web/index.template.html   page shell with /*@@CSS@@*/ and /*@@JS@@*/ marker lines
apps/web/styles.css            all CSS
packages/engine/src/NN-*.js  engine parts: config, card pack codec, effects, state, rules, turn, battle, CPU, zones, match
apps/web/src/NN-*.js         UI parts: error catcher, modals, human input, render, deck builder, images, events
                          both folders are joined in file-name order as ONE classic script (tools/src_parts.mjs)
build/all-cards.json built-in card pack, compressed and embedded between /*PACK_START*/ and /*PACK_END*/
        |
        v  node tools/build.mjs   (--check: CI guard that index.html is the build of its sources)
index.html                + build/game.js (joined script for ESLint)
                          + docs/ai/code-map.md, docs/progress.html, docs/roadmap.html (regenerated)
```

Top-level functions stay global (inline handlers, `window.BS` and the tests rely on it). Part order matters: `01a-card-pack.js` (pack codec, shared with `tools/build.mjs`) loads before `03-imported-cards.js`. Find code with `docs/ai/code-map.md` (names per part) and `grep -n`.

Workspace layout (M1, v0.60.1; plan `docs/ai/monorepo-plan.md`): root `package.json` declares npm workspaces `packages/*` and `apps/*` (`@aeterna/protocol`, `@aeterna/engine`, `@aeterna/web`; nothing to install).

Host port (M2, v0.82.0): `packages/protocol/src/00p-protocol.js` defines `io` (`io.view(record)`, `io.log(text)`, `io.decide(p, d)` for M3) and `bindHost(host)`. Engine parts draw nothing themselves: every board redraw, screen switch, deck refresh, match reset and match end is a serializable view record (`board`, `decks`, `screen {id}`, `reset`, `matchEnd {winner}`); the web host `apps/web/src/13e-host.js` answers them (render, switchView, game-over dialog, sounds per log line, page title). Engine and protocol parts use no `document` / `window`; only `localStorage` (try-wrapped) and `location.search` (`?sim=1`) remain. The human prompts (`ask`, `askBlock`, `askPayment`, `info`, `pickFromField`, ...) are still called directly on human-only paths: `WEB_GAPS` in `packages/engine/headless.mjs`, emptied by M3. `packages/engine/headless.mjs` runs the protocol + engine parts (`tools/build.mjs` `engineScript()`) in a `node:vm` context with no DOM: `playHeadless({seed, deckA, deckB})` plays CPU vs CPU to the end in ~0.1-0.5 s and gives the same log hash as the browser sim (tests H82).

| Parts | Role |
|---|---|
| `00p-protocol.js` (packages/protocol) | host port `io`, `bindHost`, view record types |
| `00-config.js` | steps, formats, ban list, seeded RNG, keyword glossary, small helpers |
| `01-cards.js`, `01a-card-pack.js`, `03-imported-cards.js` | `VERSION`, card database, pack codec, user-imported cards, tokens |
| `02a`-`02k` effects | effect engine (section 3) |
| `04-decks.js` | deck storage, validation, prebuilt decks |
| `05-state.js` | settings, game state `G`, `newPlayer`, `newGame`, redraw |
| `06-rules.js` | rule helpers: cores, levels, BP, Brave, tokens, symbols, costs, summon, Magic, Standby |
| `07-turn.js`, `08-battle.js` | turn flow (`matchLoop`, `beginTurn`, `endStep`, `win`, `isMainStep`, `checkInvariants`), battle, Flash timing, Bursts |
| `09-cpu.js`, `09a-cpu-eval.js` | CPU turn and evaluation policy (profiles, lethal check, attack/block scores) |
| `10-modals.js`, `11-human.js`, `12-zones.js` | promise-based modals, human actions, zone/log/rules views |
| `13-render.js`, `13a-deckbuilder.js`, `14-images.js` | board rendering (PC + phone layouts), lobby, deck builder, card images (IndexedDB) |
| `13e-host.js` (apps/web) | web host of the port: view records, sounds, game-over dialog, page title |
| `15-match.js` (engine), `16-events.js` (web) | match start (`startNewGame`, `matchSummary`), event delegation, replays, scenarios, test hooks `window.BS` |

## 2. Runtime
- **State:** one object `G` (players `G.p.player` / `G.p.opponent`, step, turn number, queues). Browser storage only for decks, imported cards, settings, history, images; the game makes no network calls and no `eval`. Imported card names and text are escaped in every `innerHTML` template; corrupt or blocked storage does not break start-up. Test-only stand-in cards (TST-*) live in `tests/fixtures/prototype_cards.js`, never in the shipped game (suite v24 asserts it).
- **Turn flow:** `matchLoop` -> `beginTurn` (Start, Core, Draw, Refresh steps; Standby released) -> human input or `cpuTurn` -> `endStep`. `win()` ends the match. Formats: Eternal and Standard step lists (`00-config.js`).
- **Randomness:** seeded RNG (`seedRng`, `rng`); every match keeps an input record, so `BS.runReplay(record)` reproduces it.
- **Rules source:** the official manuals; decisions and page references in `docs/manual-notes.md`, coverage in `docs/rules-coverage.md`, audit in `docs/reports/rules-audit.md`, per-mechanic records in `docs/mechanics/`.

In-game error catcher (v0.59.5, `apps/web/src/00b-errors.js`): window `error` / `unhandledrejection` -> notice `#err-notice` with "Copy report" (`errReport()`: message, stack, version, match turn/step and `replayOf(G)` record) and "Close"; the events are not cancelled (tests E595).

## 3. Effect engine (data-driven)
A card's `effects` list holds entries of **trigger** (`FX_TRIGGERS`) + **actions** (`FX_ACTIONS`) + **conditions** (`fxIf`, the `if` field) + options (`lv`, `once`, `optional`, `zone`, `oc`, ...). `parseEffects` / `parseBurst` read card data; `fxDescribe` renders the text. Strict effects (v0.59.4): an unknown trigger, action, condition or STATIC flag name at run time goes through `fxUnknown` (`02a-effects-base.js`): it throws in automated runs (`navigator.webdriver` or `?strict=1`) and warns once + skips in the release build (tests S594).

Resolution (`02d-effects-resolve.js`):
1. An event calls `fireFx` / `fireFxMulti`; `collectFx` gathers every matching effect on the field (plus Hand, Trash or Mirage for the triggers that look there).
2. `resolvePool` keeps the still-valid ones (`fxValid`: zone, level, once per turn, conditions, `fxCan`). The turn player's effects go first; a human turn player picks the order.
3. `runActions` runs the actions. Inside it the game counts as "resolving" (`asResolving`): effects it triggers queue in `G.derivedQ` and resolve right after it (`flushDerived`), before the effects still pending.
4. After each effect, Bursts resolve (`flushBursts`, after all non-Burst triggered effects of that event).
5. Immunity: `fxImmune(owner, target, acting effect)` with STATIC flags (`UNAFFECTED`, `HAND_UNAFFECTED`, Armor family) filters targets (`02k-effects-immunity.js`).

Other engine parts: `pay:true` summons, Grandwalker Nexuses that level by Count, Burst/Mirage slots, Soul State, Void, Count, Contract Advent, Manifest, Revive, Standby (`p.standby`, `releaseStandby`), Removed Zone (`02e`), mill/discard (`02f`), can't attack/block (`02g`), Magic effect types (`02h`), keyword effects High Speed / Crush / Holy Life (`02i`), Accel / Silver Wheel (`02j`). Glossary of every trigger/action/condition with its rule note: `data/glossary/effects.json`; workflow for a new mechanic: skill `bs-effect-mechanic-adder`.

## 4. Card data pipeline
```
data/sources/fandom-cards-bs01-bs77.json   raw Fandom export (not in the light clone)
data/index/saga_card_index.json            Saga/image index (import input)
        |  python3 tools/import_fandom.py
        v
data/import/saga-NN.json                   staging: every card (loads in the game, not yet playable)
        |  promote: tools/promote_import.py, or the compiler (section 5)
        v
data/cards/saga-NN.json                    playable cards (the only card JSON edited by hand)
        |  python3 tools/build_cards.py
        v
build/all-cards.json                       generated copy of the Saga files (not in git; tools/all_cards.mjs / tools/allcards.py write it when missing or stale)
        |  python3 tools/tag_effects.py -> data/glossary/card-tags.json, docs/reports/effect-coverage.md
        |  node tools/build.mjs
        v
pack embedded in index.html                (codec: packages/engine/src/01a-card-pack.js; size: node tools/pack_size.mjs)
```
Staging keeps every card; playable is the promoted subset, so the stages are not duplicates. Card data order of trust: the Fandom export in the repo, then the official list, then other sites, images last (`docs/ai/cards-and-rules.md`). Prebuilt decks: `data/decks/*.txt`. Card images are never shipped: players import their own (Library; matched by the `image` field, card ID or name, kept in IndexedDB). Saga placement (e.g. BS75 in Saga 16): `docs/saga-map.md`. New card: run `python3 tools/tag_effects.py`, wire the missing glossary pieces once in the engine, then express the card as data. Rule obligations (page, status, proving test): `data/kb/rule-obligations.json`.

## 5. Effect compiler
`python3 tools/compile_effects.py [--saga N] --review build/compile-review.md --out build/compiled.json` turns staged card text into effect entries by pattern; cards with any unmatched unit are listed in the review file with the reason. Compiler v2 (v0.61.0): `python3 tools/compile_v2.py [--saga N] --out build/compiled.json --report docs/reports/compile-v2-report.md` runs v1 first sentence by sentence (identical output, test C61-01), then a clause grammar (one selector noun phrase shared by destroy / exhaust / return / remove / BP minus / send cores, "Target X. Destroy it." pairs, `[LV1-2-3]` heads); its report lists the engine levers (filters the grammar reads but no action supports) and the cards whose only blocker is each reason; promote its output with `--v2`. `node tools/promote_compiled.mjs build/compiled.json` checks and promotes the compiled cards into `data/cards`. Progress: `python3 tools/unlock_report.py` -> `docs/reports/unlock-report.md` (`playable X / 8,041`); real unlocks of one lever: `python3 tools/lever_report.py` + a scratch recompile (tag counts are upper bounds).

What to build next (v0.69.1): `python3 tools/pack_plan.py` orders the compile_v2 blockers greedily by cards completed (`docs/reports/pack-plan.md`, upper bounds); `python3 tools/wiki_rules.py` caches the Fandom keyword and Comprehensive Rules pages in `build/` and maps blockers to their rule sections (`data/glossary/wiki-rules-map.json`, `docs/reports/wiki-rules-index.md`; skill `bs-wiki-rules`).

## 6. Tests
| Layer | Where | Run |
|---|---|---|
| Node unit + engine tests | `tests/unit/*.test.mjs` (quiet board via `BS.testSetup()`) | `npm test`; quick subset `npm run -s loop` |
| Property tests | `tests/unit/props.test.mjs` | `npm run test:props` |
| Generated action tests (v0.69.2) | `tests/unit/fx_generated_cases.test.mjs` + `tests/unit/lib/fx-props.mjs`: one quiet board per action of every shipped card with complete effects, built from the action JSON (synthetic `FXP-` fixtures); uncovered shapes listed by FX01 | `node --test tests/unit/fx_generated_cases.test.mjs` |
| Engine coverage ratchet (v0.106.0) | `tools/coverage.mjs`: V8 block coverage over ten seeded headless flows (both formats, every colour, a human seat) -> which **top-level function names** each engine part actually runs; floor in `tools/coverage-baseline.json` (raise, never lower), report `docs/reports/engine-coverage.md` | `npm run -s coverage`; `--check` in CI |
| Scenarios | `tests/scenarios/*.json`, loaded with `BS.loadScenario(spec)` | used by unit and Python tests |
| Python Playwright suites (UI flows, sims) | `tests/suites`, `tests/legacy` | `python3 tests/run_all.py --only <names>`; full run only on GitHub |
| Release file check | `tests/unit/release.test.mjs` | `RELEASE_FILE=... npm run -s test:release` |
| GitHub | `.github/workflows/ci.yml` (every push), `regression.yml` (dispatched once per session), `auto-mode.yml` | `docs/ai/release.md` |

Ratchet lists (`tests/unit/known-gaps.json`, the type baseline `tools/type-baseline.json`) only shrink. Types (M5): `tools/lint.mjs` runs the TypeScript checker on the build with `packages/engine/types.d.ts` (record shapes the engine names in JSDoc); engine and protocol parts have no checker errors, web parts may not exceed their baseline. Hooks (`.githooks/`): pre-push runs build check, lint, quick tests, `tools/check_renames.py` and the brand guard; commit-msg runs the brand guard.

Match fuzzer (v0.59.6): `node tools/fuzz.mjs [--runs N] [--seed S]` plays CPU-vs-CPU matches with random legal CPU choices (`BS.setFuzz`, `fuzzPick` in `09a-cpu-eval.js`, seeded game rng); a crash, invariant break or match that does not end is saved to `tests/fuzz-cases/`, replayed by `tests/unit/match_fuzzer.test.mjs` (CI only, not in the quick loop). Regression job `fuzz` (v0.59.8) plays 20 fuzzed matches per run, seeded by the run id; new failing cases come back as the run artifact `fuzz-cases`.

## 7. Session tooling
- `tools/session_start.sh`: overlap guard, hooks, baseline loop, version, Next line, playable count, open issues.
- `tools/session_gate.sh`: auto-mode switch and session lock (`check`, `lock`, `manual`, `switch`, `done`, `unlock`, `on`/`off`/`status`); rules in `docs/ai/next-session-prompt.md`.
- `tools/session_end_check.mjs`: game file, embedded version, release test, fresh mind map, backup branch.
- `tools/check_refs.mjs` (v0.106.0, runs in `tools/loop.mjs`): every `` `path` `` reference a living doc makes must resolve, or sit in `tools/check_refs-baseline.json`, which only shrinks.
- Mind map: `docs/roadmap-data.json` -> `node tools/gen_roadmap.mjs` -> `docs/roadmap.html`; `docs/progress.html` from the CLAUDE.md Roadmap, `docs/ai/roadmap-open.md` and `CHANGELOG.md`.
- `node tools/pack_ai.mjs [--docs|--full]`: packs the project into one Markdown file for another AI chat. `node tools/screens.mjs`: the README screenshots in `docs/images/` (removed from the README until v1.0, owner 2026-10-17).
- Skills in `.claude/skills/` (session runner, effect mechanic adder, Playwright tester, card data check, card verify, card image reader, doc convention).

## 8. Brand layer
Until v1.0 the public name is the neutral codename. `tools/brand_guard.mjs` (loop, hooks) blocks original names in public text; `python3 tools/brand.py --neutral|--restore|--check` switches whole strings using the mapping kept in the owner's private vault (not in this repo). Card names, card data, mechanic terms and source URLs are never changed.

## 9. Planned
The monorepo move (TypeScript workspace, server/client, database, online play) is planned in `docs/ai/monorepo-plan.md`; until it lands, the single built HTML file stays the product.

M7 step 1 (v0.106.0): the database half exists without touching the offline game. `db/migrations/0001_init.sql` holds accounts, deck slots, matches, match seats and match replays; `db/migrate.sh` is the only runner (append-only, checksum-guarded, one transaction per file); `docker/compose.yml` runs Postgres and the runner locally. `docs/DATA.md` documents the tables. The schema stores inputs and outcomes only - seed, decks, decisions and the log hash - so the engine stays authoritative and a stored match can be replayed to the same hash. Accounts, repositories, API routes and the CI service container are the next M7 step; nothing is hosted.

## Rules knowledge base (v0.68.0)
Rules KB: `docs/rules/kb.json` + `tools/rules_kb.py`, schema in `docs/rules/README.md` (official rule sections with ids, pages, paraphrases and SHA-256 fingerprints; `--list-cited` checks every engine citation, `--check` flags changed manual sections).
