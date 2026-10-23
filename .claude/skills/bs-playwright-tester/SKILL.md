---
name: "bs-playwright-tester"
description: "Use when testing or hunting hidden bugs in the Aeterna HTML game with Playwright, CPU-vs-CPU sims and window.BS hooks."
---

# Aeterna tester (v0.30+)

Repo: odinguard009/aeterna-experiment. `index.html` is BUILT from `packages/` and `apps/web/` (`node tools/build.mjs`); never edit it by hand. CLAUDE.md loads automatically: do not re-read it. Release copies go to `/mnt/user-data/outputs/aeterna-vX.Y.Z.html`.

## Two test layers (cheapest first)
1. **Node layer** (`tests/unit/*.test.mjs`, `node --test`, headless Chromium, nothing to install):
   - `npm run test:quick` (~2-5 s): build/layout, card data, engine helpers on a quiet board.
   - `npm run test:props` (~80 s): seeded CPU-vs-CPU properties (match ends, invariants, no page errors, winner by Life 0 / deck-out, determinism, replay).
   - `npm run -s loop` = build, lint, smoke tests + the test files changed on the branch (~15 s); `-- --full` = every quick test (~3 min, run by the pre-push hook).
   - `npm test` = quick + props: CI runs it on every push; run it locally only to reproduce a CI failure.
2. **Python Playwright regression** (`tests/run_all.py`): UI flows and the historic suites (legacy fx, scen60, mag, burst, hid, std, fmt, deep). `python3 tests/make_fixtures.py` once per session, then only `--only <suites>` for the UI flows the change touches. No local full run and no local 30-game sims: the final Regression is dispatched on GitHub (`docs/ai/release.md`, `token-economy.md` section 3). Dispatch only when `bash tools/regression_due.sh` says DUE (it picks 10 or 30 sims); a weekly scheduled run covers the rest.

## Writing new tests
- Prefer Node engine tests: `quietBoard()` from `tests/unit/lib/game.mjs`, then `page.evaluate(() => { BS.testSetup(); ... })`. testSetup empties both Hands: set `p.deckSize = p.deck.length` before `BS.checkInvariants()`; after manual setups keep `p.made` / `deckSize` / the single Soul Core consistent (take cores with `BS.takeFromVoid`).
- Property tests: `forAll(name, runs, fn)` / `caseSeeds` from `tests/unit/lib/prop.mjs`; `simMatch(seed, {mode:'white'|'mirror'})` plays one seeded match. A failure prints the seed: reproduce with `PROP_ONLY=<seed> npm run test:props` or `BS.startNewGame({seed})`. Do not rerun dozens of sims to chase a bug.
- Ratchet lists in `tests/unit/known-gaps.json` may only shrink.
- Python suites for UI flows: `tests/suites/vNN_tests.py` (numbered `chk()`), add to `NO_FIXTURES` when it must run without TST cards.

## What to look for each build
Engine (triggers, actions, conditions, once, optional human prompt, validation rejects); card JSON import (known rejects only, e.g. Brave until supported); CPU-vs-CPU across formats (Eternal, Standard block A): exceptions, stuck turns, negative counters, infinite loops; hidden issues after Burst, Magic, Nexus removal, empty deck, Soul State; screenshots only when the UI changed.

## Setup and pitfalls
- Chromium is preinstalled; never run `playwright install`; npm/pip registries are blocked in the cloud workspace.
- Run property matches sequentially: several pages in parallel in one headless Chromium stall on the 2-CPU workspace.
- `page.evaluate` of an async call can hang: append `;1` or return a value.
- Do not pipe long runs through `tail` with a short timeout; write output to a file.
- `?sim=1` = CPU vs CPU; `window.BS` exposes the hooks (testSetup, mkInst, lvIndex, effCost, takeFromVoid, checkInvariants, startNewGame, runReplay, lastReplay, loadScenario, fireFx, parseEffects, staticBp, FX_ACTIONS, removeNexus, ...).
- Effect name filters are case-insensitive substring matches; use cards that really match (Crimson: BS75-002, Meteorwurm: BS76-X01).
- Layout: test both viewports (PC `layout-pc`, phone `layout-mobile`). The phone UI must not change when fixing PC.

## Bugs
File real bugs as GitHub Issues (`gh api repos/odinguard009/aeterna-experiment/issues -f title=... -f body=...`, REST only) with the seed or replay, label `bug`. Record failures honestly, with the failing scenario, before fixing. Report briefly to the user in Indonesian; test code and logs in English.