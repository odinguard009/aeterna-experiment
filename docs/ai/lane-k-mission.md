# Lane K mission control (DeepSeek + Claude, one prompt)

Owner order, 2026-10-31: work Lane K for all cards (Standard block A first, then Eternal by Saga), one session at a time, alternating DeepSeek (DSH) and Claude. Release only at 50 new complete cards. Read this file before any Lane K session; the chat prompt only says "continue the Lane K mission".

- status: ON
- target: all cards (Standard block A first, then Eternal Saga 17 down; roadmap item L)
- last release: v0.200.0 (complete 1529)
- next release: v0.201.0 (complete 1579)
- cycle: 0/50 new complete cards since v0.200.0
- model routing: DSH V4.1 Flash + V4 Pro advisor for card-JSON bundles; Claude Sonnet/Opus for engine, schema and audit-heavy work. One provider at a time; the `session_gate.sh` MANUAL/LOCK mark is the lock.
- handoff (2026-10-31, DSH Flash session): released v0.200.0 (+50 complete, 1,529 of 8,709). This session finished the cycle's last 24 cards in 3-4 card bundles (`tests/unit/k_cards_4` … `k_cards_10`, 23 scenarios, schema 189-195: ALLY_NEXUS_DESTROYED, LIFE_UP, OPP_DIED, CORE_SAFE, EXTRA_SYMBOL, CORE_TO_ALLY, RETURN_SUBJECT, BP_MINUS.targets, pickPerLegacy/perBp, refreshedOnly, etc.). The main pre-push gate caught and this release fixed accumulated wip drift: the symLock guard broke turn-symbol tests (magma/Lava Fish, Rig Avatar), K-75 targeted a Camou card, the Swordish token test predated its completion, 26RBS01-X11 was missing its Amplify effect (audit_heads), data/import staging was rebuilt (I18/I30), test citations were pinned (K08) and compiler-wiring.md regenerated. Next bundle: Standard block A leftovers (S1_ALL_HAVE/M_REPLACEMENT/A_BANISH; the packet tool writes build/lane-k-packet.md). Blocked: 26RBS01-103, 26RBS03-079, 26RDB01-051, 26RBS03-044, 26RSD06-013, 26RSD06-011, 26RDB01-042 (engine pieces named in the v0.200.0 release notes). CI/Regression are async: Regression was dispatched at release and is not awaited; the next cycle must check it is green before a new 50-cycle.

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
- Deferred to a later bundle (all block A; needs the engine piece in brackets): 26RBS01-103 [treat-as-LV1 action + a "blocking with family X" condition], 26RBS03-079 [untargetable-by-opposing-Magic static + "Life can only be reduced by one" action], 26RDB01-051 [cost-substitution replacement], 26RBS03-044 [grant "When Blocks as When Attacks"], 26RSD06-013 [destroy-own-Nexus cost upgrade], 26RSD06-011 [per-LV attack tax], 26RDB01-042 [Flash summon this card from the Hand]. None failed twice; they are cost/priority deferrals, not errors.
