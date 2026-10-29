// v0.41.2: BS74-BS76 data compared with the Fandom export (issue #5). No browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const cards = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));
const by = id => cards.find(c => c.id === id);
const GOD = { 'BS74-043': { white: 2 }, 'BS74-045': { white: 2 }, 'BS74-047': { white: 1 }, 'BS75-004': { red: 1 }, 'BS75-009': { red: 2 }, 'BS75-010': { red: 2 },
  'BS75-012': { red: 3 }, 'BS75-013': { red: 3 }, 'BS75-X02': { red: 3 }, 'BS76-006': { red: 2 }, 'BS76-009': { red: 4 }, 'BS76-060': { red: 1 } };

for (const [id, rest] of Object.entries(GOD)) {
  test(`${id} reduction is the god symbol plus ${JSON.stringify(rest)} (no blue)`, () => {
    assert.deepEqual(by(id).reduction, { ...rest, god: 1 });
  });
}
test('BS76-005 Lv3 needs 5 cores (Fandom)', () => assert.deepEqual(by('BS76-005').levels.map(l => l.cores), [1, 2, 5]));
test('BS76-006 Lv3 needs 4 cores (Fandom)', () => assert.deepEqual(by('BS76-006').levels.map(l => l.cores), [1, 2, 4]));
test('BS75-041 has the Devotee family (Fandom)', () => assert.ok(by('BS75-041').families.includes('Devotee')));
// v0.186.0 (R1): the official card page (1000 / 4000) now wins over the Fandom export (2000) for BS75-001 levels.
test('BS75-001 Lv1 BP is 1000 (official card page, R1; Fandom says 2000)', () => assert.equal(by('BS75-001').levels[0].bp, 1000));
// issue #5 (v0.48.2): conflicts settled in favour of the Fandom export (owner priority, 2026-10-16); Fandom gold icon = our Ultimate key
const FANDOM_RED = { 'BS75-063': { red: 2 }, 'BS75-075': { red: 1, white: 1 }, 'BS75-076': { red: 3, ultimate: 1 }, 'BS75-082': { yellow: 2, god: 1 }, 'BS76-079': {} };
for (const [id, r] of Object.entries(FANDOM_RED)) test(`${id} reduction follows the Fandom export ${JSON.stringify(r)}`, () => assert.deepEqual(by(id).reduction, r));
test('BS74-CX01 family is Vulrica (Fandom)', () => assert.deepEqual(by('BS74-CX01').families, ['Grandwalker', 'Vulrica']));
test('the cost 0 cards are confirmed by Fandom, not data errors', () => {
  for (const id of ['BS75-001', 'BS75-002', 'BS76-001']) assert.equal(by(id).cost, 0, id);
});
test('no BS74-BS76 Spirit has a blue reduction unless the card is blue', () => {
  for (const c of cards.filter(x => /^BS7[456]-/.test(x.id) && x.reduction && x.reduction.blue)) assert.equal(c.color, 'blue', c.id);
});
test('god reduction never exceeds the card cost', () => {
  for (const c of cards.filter(x => x.reduction && x.reduction.god)) assert.ok(c.reduction.god <= c.cost, c.id);
});
test('BS74-BS76 cost, god reduction and level cores agree with the Fandom export (skipped without data/sources)', { skip: !existsSync(join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json')) }, () => {
  const F = Object.fromEntries(JSON.parse(readFileSync(join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json'), 'utf8')).cards.map(r => [r.id, r]));
  const known = new Set(['BS75-001', 'BS75-063', 'BS75-075', 'BS75-076', 'BS75-079', 'BS75-082', 'BS76-079']);   // recorded differences
  for (const c of cards.filter(x => /^BS7[456]-/.test(x.id) && F[x.id] && !known.has(x.id))) {
    const r = F[c.id];
    assert.equal(c.cost, r.cost, `${c.id} cost`);
    assert.equal(c.reduction.god || 0, r.reduction.god || 0, `${c.id} god`);
    if (c.type === 'Spirit') assert.deepEqual(c.levels.map(l => l.cores), r.levels.map(l => l.cores), `${c.id} cores`);
  }
});
