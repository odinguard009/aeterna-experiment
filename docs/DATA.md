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

Why these and not more: the engine is authoritative for rules, so the database stores inputs
(seed, decks, decisions) and the outcome, never derived game state. That keeps a schema change
cheap and makes a stored match auditable: replaying `record` must reproduce `log_hash`.

Not stored on purpose: card text and card data (they ship with the game), card images (player
supplied), passwords (login is Discord OAuth or an emailed magic link), and any per-turn state.

## 3. What a session still owes M7

- Accounts: Discord OAuth and email magic links, sessions and cookies.
- Repositories in `apps/server` (the plan keeps the rules out of the server), plus the API routes.
- A CI job with a Postgres service container that runs the migrations and the repository tests.
- `docker/compose.yml` for the server itself once there is a server image to run.
