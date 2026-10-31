# Lane K mission control (DeepSeek + Claude, one prompt)

Owner order, 2026-10-31: work Lane K for all cards (Standard block A first, then Eternal by Saga), one session at a time, alternating DeepSeek (DSH) and Claude. Release only at 50 new complete cards. Read this file before any Lane K session; the chat prompt only says "continue the Lane K mission".

- status: ON
- target: all cards (Standard block A first, then Eternal Saga 17 down; roadmap item L)
- last release: v0.199.0 (complete 1,479)
- next release: v0.200.0 (complete 1,529)
- cycle: 26/50 new complete cards since v0.199.0
- model routing: DSH V4.1 Flash + V4 Pro advisor for card-JSON bundles; Claude Sonnet/Opus for engine, schema and audit-heavy work. One provider at a time; the `session_gate.sh` MANUAL/LOCK mark is the lock.
- handoff (2026-10-31): mission tools installed, no card work done. The observed normal session took 17 minutes for 1 card (13 minutes of startup, model-policy/context notes). CI and Regression are async from now on. wip is 26/50.

## One session step: one bundle of 3-4 cards
1. `bash tools/lane_k_guard.sh` - fetch, clean tree, gate, status.
2. `node tools/lane_k_packet.mjs` - writes `build/lane-k-packet.md` with the cards, texts, residual tags, rule notes and existing tests.
3. Write the scenario/test first for a new engine mechanic; wire a missing glossary tag once in the engine, then express the cards as data.
4. `npm run -s loop`; commit the bundle (not per card); `git push origin HEAD:wip/lane-k`.
5. At 50 new complete cards: write `build/lane-k-release-notes.md` (bullets: what changed first, then limits), then `bash tools/lane_k_release.sh`. It pushes `main` and dispatches Regression without waiting.
6. Before stopping (quota, end of session): update the handoff line above, leave the next bundle in the packet, and run `bash tools/session_gate.sh done ...` or `unlock`. Push `wip/lane-k` first.

## Rules that do not change
- Release only at 50 new complete cards; early only for a schema/rule risk, commits older than 24 h, or an owner order.
- CI and Regression stay on. Do not wait for them: at the start of each 50-cycle check the previous release exists and the newest Regression is green; fix a red one first.
- Keep the quality gates: `npm run -s loop`, `node tools/fx_validate.mjs`, the false-complete sample, CI and Regression, the type baseline. A card that fails twice is dropped, recorded here as blocked, and named in the release notes.
- Never edit `index.html`, `build/` or generated reports by hand; `node tools/build.mjs` owns them.
- One session at a time. Never start while the gate reports a running session.

## Blocked
- (none)
