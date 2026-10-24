# Aeterna tests

Two layers: fast Node tests in `unit/` (`npm test`, see `docs/ARCHITECTURE.md` section 6) and the Playwright (Python) regression below, which is the release gate.

Playwright (Python) tests that drive the single-file game through `window.BS`.

- `run_all.py` runs everything with a short summary (only failing lines): `python3 tests/run_all.py` (full), `--only by_doing,mitra` (selected suites), `--part 1|2|3|legacy|sims` (one part per 10-minute call), `--sims N`. Results go to `tests/last-run.json`.
- `make_fixtures.py` recreates `/mnt/user-data/outputs/wip.html`, the white/red card JSON in `/tmp/claude-0/fixtures` and the `mitra_tests.py` helper copy that several suites `exec()`. Run it once per session before the regression.
- `suites/` current suites (one numbered `chk()` per test). Suites are named by topic (renamed from `v15`…`v29` in v0.96.0: `hand_life_revive`, `contract_field`, `pack_decks_settings`, `match_meta`, `red_mechanics`, `magic_main_flash`, `burst_mirage`, `grandwalker_level`, `grandwalker_void`, `cleanup_review`, `grandwalker_core_effects`, `seed_replay`, `card_image_strips`, `by_doing_trigger_loop`, `void_supply_rules`); `mitra_tests`, `advent_tests` and the card-effect ones above cover the card effects; `play_ui` and `import_all` cover the UI and card import; `mitra_sims.py` and `red_cpu_sims.py` run CPU-vs-CPU games.
- `scenarios/` named boards (JSON) for tests, loaded with `BS.loadScenario(spec)`; the cards they create are available as `window.SC.<alias>`. Name the file after the behaviour it sets up (the `name` field must match the file name).
- Replays: `BS.lastReplay()` gives the record of the current/last match, `BS.runReplay(record)` replays it (`seed_replay_tests.py` drives a scripted human through the real UI and replays it).
- `legacy/` the first-generation regression suites (`effect_scenarios`, `scenario_prompts`, `magic_flow`, `burst_layout`, `hscroll_layout`, `standard_steps`, `deck_formats`, `modal_pick_flow`; named by topic since v0.96.0).
- `fixtures/prototype_cards.js` test-only stand-in cards (TST-*) that older suites use. They are **not** part of the shipped game. `sitecustomize.py` injects them after every `page.goto()`; run with `PYTHONPATH=tests` (copy the fixture next to it, see below). `cleanup_review_tests.py` must run **without** the fixtures because it asserts the shipped game contains no TST cards.
- Tests expect the game file at `/mnt/user-data/outputs/wip.html` (a fresh copy of `index.html` with the default format set back to Eternal: the product default is Standard since v0.97.0, and the suites were written for Eternal rules; Node tests do the same through `GAME_URL` in `tests/unit/lib/game.mjs`, and `PRODUCT_URL` / `quietBoard(true)` opens the real default) and some suites read JSON fixtures from `/tmp/claude-0/fixtures`; adjust the paths at the top of each file for your machine.

Usage example:

    python3 tests/make_fixtures.py          # wip.html copy + the JSON/helper files the older suites read
    PYTHONPATH=tests python3 tests/suites/grandwalker_void_tests.py
    python3 tests/suites/cleanup_review_tests.py        # no fixtures

Legacy notes: `legacy/*.py` load `/mnt/user-data/outputs/aeterna-v0.11.1.html`; copy the build there to run them. (the two legacy helper scripts `imp` and `sizes` were removed on 2026-10-19: one needed files outside the repo, the other only printed sizes; card import is covered by `suites/import_all.py`.)
