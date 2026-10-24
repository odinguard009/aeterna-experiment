// v0.106.0 (roadmap M7 step 2): the server's persistence contract. The memory store is the
// reference implementation, so it is tested here without a database; store-pg.mjs answers the
// same calls over Postgres and runs in the CI job that has a service container.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';
import { memoryStore, checkAccount, checkDeckSlot, checkMatch, FORMATS, SEATS, SLOT_RANGE } from '../../apps/server/src/store.mjs';

const ACC = { id: '11111111-1111-4111-8111-111111111111', email: 'odin@example.com', displayName: 'Odin' };
const GUEST = { id: '22222222-2222-4222-8222-222222222222', discordId: '987654321', displayName: 'Guest' };
const DECK = { 'BS75-001': 3, 'BS75-002': 2 };
const match = (over = {}) => ({
  id: '33333333-3333-4333-8333-333333333333', roomCode: 'ABC123', format: 'standard', seed: 7,
  deckA: DECK, deckB: { 'BS74-038': 3 }, build: '0.106.0', winner: 'player', turns: 9,
  seats: [{ seat: 'player', accountId: ACC.id, displayName: 'Odin' }, { seat: 'opponent', displayName: 'CPU', isBot: true }],
  replay: { record: { v: 2, seed: 7, decisions: [] }, logHash: 'deadbeef' }, ...over,
});

test('SV01 an account needs a reachable login, a display name and a unique email', async () => {
  const s = memoryStore();
  assert.deepEqual(await s.accounts.create(ACC), { ...ACC, discordId: null });
  assert.equal((await s.accounts.byLogin({ email: ACC.email })).id, ACC.id);
  assert.equal((await s.accounts.byLogin({ discordId: 'nope' })), null);
  await assert.rejects(() => s.accounts.create({ ...ACC, id: GUEST.id }), /email already registered/);
  await assert.rejects(() => s.accounts.create({ id: GUEST.id, displayName: 'No login' }), /needs an email or a discordId/);
  assert.deepEqual(await s.accounts.create(GUEST), { ...GUEST, email: null });
  assert.equal((await s.accounts.byLogin({ discordId: GUEST.discordId })).id, GUEST.id);
});

test('SV02 a deck slot is keyed by (account, slot) and keeps its look and Key Spirit', async () => {
  const s = memoryStore();
  await s.accounts.create(ACC);
  const base = { accountId: ACC.id, slot: 1, name: 'Red', format: 'standard', cards: DECK, keyCard: 'BS75-001', sleeve: { tint: 'jade' } };
  await s.decks.put({ ...base, id: '44444444-4444-4444-8444-444444444444' });
  await s.decks.put({ ...base, id: '55555555-5555-4555-8555-555555555555', name: 'Red v2' });     // same slot: replace, as the UNIQUE key says
  const list = await s.decks.list(ACC.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Red v2');
  assert.deepEqual(list[0].sleeve, { tint: 'jade' });
  assert.equal(list[0].keyCard, 'BS75-001');
  await assert.rejects(() => s.decks.put({ ...base, id: 'g' .repeat(9), slot: SLOT_RANGE.max + 1 }), /slot number/);
  await assert.rejects(() => s.decks.put({ ...base, id: '66666666-6666-4666-8666-666666666666', accountId: GUEST.id }), /account does not exist/);
});

test('SV03 a match stores its inputs, both seats and the replay; the replay keeps its hash', async () => {
  const s = memoryStore();
  await s.accounts.create(ACC);
  const m = await s.matches.record(match());
  assert.equal(m.format, 'standard');
  assert.equal(m.seats.length, 2);
  assert.deepEqual(await s.matches.replay(m.id), { record: { v: 2, seed: 7, decisions: [] }, logHash: 'deadbeef' });
  assert.equal((await s.matches.replay('99999999-9999-4999-8999-999999999999')), null);
  const list = await s.matches.listOf(ACC.id);
  assert.equal(list.length, 1);
  assert.equal((await s.matches.listOf(GUEST.id)).length, 0, 'a guest seat has no account history');
  await assert.rejects(() => s.matches.record(match()), /already recorded/);
  await assert.rejects(() => s.matches.record(match({ id: '77777777-7777-4777-8777-777777777777', seats: match().seats.slice(0, 1) })), /exactly two seats/);
  await assert.rejects(() => s.matches.record(match({ id: '88888888-8888-4888-8888-888888888888', seats: [{ seat: 'player', displayName: 'x' }, { seat: 'player', displayName: 'y' }] })), /distinct/);
});

test('SV04 the memory store is not a laxer contract than the migration CHECKs', () => {
  const sql = readFileSync(join(ROOT, 'db/migrations/0001_init.sql'), 'utf8');
  // formats / seats / slot range / name lengths appear in the SQL as literals; the store must agree
  const fmt = /format\s+text[^,]*CHECK \(format IN \(([^)]*)\)\)/i.exec(sql);
  assert.ok(fmt, 'the migration lost its format CHECK');
  assert.deepEqual(fmt[1].match(/'(\w+)'/g).map((s) => s.replace(/'/g, '')), FORMATS);
  const seat = /seat\s+text[^,]*CHECK \(seat IN \(([^)]*)\)\)/i.exec(sql);
  assert.ok(seat, 'the migration lost its seat CHECK');
  assert.deepEqual(seat[1].match(/'(\w+)'/g).map((s) => s.replace(/'/g, '')), SEATS);
  const slot = /slot\s+smallint NOT NULL CHECK \(slot BETWEEN (\d+) AND (\d+)\)/i.exec(sql);
  assert.ok(slot, 'the migration lost its slot CHECK');
  assert.deepEqual([Number(slot[1]), Number(slot[2])], [SLOT_RANGE.min, SLOT_RANGE.max]);
  for (const n of [40, 60]) assert.ok(new RegExp(`length\\((display_name|name)\\) BETWEEN 1 AND ${n}`).test(sql));
  // every table and column the two implementations touch exists in the schema
  const pg = readFileSync(join(ROOT, 'apps/server/src/store-pg.mjs'), 'utf8');
  for (const t of ['accounts', 'deck_slots', 'matches', 'match_seats', 'match_replays']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t} `), `${t} is missing from the migration`);
    assert.match(pg, new RegExp(`(FROM|INTO|JOIN)\\s+${t}\\b`), `${t} is never used by store-pg.mjs`);
  }
});

test('SV05 the shape checks reject the same things the SQL would, with a readable message', () => {
  assert.throws(() => checkAccount({ id: 'x', email: 'a@b.c', displayName: 'n' }), /uuid/);
  assert.throws(() => checkAccount({ ...ACC, email: 'not-an-address' }), /not an address/);
  assert.throws(() => checkAccount({ ...ACC, displayName: '' }), /1-40 characters/);
  assert.throws(() => checkDeckSlot({ id: ACC.id, accountId: ACC.id, slot: 1, name: 'x', format: 'modern', cards: {} }), /format/);
  assert.throws(() => checkDeckSlot({ id: ACC.id, accountId: ACC.id, slot: 1, name: 'x', format: 'eternal', cards: { 'BS75-001': 4 } }), /copies must be 1-3/);
  assert.throws(() => checkMatch(match({ seed: 0 })), /seed/);
  assert.throws(() => checkMatch(match({ deckB: null })), /both decks/);
  assert.throws(() => checkMatch(match({ replay: { record: null, logHash: 'x' } })), /port record/);
  assert.doesNotThrow(() => checkMatch(match({ winner: null, turns: 0 })));
});
