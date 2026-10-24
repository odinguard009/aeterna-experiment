/* ---------------------------------------------------------------------
   STORE, Postgres binding (roadmap M7 step 2)

   The same calls as memoryStore() in store.mjs, against the schema in
   db/migrations/0001_init.sql. `pg` is imported lazily and only here, so the
   rest of the server (and every test that does not set DATABASE_URL) never
   needs the package installed - the plan keeps npm installs in CI.

   Two rules that keep this thin:
     * the checks of store.mjs run first, so a bad call fails with the same
       message on both implementations (the SQL CHECKs stay as the last word);
     * writes of one match (the row, its two seats and the replay) are one
       transaction, so a half-recorded match cannot exist.
   --------------------------------------------------------------------- */
import { checkAccount, checkDeckSlot, checkMatch } from './store.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Load `pg` on first use with an error that says what to do. */
async function loadPg() {
  try { return await import('pg'); } catch (e) {
    throw new Error("store-pg: the 'pg' package is not installed (npm install --no-save pg); the memory store needs no package");
  }
}

/**
 * @param {{ connectionString?: string, ssl?: boolean|object }} opts
 * @returns the store contract of store.mjs
 */
export async function pgStore({ connectionString = process.env.DATABASE_URL, ssl = false } = {}) {
  if (!connectionString) throw new Error('store-pg: no connection string (set DATABASE_URL or pass connectionString)');
  const { Pool } = await loadPg();
  const pool = new Pool({ connectionString, ssl });
  const q = (text, params) => pool.query(text, params);
  const tx = async (fn) => {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const out = await fn((t, p) => c.query(t, p)); await c.query('COMMIT'); return out; }
    catch (e) { try { await c.query('ROLLBACK'); } catch (x) { /* the connection is gone */ } throw e; }
    finally { c.release(); }
  };
  const row = (r) => (r.rows.length ? r.rows[0] : null);
  const account = (r) => (r ? { id: r.id, email: r.email, discordId: r.discord_id, displayName: r.display_name } : null);
  const slot = (r) => ({ id: r.id, accountId: r.account_id, slot: r.slot, name: r.name, format: r.format, cards: r.cards, keyCard: r.key_card, sleeve: r.sleeve });

  return {
    kind: 'postgres',
    /** Close the pool (the server calls this on shutdown; tests call it in after()). */
    async close() { await pool.end(); },
    accounts: {
      async create(a) {
        const acc = { email: null, discordId: null, ...checkAccount(a) };
        const r = await q(`INSERT INTO accounts (id, email, discord_id, display_name) VALUES ($1,$2,$3,$4)
                           RETURNING id, email, discord_id, display_name`, [acc.id, acc.email, acc.discordId, acc.displayName]);
        return account(row(r));
      },
      async byLogin({ email = null, discordId = null } = {}) {
        if (!email && !discordId) return null;
        const r = await q(`SELECT id, email, discord_id, display_name FROM accounts
                           WHERE ($1::text IS NOT NULL AND email = $1::text) OR ($2::text IS NOT NULL AND discord_id = $2::text) LIMIT 1`, [email, discordId]);
        return account(row(r));
      },
      async get(id) {
        const r = await q('SELECT id, email, discord_id, display_name FROM accounts WHERE id = $1', [id]);
        return account(row(r));
      },
    },
    decks: {
      async put(d) {
        const s = { keyCard: null, sleeve: null, ...checkDeckSlot(d) };
        // one live row per (account, slot): the UNIQUE key plus an upsert keeps slot semantics
        const r = await q(`INSERT INTO deck_slots (id, account_id, slot, name, format, cards, key_card, sleeve)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                           ON CONFLICT (account_id, slot) DO UPDATE
                             SET name = EXCLUDED.name, format = EXCLUDED.format, cards = EXCLUDED.cards,
                                 key_card = EXCLUDED.key_card, sleeve = EXCLUDED.sleeve, updated_at = now()
                           RETURNING id, account_id, slot, name, format, cards, key_card, sleeve`,
          [s.id, s.accountId, s.slot, s.name, s.format, s.cards, s.keyCard, s.sleeve]);
        return slot(row(r));
      },
      async list(accountId) {
        const r = await q('SELECT id, account_id, slot, name, format, cards, key_card, sleeve FROM deck_slots WHERE account_id = $1 ORDER BY slot', [accountId]);
        return r.rows.map(slot);
      },
    },
    matches: {
      async record(m) {
        const match = checkMatch(m);
        return tx(async (t) => {
          await t(`INSERT INTO matches (id, room_code, format, seed, deck_a, deck_b, key_a, key_b, build, winner, turns)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [match.id, match.roomCode || null, match.format, match.seed, match.deckA, match.deckB, match.keyA || null, match.keyB || null, match.build, match.winner || null, match.turns == null ? null : match.turns]);
          for (const s of match.seats) {
            await t('INSERT INTO match_seats (match_id, seat, account_id, display_name, is_bot) VALUES ($1,$2,$3,$4,$5)',
              [match.id, s.seat, s.accountId || null, s.displayName, s.isBot === true]);
          }
          if (match.replay) await t('INSERT INTO match_replays (match_id, record, log_hash) VALUES ($1,$2,$3)', [match.id, match.replay.record, match.replay.logHash]);
          return clone(match);
        });
      },
      async get(id) {
        const r = await q(`SELECT m.id, m.room_code, m.format, m.seed, m.deck_a, m.deck_b, m.key_a, m.key_b, m.build, m.winner, m.turns,
                                  COALESCE(json_agg(json_build_object('seat', s.seat, 'accountId', s.account_id, 'displayName', s.display_name, 'isBot', s.is_bot)) FILTER (WHERE s.seat IS NOT NULL), '[]') AS seats
                           FROM matches m LEFT JOIN match_seats s ON s.match_id = m.id WHERE m.id = $1 GROUP BY m.id`, [id]);
        if (!r.rows.length) return null;
        const x = r.rows[0];
        return { id: x.id, roomCode: x.room_code, format: x.format, seed: x.seed, deckA: x.deck_a, deckB: x.deck_b, keyA: x.key_a, keyB: x.key_b, build: x.build, winner: x.winner, turns: x.turns, seats: x.seats };
      },
      async listOf(accountId, { limit = 20 } = {}) {
        const n = Math.max(1, Math.min(100, limit));
        const r = await q(`SELECT m.id, m.format, m.seed, m.build, m.winner, m.turns, m.started_at, m.ended_at
                           FROM matches m JOIN match_seats s ON s.match_id = m.id
                           WHERE s.account_id = $1 ORDER BY m.started_at DESC LIMIT $2`, [accountId, n]);
        return r.rows;
      },
      async replay(id) {
        const r = await q('SELECT record, log_hash FROM match_replays WHERE match_id = $1', [id]);
        if (!r.rows.length) return null;
        return { record: r.rows[0].record, logHash: r.rows[0].log_hash };
      },
    },
  };
}
