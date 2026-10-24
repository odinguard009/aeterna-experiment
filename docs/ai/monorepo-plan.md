# Monorepo plan: Aeterna online + offline (owner decision 2026-10-17)

Owner: "saya juga ingin membuat aeterna menjadi seperti itu" (Aegis: TypeScript monorepo, server/client split, Docker, Postgres) and "saya ingin repo kita bisa menjadi lebih rapi dan lebih baik dari aegis". Answers of 2026-10-17:
- **Product:** online PvP with a server **and** the offline single-file game vs CPU (PC + phone) stay.
- **Hosting:** none yet. Build and test the server and database code locally and in CI; deployment waits for the owner.
- **Order:** step by step, alternating: one migration session, then one card session (cards unlocked per token), Opus for all.

## Measured starting point (v0.59.1)
- 30 modules in `src/js` (~385 KB), concatenated by `tools/build.mjs` into `index.html`; tsc 6.0.3 and Node 22 are available in sessions; npm/pip registries are blocked in sessions (packages such as `ws`, `pg` or Colyseus can only be installed in GitHub Actions or on the owner's machine).
- Engine modules (`02*`-`09*`, `12`, `15`) touch the DOM almost never, but they call the UI directly: ~70 `render*()` calls, ~70 choice prompts (modal / ask / pick), ~200 `await`s. Human choices are awaited inside effect resolution.

## Design: what "better than Aegis" means here
1. **One engine, two hosts.** `packages/engine` is pure (no DOM, no globals, seeded RNG). It talks to the outside only through a port: `io.view(event)` (replaces `render*`), `io.decide(player, decision) -> Promise<answer>` (replaces modals and CPU picks), `io.log(entry)`. Offline host: the browser UI and the CPU answer the port. Online host: the server answers it by sending the decision to that seat and awaiting the reply. The async engine stays (no rewrite to a state machine); a decision is a typed, serializable record, so the server can time out, reconnect and replay.
2. **Two replay formats, like Aegis (corrected 2026-10-17 after the owner asked):** the **input record** (exists since v0.26: `G.rec`, `runReplay`; decks, seed, every answer) re-executes the engine to reproduce a match: bug reports, regression tests, server audit and reconnect. It depends on the engine version, so old records can drift after engine changes. The **viewer replay** (board snapshot per event) plays back in any later version without the engine: watch, step back and forth, share. The viewer replay is exported from an input record by re-running it in the version that recorded it; same files offline and online. Neither is needed for a match to run.
3. **Strict but documented.** Typed through `// @ts-check` + JSDoc first, `.ts` per module later, `tsc --noEmit` in CI. Comments stay allowed (Aegis forbids them); rules for where things live are checked by tools, not by memory: a docs link checker, an old-path checker, a "generated file is up to date" check, and the brand guard.
4. **One home per thing:** `AGENTS.md`-style short root rules (our `CLAUDE.md`), `docs/ARCHITECTURE.md`, `docs/mechanics/<mechanic>.md`, `docs/reports/` (generated), a README per package and per `tools/` group, `docs/DATA.md` (card pipeline and, later, database tables, like Aegis `COLLECTIONS.md`).

## Target layout
```
packages/
  engine/      rules, effects, turn, battle, CPU (pure; host port; seeded RNG; input records)
  cards/       card pack builder, compiler, card JSON access (from data/)
  protocol/    decision, event, intent and view types shared by server and clients
apps/
  web/         UI, deck builder, offline host; builds the single-file aeterna-vX.Y.Z.html and the online client
  server/      authoritative rooms (WebSocket), seat-filtered views, matchmaking; Postgres store (accounts, decks, replays)
data/          sources -> import (staging) -> cards (playable); unchanged pipeline
docker/        compose for local server + Postgres (dev only until hosting is chosen)
tools/         grouped by domain, README each; session_gate.sh / session_start.sh stay at tools/
docs/          ARCHITECTURE.md, DATA.md, mechanics/, reports/, ai/
tests/         unit + scenarios per package, browser tests for apps/web, CI-only server tests
```
npm workspaces (built into npm, no registry needed for local packages) instead of pnpm.

## Phases (each = one session, Opus; a card session follows each one; the full order with the quality bundles is in `roadmap-open.md` "Session order")
- **M0 = cleanup C1 + C2** (archived in `docs/ai/roadmap-archive.md`): architecture doc, doc index, doc-convention skill, docs tidy. v0.59.2-v0.59.3.
- **M1 Workspace skeleton (patch): done in v0.60.1** (`tools/src_parts.mjs`; engine = `00-config`, `01-cards`, `01a-card-pack`, `02*`-`09*`, `12`, `15`; web = `00b-errors`, `10`, `11`, `13`, `13a`, `14`, `16`). root `package.json` workspaces; move `src/js` modules into `packages/engine/src` and `apps/web/src` by the DOM/engine split above, still plain JS; `tools/build.mjs` reads the new paths. Gate: built `index.html` byte-identical to the pre-move build except the version line; all tests and Regression green. Replaces cleanup C3/C4 (tools and data move with the layout).
- **M2 Host port, part 1 (minor): done in v0.82.0** (`packages/protocol/src/00p-protocol.js`, web host `apps/web/src/13e-host.js`, `packages/engine/headless.mjs`, tests H82; `12-zones.js` moved to `apps/web`; 9 human prompts left in `WEB_GAPS` for M3). Plan was: define the port and decision/event records in `packages/protocol`; route every `render*` call in engine modules through `io.view`. Test: a headless run (no DOM) plays CPU vs CPU to the end in Node.
- **M3 Host port, part 2 (minor, 2 sessions; done: part 1 in v0.83.0, every human prompt as a decision record, `packages/engine/src/05b-decide.js`, tests H83; part 2 in v0.84.0, board actions as intents + `cpuAnswer` port answerer, `packages/engine/src/05c-intent.js`, tests I84; the offline CPU seat still decides inline):** route every human/CPU choice through `io.decide`; the CPU becomes a port answerer. Test: scripted answers reproduce scenario results; the offline game is unchanged (player-view check).
- **M4 Replays (minor; done in v0.85.0 + v0.86.0: port input record v2 + `runPortRecord` / headless `replayPort` / `viewerReplay`, `packages/engine/src/15b-replay.js`, tests R85; playback + Watch / Save / Open file in the match history, `apps/web/src/13f-replay.js`, tests V86):** input records go through the port (`decide` answers); viewer replay format (snapshot per `view` event) + exporter from an input record + a playback screen in `apps/web`; replay regression tests.
- **M5 Types (patches, alongside):** `@ts-check` + JSDoc per package, `tsc --noEmit` in CI and `npm run loop`; `.ts` conversion module by module once checks are clean. **Part 1 done in v0.101.0:** the parts are joined scripts, not modules, so the checker runs on the joined build (`tools/lint.mjs`, already in loop, pre-push and CI) with `packages/engine/types.d.ts`; every checker error now counts against `tools/type-baseline.json` per part (engine + protocol 0, web 74, down from 179). Next steps, bundled with later U/I sessions: web parts to 0 (casts for `querySelector` results and `e.target`, 64 of the 74), then `--noImplicitAny` for the engine with the same ratchet, then `.ts` per module after M6 needs it.
- **M6 Server (minor):** `apps/server` with rooms, seat-filtered views (hidden hand/deck), decision timeouts, reconnect; uses Node built-ins where possible; dependencies installed only in CI; CI test plays two scripted clients to the end. No deployment.
- **M7 Database + Docker (minor):** Postgres schema and migrations (accounts, decks, replays), `docs/DATA.md` tables, `docker/compose.yml` for local runs; CI service container for tests. Hosting stays the owner's decision.
- **L1 UI languages (DEFERRED by the owner 2026-10-21, UI stays English; was: minor, after M4; owner 2026-10-17):** string table in `apps/web`, then Japanese, Thai, Chinese, further languages by market; details in `roadmap-open.md` "Session order" item 9.
- **M8 Online client (minor):** lobby, room join, play through the server in `apps/web`; offline mode untouched.
- **Online decisions (owner, 2026-10-21, chat):** "Siapa yang main online: ... Publik." / "Perlu akun dan login, atau cukup buat room, bagikan kode? Saya ingin keduanya seperti aegis, coba pelajari." No paid server for now. Read in Aegis (`vinicius3333/aegis-digimon-tcg` at `d7dadc1`, 2026-10-20; ideas only, no code taken):
  - Play modes: quick match against a live opponent, a private room joined by a short code (`POST /room/lookup` resolves the code to the room; the host's rules apply to the guest), and vs bot. Guests (no account) may play casual and private rooms; ranked and tournaments need an account. Spectators join by code.
  - Accounts: Discord OAuth plus email sign-in by a one-use magic link (15 min; the GET only shows a button and the POST spends the token, because mail scanners open links; per-IP and per-address request limits; Cloudflare Turnstile against bots). Session cookie; a signed-in client gets a single-use room ticket to join a room under its account. Accounts keep preferences, match history and replays.
  - Stack: Colyseus rooms (WebSocket, seat-filtered state) + Postgres; Redis only when several processes share matchmaking; self-hosted with Docker on one VPS.
  - Applied to our plan: **M6** server = rooms with quick match, private room codes and vs-bot seats, guests allowed, seat-filtered views from our `io` port (no Colyseus needed; Node built-ins + one WebSocket library), single process (no Redis). **M7** = accounts (Discord OAuth and email magic link, both optional for casual play), decks, match history and replays (our port records) in Postgres; ranked later. **M8** = lobby (quick match, private room code, vs CPU offline) and account panel in `apps/web`; the offline single file stays untouched.
  - Hosting (owner 2026-10-24, chose Cloudflare; details in `docs/ai/online-hosting.md`): Cloudflare Pages serves the static single file (unlimited bandwidth, free); the online server moves to Cloudflare Workers + Durable Objects (WebSocket rooms) + D1 (SQLite) or Postgres via Hyperdrive — the persistence layer is decided in the M8 porting session. A domain and the email sender stay the owner's decision; nothing is deployed by a session.

## Additions from the roadmap audit (owner, 2026-10-21)
- **M6, one engine per room:** `loadEngine()` in `packages/engine/headless.mjs` already gives each match its own `node:vm` context (the engine keeps global state such as `G`); M6 uses one context per room and adds a test that measures memory and start time per room (target: written down before choosing a room limit).
- **M6, CPU seats on the server:** the server's vs-bot seat answers through the port (`cpuAnswer`); the offline CPU seat that still decides inline (M3 note, v0.84.0) moves to the port first, behaviour unchanged (sims and Regression must match).
- **M6, hidden cards never leave the server:** the test from the card-image plan (step 5) moves here: a seat-filtered view never contains a hidden card's ID (opposing hand, deck, face-down Burst), checked on the wire.
- **M6 / M7 time:** npm packages (WebSocket, Postgres client) install only in GitHub Actions, so these sessions wait on CI for every server test; plan them as longer sessions and keep the pure parts (rooms, views, timeouts) testable without packages.
- **Owner decisions before any deployment (not before building):** privacy policy and terms (accounts keep emails), card names and card images on a public server (the card-images feature is no longer gated off until v1.0, owner 2026-10-24), hosting (decided: Cloudflare, owner 2026-10-24), domain, email sender. Sessions write these down; none of them blocks M6-M8 code.

## Rules for every phase
- Offline game behaviour never changes in a migration step; the player-view check runs after M1, M2, M3, M8.
- Backup branch before M1, M2, M3 and M6.
- Paths fetched from outside a clone stay put (`tools/session_gate.sh`, `tools/session_start.sh`); the scheduled task prompt depends on them.
- The brand guard covers the new folders; neutral names only until v1.0.
- Anything that costs money or publishes a server is not done by a session; it is written down for the owner.
