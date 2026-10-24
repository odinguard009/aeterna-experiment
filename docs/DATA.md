# Data: the card pipeline and the database

Two data stories live here. The card pipeline is how a printed card becomes game data (that half
is summarised from `ARCHITECTURE.md` section 4). The database is roadmap M7: what the server keeps
about accounts, decks, matches and replays. Neither changes the offline single file.

## 1. Card pipeline (built, not stored)

```
data/sources/fandom-cards-*.json   raw export        (not in the light clone)
data/index/saga_card_index.json    Saga/image index
data/import/saga-NN.json           staged: every card loads, not every card is playable
data/cards/saga-NN.json            playable cards; the only card JSON edited by hand
build/all-cards.json               generated copy (not in git)
pack embedded in index.html        the shipped card pack
```

Nothing about cards is duplicated in the database: the server sends card **ids**, and the client
resolves them against the pack it already has. Card images are player-supplied and never leave the
device (`apps/web/src/14-images.js`, IndexedDB).

## 2. Database (M7 step 1)

Postgres 16. Schema: `db/migrations/0001_init.sql`. Runner: `db/migrate.sh`. Local run:
`docker/compose.yml`. Conventions:

- **Ids are uuid v4 chosen by the server**, so no extension is needed and a match can be recorded
  while the network is flaky.
- **Timestamps** are `timestamptz` in UTC (`now()`), never local time.
- **Card and deck payloads are `jsonb`** in exactly the shape the engine already uses, so a record
  written by the server can be replayed by the offline client without a translation layer.
- **A migration is append-only.** An applied file must keep its checksum (the runner refuses
  otherwise) and no migration may drop or truncate data; a mistake gets a new migration. This is
  the reversible-first rule of the working agreement applied to the schema.

| Table | Holds | Key columns | Written by | Read by |
|---|---|---|---|---|
| `accounts` | A player account, optional (guests may play) | `id`, `email` or `discord_id` (unique, at least one), `display_name` | the server on first login | login, the lobby |
| `deck_slots` | The server-side twin of the local deck slots | `(account_id, slot)`, `format`, `cards` (id -> copies), `key_card`, `sleeve` | the deck editor when signed in | deck list, match start |
| `matches` | One played match | `format`, `seed`, `deck_a`, `deck_b`, `key_a`, `key_b`, `build`, `winner`, `turns` | the room host when a match ends | match history, bench marks |
| `match_seats` | One row per seat, guest-friendly | `(match_id, seat)`, `account_id` (nullable), `display_name`, `is_bot` | the room host at match start | history, per-account records |
| `match_replays` | The replay of a match | `match_id`, `record` (port record v2), `log_hash` | the room host when a match ends | the replay viewer, the fuzz/Regression checks |
| `login_tokens` | A magic link, single use | `token_hash` (pk, sha256 of the token), `account_id`, `expires_at`, `used_at` | `apps/server/src/accounts.mjs` on `requestLogin` | the same module on `consumeLogin` |
| `sessions` | A logged-in session | `token_hash` (pk, sha256 of the cookie value), `account_id`, `expires_at` | `accounts.mjs` after a redeemed link | `accountFromCookie` on every request |

Why these and not more: the engine is authoritative for rules, so the database stores inputs
(seed, decks, decisions) and the outcome, never derived game state. That keeps a schema change
cheap and makes a stored match auditable: replaying `record` must reproduce `log_hash`.

Not stored on purpose: card text and card data (they ship with the game), card images (player
supplied), passwords (login is Discord OAuth or an emailed magic link), and any per-turn state.

## 3. State of M7

Done in v0.106.0 (step 1): the schema, the append-only runner, the local compose file, these tables.

Done in step 2 (`apps/server/src/store.mjs`, `store-pg.mjs`): the persistence **contract** and two
implementations of it. `memoryStore()` is the reference (pure JS, no package, used by tests and by a
server without a database); `pgStore()` answers the same calls over the schema, importing `pg`
lazily so nothing else needs the package. The validation in `store.mjs` mirrors the migration's
CHECK constraints on purpose, and `tests/unit/server_store.test.mjs` fails if the two lists drift
(SV04). CI job `db` brings up Postgres, runs `db/migrate.sh` twice (it must be idempotent) and runs
`tests/unit/server_store_pg.test.mjs`, which skips itself when `DATABASE_URL` is absent - so the
live half only ever runs where a server exists.

Done in step 3 (`db/migrations/0002_sessions.sql`, `apps/server/src/accounts.mjs`): magic-link login
and sessions, with no password and no external service. The token is 32 random bytes and only its
sha256 reaches the database, so a dump is not a set of working links; a login token is single use
(the store's `takeLogin` marks it used atomically, so two clicks cannot both log in) and lives 15
minutes; the session is a separate token in an `HttpOnly; SameSite=Lax` cookie for 30 days, `Secure`
unless the server runs on plain http locally. The clock and the store are injected, which is what
lets AA01-AA08 check expiry without sleeping.

Done in step 4 (`apps/server/src/http.mjs`, tests API01-API06): the HTTP API over the store and the
accounts service, a tiny `node:http` router with no new dependency. `/health`, `POST /api/login`
(asks for a one-time link; without a mailer it returns the link so a local run can follow it),
`GET /api/login?t=` (redeems the link, sets the session cookie, redirects to `/`), `/api/me`,
`POST /api/logout`, and the two session-scoped library routes `GET /api/decks` and `GET /api/matches`.
The account id is never read from a query string or a body - only from the session cookie, which is
what API06 pins. The link path is an option on `accounts()`, so the router's `/api/login` and the
mail are always the same route.

Still owed:

- Discord OAuth as a second way in (the account table already carries `discord_id`).
- Wire the WebSocket room server (`apps/server/src/run.mjs`) to the store, so a finished room writes
  its match and replay instead of dropping them.
- `docker/compose.yml` for the server itself once there is a server image to run.
