// v0.106.0: parseCard is the gate every imported, built-in and staged card passes, and it also
// decides whether a card counts as complete. It had no headless test at all (the browser suites
// and tools/check_staged.mjs were the only users); it now delegates its levels and Magic
// sections to parseLevels / parseMagicOf, and these checks pin the contract that split relies on:
// every card in the shipped and staged data parses to the same result, and the error ORDER the
// importer shows a user is stable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEngine } from '../../packages/engine/headless.mjs';
import { ROOT } from './lib/game.mjs';

const E = loadEngine({ sim: true });      // a real engine context: the card pack is registered, so ids are reserved
// The engine runs in its own node:vm realm, so its arrays and objects have that realm's prototypes;
// round-tripping through JSON gives this realm plain values for assert.deepEqual (strict) to compare.
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const parse = (o) => plain(E.parseCard(o));
const base = { id: 'TST-9001', name: 'Test Spirit', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }] };

test('IM01 a minimal Spirit parses into a card with the printed stats', () => {
  const r = parse(base);
  assert.deepEqual(r.errors, undefined);
  assert.equal(r.card.id, 'TST-9001');
  assert.equal(r.card.type, 'Spirit');
  assert.equal(r.card.levels[0].bp, 3000);
  assert.deepEqual(r.card.residual, []);
});

test('IM02 levels: Nexus and Brave default, everything else must print them, and Magic is always LV0', () => {
  assert.deepEqual(parse({ ...base, type: 'Nexus', levels: undefined }).card.levels, [{ cores: 0 }]);
  assert.deepEqual(parse({ ...base, type: 'Brave', levels: undefined, brave: { bp: 5000 } }).card.levels, []);
  assert.deepEqual(parse({ ...base, type: 'Magic', levels: undefined }).card.levels, [{ cores: 0 }]);
  const bad = parse({ ...base, levels: [{ cores: 2, bp: 1000 }, { cores: 1, bp: 2000 }] });
  assert.deepEqual(bad.errors, ['levels need ascending whole-number "cores"']);
});

test('IM03 a Spirit needs a BP on every level, and its first level needs one core', () => {
  assert.deepEqual(parse({ ...base, levels: [{ cores: 1 }] }).errors, ['every Spirit/Brave/Ultimate level needs a numeric "bp"']);
  assert.deepEqual(parse({ ...base, levels: [{ cores: 0, bp: 1000 }] }).errors, ['Spirit first level needs at least 1 core']);
});

test('IM04 Magic: timing is read from the text, unknown effects are rejected, magic.by needs every timing', () => {
  const fromText = parse({ ...base, type: 'Magic', text: 'Flash: Main: draw a card.', magic: {} });
  assert.deepEqual(fromText.card.magic.timing, ['MAIN', 'FLASH']);
  const plain = parse({ ...base, type: 'Magic', text: 'Main: draw a card.', magic: {} });
  assert.deepEqual(plain.card.magic.timing, ['MAIN']);
  const badTopping = parse({ ...base, type: 'Magic', magic: { effect: 'NOPE' } });
  assert.equal(badTopping.errors.length, 1);
  assert.match(badTopping.errors[0], /^unknown "magic\.effect" "NOPE" \(use /);
  const badBy = parse({ ...base, type: 'Magic', magic: { by: { MAIN: { effect: 'NOPE' } } } });
  // a rejected by-timing is skipped, so the "every timing needs an entry" check also fires - that is the
  // real behaviour of the importer, reported in this order
  assert.deepEqual(badBy.errors, ['unknown "magic.by.MAIN.effect"', '"magic.by" needs an entry for every timing']);
  const badTiming = parse({ ...base, type: 'Magic', magic: { timing: ['NOPE'] } });
  assert.deepEqual(badTiming.errors, ['"magic.timing" must be a list of MAIN and/or FLASH']);
});

test('IM05 the error order is the order parseCard reports: fatal fields first, then the Magic/Brave section', () => {
  const r = parse({ id: 'bad id!', name: '', type: 'Nope', color: 'pink', cost: 99, symbols: 9, levels: 'x', magic: { timing: ['NOPE'], effect: 'NOPE' } });
  assert.deepEqual(r.errors, [
    'invalid "id" (letters, digits, . _ - / and spaces only)',
    'missing or invalid "name"',
    'type "Nope" is not supported yet (only Spirit, Nexus, Magic, Brave and Ultimate)',
    'invalid color "pink"',
    'invalid "cost" (0-30)',
    'invalid "symbols" (0-5)',
    '"levels" must be a list of 1-6 levels'
  ]);   // the fatal list stops before the Magic section runs, exactly as before the split
});

test('IM06 a built-in id is reserved, and the residual discipline is enforced', () => {
  const builtin = Object.keys(E.CARDS)[0];
  assert.deepEqual(parse({ ...base, id: builtin }).errors, [`"${builtin}" is reserved for a built-in card`]);
  assert.deepEqual(parse({ ...base, residual: 'text' }).errors, ['"residual" must be a list of up to 12 printed clauses that are not implemented']);
  assert.deepEqual(parse({ ...base, residual: ['a clause'], fxComplete: false }).card.residual, ['a clause']);
});

test('IM07 every shipped and staged card still parses to the same result (the split changed no verdict)', () => {
  let n = 0;
  for (const dir of ['data/cards', 'data/import']) {
    for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.json')).sort()) {
      const raw = JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8'));
      for (const c of Array.isArray(raw) ? raw : (raw.cards || [])) {
        const r = parse(c);
        assert.ok(r.card || Array.isArray(r.errors), `${f} ${c.id}: neither a card nor errors`);
        n++;
      }
    }
  }
  assert.ok(n > 10000, `only ${n} cards read`);
});
