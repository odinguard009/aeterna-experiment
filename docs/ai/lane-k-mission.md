# Lane K mission control (DeepSeek + Claude, one prompt)

Owner order, 2026-10-31: work Lane K for all cards (Standard block A first, then Eternal by Saga), one session at a time, alternating DeepSeek (DSH) and Claude. Release only at 50 new complete cards. Read this file before any Lane K session; the chat prompt only says "continue the Lane K mission".

- status: ON
- target: all cards (Standard block A first, then Eternal Saga 17 down; roadmap item L)
- last release: v0.200.0 (complete 1529)
- next release: v0.201.0 (complete 1579)
- cycle: 11/50 new complete cards since v0.200.0
- model routing: DSH V4.1 Flash + V4 Pro advisor for card-JSON bundles; Claude Sonnet/Opus for engine, schema and audit-heavy work. One provider at a time; the `session_gate.sh` MANUAL/LOCK mark is the lock.
- handoff (2026-10-31, DSH Flash, cycle-2 continuation): v0.200.0 is released; this continuation added 11 complete cards in three pushed bundles on wip/lane-k (complete 1,529 -> 1,540): 4dfd4e0 LIFE_CAP_ONE/CORE_ANY_FROM_ALLY/BP_MINUS.perTrash/OPP_CORES.costLe (+4), 6697f98 card field handCost/EXHAUST_EITHER/oppRefreshedLe/REVEAL_PICK.soulBonus (+3), 17fd002 Shamanism lite: viaShaman mark, shamanReduction, NO_BLOCK_SHAMAN/BP_VIA_SHAMAN/NO_ATTACK_ONE_CORE, card.mechanics keyword read (+4; schema 204). Tests: k_cards_11..k_cards_13 + 11 scenarios; loop/fx_validate/card_verify green on each bundle.
- BLOCKER for the next continuation: another workstream is editing the SAME checkout uncommitted (ready-decks feature: packages/engine/src/04-decks.js, apps/web/src/13h-decks.js, apps/web/index.template.html, tests/unit/ready_decks.test.mjs and data/decks/ready-*.txt). Its half-finished state makes the repo-wide loop/lint fail (deck type errors, ready-deck test expectations) whenever it is present; this session had to stash that work twice to validate and push its own commits, then restore it. Do not commit those files into Lane K commits; wait for that workstream to commit, or isolate it the same way before a release.
- Blocked cards for the next bundle (block A): 26RBS01-103 and 26RBS01-123 (Magirrate keyword rules are not defined anywhere; no card carries a Magirrate family/mechanics), 26RDB01-051 (cost substitution), 26RBS03-044 (granted "When Blocks as When Attacks"), 26RSD06-013 (destroy-own-Nexus cost upgrade), 26RSD06-011 (per-LV attack tax), 26RDB01-042 (Flash summon from the Hand). Next candidates after those: 26RBS03-017 done, 26RBS02-083 (replacement effect) and 26RBS02-073 (multi-Nexus exhaust / Nexus-as-Spirit with fixed BP) need a replacement/Nexus-spirit engine piece; the packet tool writes build/lane-k-packet.md.

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
