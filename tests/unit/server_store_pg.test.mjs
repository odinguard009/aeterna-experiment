// v0.106.0 (roadmap M7 step 2): the Postgres binding of the store. This is the live half of the
// database work - it needs a server, so it skips unless DATABASE_URL is set (the CI job `db` runs
// db/migrate.sh against a service container first) and the `pg` package is installed there only.
// The same contract as the memory store (tests/unit/server_store.test.mjs), so the two cannot drift
// without one of the two suites noticing.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { memoryStore } from '../../apps/server/src/store.mjs';

const URL = process.env.DATABASE_URL || '';
const SKIP = URL ? false : 'no DATABASE_URL (the db CI job provides one; the memory store covers the contract locally)';

let store = null;
async function pg() {
  if (store) return store;
  const { pgStore } = await import('../../apps/server/src/store-pg.mjs');
  store = await pgStore({ connectionString: URL });
  return store;
}
after(async () => { if (store && store.close) await store.close(); });

// Unique ids per run, so a re-run against the same database never collides.
const ids = [];
const uid = () => { const v = randomUUID(); ids.push(v); return v; };
const DECK = { 'BS75-001': 3, 'BS75-002': 2 };

test('SP01 accounts: create, log in by email or discord id, unique contact', { skip: SKIP }, async () => {
  const s = await pg();
  const email = `odin-${uid().slice(0, 8)}@example.com`, discordId = '9' + uid().replace(/-/g, '').slice(0, 9);
  const a = await s.accounts.create({ id: uid(), email, displayName: 'Odin PG' });
  assert.equal(a.email, email);
  assert.equal((await s.accounts.byLogin({ email })).id, a.id);
  assert.equal(await s.accounts.byLogin({ email: `nobody-${email}` }), null);
  const b = await s.accounts.create({ id: uid(), discordId, displayName: 'Guest PG' });
  assert.equal((await s.accounts.byLogin({ discordId })).id, b.id);
  await assert.rejects(() => s.accounts.create({ id: uid(), email, displayName: 'Dup' }), /duplicate key|already registered/);
  assert.equal((await s.accounts.get(a.id)).displayName, 'Odin PG');
});

test('SP02 deck slots are one row per (account, slot) and survive a re-save', { skip: SKIP }, async () => {
  const s = await pg();
  const acc = await s.accounts.create({ id: uid(), email: `deck-${uid().slice(0, 8)}@example.com`, displayName: 'Deck PG' });
  const base = { accountId: acc.id, slot: 2, name: 'Red', format: 'standard', cards: DECK, keyCard: 'BS75-001', sleeve: { tint: 'jade' } };
  const first = await s.decks.put({ ...base, id: uid() });
  const again = await s.decks.put({ ...base, id: uid(), name: 'Red v2' });
  assert.equal(again.slot, 2);
  const list = await s.decks.list(acc.id);
  assert.equal(list.length, 1, 'the UNIQUE (account_id, slot) key keeps one live slot');
  assert.equal(list[0].name, 'Red v2');
  assert.deepEqual(list[0].sleeve, { tint: 'jade' });
  assert.equal(list[0].id, first.id, 'the upsert updates the existing row, it does not replace its id');
});

test('SP03 a match, its seats and its replay are recorded in one transaction', { skip: SKIP }, async () => {
  const s = await pg();
  const acc = await s.accounts.create({ id: uid(), email: `match-${uid().slice(0, 8)}@example.com`, displayName: 'Match PG' });
  const id = uid();
  const m = {
    id, roomCode: 'PG' + id.slice(0, 4), format: 'standard', seed: 11, deckA: DECK, deckB: { 'BS74-038': 3 },
    build: '0.106.0', winner: 'opponent', turns: 12,
    seats: [{ seat: 'player', accountId: acc.id, displayName: 'Match PG' }, { seat: 'opponent', displayName: 'CPU', isBot: true }],
    replay: { record: { v: 2, seed: 11, decisions: [] }, logHash: 'feedface' }
  };
  await s.matches.record(m);
  const back = await s.matches.get(id);
  assert.equal(back.format, 'standard');
  assert.equal(back.turns, 12);
  assert.equal(back.seats.length, 2);
  assert.equal(back.seats.find((x) => x.seat === 'opponent').isBot, true);
  assert.deepEqual(await s.matches.replay(id), { record: { v: 2, seed: 11, decisions: [] }, logHash: 'feedface' });
  const hist = await s.matches.listOf(acc.id, { limit: 5 });
  assert.ok(hist.some((h) => h.id === id), 'the match shows in the seat history');
  assert.equal(await s.matches.replay(uid()), null);
  await assert.rejects(() => s.matches.record({ ...m }), /duplicate key|already recorded/);
});

test('SP04 the Postgres store answers what the memory store answers (same contract)', { skip: SKIP }, async () => {
  const s = await pg(), mem = memoryStore();
  const email = `parity-${uid().slice(0, 8)}@example.com`;
  const shape = { id: uid(), email, displayName: 'Parity' };
  const a1 = await s.accounts.create({ ...shape });
  const a2 = await mem.accounts.create({ ...shape });
  assert.deepEqual(Object.keys(a1).sort(), Object.keys(a2).sort(), 'both stores return the same account fields');
  const d = { id: uid(), accountId: a1.id, slot: 1, name: 'P', format: 'eternal', cards: DECK, keyCard: null, sleeve: null };
  const d1 = await s.decks.put({ ...d });
  const d2 = await mem.decks.put({ ...d, accountId: a2.id });
  assert.deepEqual(Object.keys(d1).sort(), Object.keys(d2).sort());
});
