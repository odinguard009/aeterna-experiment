# Release and tests (read when releasing or adding tests)

## Tests
- Tests guard behaviour, not a count (owner, 2026-10-19; the 20+/50+ quotas are gone): one test per new action, condition or trigger head, one per promoted card group and one per fixed bug; a promoted card whose actions all have a generator in `tests/unit/lib/fx-props.mjs` (test FX02, v0.69.2) needs no hand-written action test, only the read against its text; docs-only changes need none. Prefer Node tests in `tests/unit/` (quiet board via `BS.testSetup()`, see `engine.test.mjs`); Python suites `tests/suites/vNN_tests.py` only for UI flows (add to `NO_FIXTURES` in `tests/run_all.py` when they must run without TST cards).
- Ratchet lists in `tests/unit/known-gaps.json` only shrink.
- While working: `npm run -s loop` (build + lint + brand guard + smoke tests + test files changed on the branch, ~15 s, one call); touched Python suites only: `python3 tests/make_fixtures.py` once, then `python3 tests/run_all.py --only <names>`.
- UI text changed (zone names, modal or pill text): `grep -rln '<old word>' tests` and run those Python suites locally with `--only` before pushing. `check_renames.py` catches removed multi-word text, but not single-word substring checks such as `'Banished' in modal(pg)` (the v0.50.0 Regression failure).
- Pitfalls: `page.evaluate` of an async call hangs (append `;1`); no parallel Playwright pages locally; never `playwright install`.

## Gate
- Local: `npm run -s loop` green per task. The pre-push hook (`git config core.hooksPath .githooks`, once per clone) is the one full local gate per push: build check, lint, brand guard, `tools/check_renames.py`, every quick test (~3 min). No local `npm test` / `test:props`: CI runs `npm test` (incl. props) on every push to `main`.
- **CPU benchmark** (v0.102.0): the Regression job `cpu-bench` runs `node tools/cpu_bench.mjs --check` (240 Standard CPU-vs-CPU matches, ~2-3 min): `FAIL` (more errors or timeouts) fails the job, `WARN` (more passive turns, longer games, a style losing win rate) is a warning the next session reads. Rewrite the baseline (`--write`, `docs/reports/cpu-bench.json` + `.md`) only when the CPU or the Standard decks changed on purpose and say why in the commit.
- GitHub: every push runs **CI** (build check, lint, Node tests). **Regression** (Python parts 1-3, legacy, 30 sims, plus the Node job `fuzz`: 20 fuzzed matches seeded by the run id, all in parallel) is started at the end of the session **only when due** (owner, 2026-10-19): `bash tools/regression_due.sh` prints `DUE sims=N (reason)` when the newest run was not green, 3+ releases passed since the commit it ran on, or a core engine file changed (turn, battle, rules, state, zones, match, CPU, effect base/parse/resolve: 30 sims, otherwise 10); then `gh api -X POST repos/odinguard009/aeterna-experiment/actions/workflows/regression.yml/dispatches -f ref=main -f 'inputs[sims]=N'`. `SKIP` = no dispatch. A weekly scheduled run (Sunday 03:17 WIB, 30 sims + 20 fuzz) is the safety net; a tag pushed by the user also starts it (pushing tags and creating refs are blocked by the session proxy). **Do not wait for it** (owner, 2026-10-18): the next session's `session_start.sh` prints the newest Regression result; a `failure` there is fixed first, before any new work (read only the failing lines: `gh run view <id> --log-failed | grep -E "BAD|FAIL|Error" | head -20`), and a run still `in_progress` is checked again before that session's own push. Record real failures honestly in the release notes of the fixing version. A `fuzz` failure names mode + seed in its annotations; the case JSON is the run artifact `fuzz-cases` (`gh run download <run id> -n fuzz-cases -D tests/fuzz-cases`): commit it (test F596 replays it) and fix it first, before new work.

## Routine
1. `packages/` / `apps/web/` changes; bump `VERSION` (`packages/engine/src/01-cards.js`) and `package.json` `version`. Card data: `data/cards/saga-*.json` -> `python3 tools/build_cards.py` -> `python3 tools/tag_effects.py` -> `node tools/build.mjs` (also refreshes `docs/ai/code-map.md`).
2. Tests as above.
3. Docs: `CHANGELOG.md` release notes under a new `## vX.Y.Z` heading at the top (bullets, only what changed; the first bullet's bold text becomes the release title; `node tools/build.mjs --check` fails while the newest heading is not `VERSION`), `docs/rules-coverage.md`, `docs/reports/effect-coverage.md`, glossary `rule` notes, `python3 tools/check_obligations.py`.
4. Commit (`Fixes #N`), push after every commit, start Regression when due (above, not awaited) -> CI green -> copy `index.html` to `/mnt/user-data/outputs/aeterna-vX.Y.Z.html` and `aeterna.html` -> `RELEASE_FILE=/mnt/user-data/outputs/aeterna-vX.Y.Z.html npm run -s test:release` (opens the delivered file on PC and phone screens and starts a match) -> the Release workflow (after CI on `main`) creates release `vX.Y.Z` with `aeterna-vX.Y.Z.html` attached (`tools/make_releases.sh`; check it with one `gh api .../releases/tags/vX.Y.Z` call) -> SendUserFile the game file (and `docs/roadmap.html` when `node tools/mindmap_due.mjs` says due: every 3rd release or a plan change) -> short Indonesian update (no Project docs: the Project holds none; everything lives in the repo) -> stop; the next "Lanjutkan roadmap" is a new session.

## Docs travel with the release (owner, 2026-10-20)
Generated docs (unlock report, pack plan with measured yield, mechanic inventory, mind map) are produced by `bash tools/release_docs.sh` before the push and amended into the last task commit: one commit and one pre-push run per release instead of a separate `docs:` commit. Docs-only pushes start no CI either way (paths-ignore), so this saves calls and tokens, not Actions minutes.

## Triggers in this repository (v0.106.0)

Pushes to `main` do **not** start a workflow run here. Verified on 2026-10-24: a clean push
(`94bbf9f..b1ede8d`) produced no run within a minute, and the whole run history of the repository is
`workflow_dispatch` - no `push`, `pull_request`, `schedule` or `workflow_run` run has ever been
recorded. The workflow files, the token scopes (`repo`, `workflow`) and the repository's Actions
setting (`enabled`, `allowed_actions: all`) are all correct, so the cause sits above the repository
(account or GitHub App level) and is not something a session can change.

What the session does instead, so nothing depends on the broken trigger:

- **one command does the release tail** (`tools/release.sh`, v0.107.0): `bash tools/release.sh <version>`
  dispatches CI, waits for it to turn green, then creates the release via `tools/make_releases.sh`
  (idempotent - skips versions that already exist - and fails loudly when CI is red). Run it after the
  version bump + CHANGELOG + roadmap are committed and pushed; on a memory-tight Codespace push with
  `BS_TEST_CONC=1 git push` so the pre-push quick tests run serially;
- `workflow_run` does not fire either (measured: the `Release` workflow did not start after a green CI
  on `8441d3d`), so `release.yml`'s relaxed condition and CI's nightly `schedule` are forward-looking
  settings, not something a session may rely on. They cost nothing and start working the day the
  account-level cause is fixed; until then the session is the trigger;
- CI also runs nightly at 19:23 UTC, so `main` is verified even in a week with no session;
- `Regression` stays a manual dispatch (`tools/regression_due.sh` decides), and `v0.106.0` widened
  its "core engine" rule to every `packages/engine` and `packages/protocol` source.
