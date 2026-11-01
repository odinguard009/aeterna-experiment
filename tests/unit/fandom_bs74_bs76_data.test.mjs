// BS74-BS76 data compared with the official card database (data/sources/official-fields.json). No browser.
// Owner order 2026-11-01: the official site is the first source for card numbers; the Fandom export is only
// the English text source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const cards = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));
const OFFICIAL = join(ROOT, 'data/sources/official-fields.json');
const official = existsSync(OFFICIAL) ? JSON.parse(readFileSync(OFFICIAL, 'utf8')) : null;
const bs74 = cards.filter(c => /^BS7[456]-/.test(c.id));

test('god reduction never exceeds the card cost', () => {
  for (const c of bs74.filter(x => x.reduction && x.reduction.god)) assert.ok(c.reduction.god <= c.cost, c.id);
});
test('BS74-BS76 cost, god reduction and Spirit levels agree with the official card database', { skip: !official }, () => {
  for (const c of bs74) {
    const o = official[c.id];
    if (!o) continue;
    if (o.cost !== null && o.cost !== undefined) assert.equal(c.cost, o.cost, `${c.id} cost`);
    const god = (o.reductionIcons || []).filter(x => x === '神').length;
    assert.equal(c.reduction.god || 0, god, `${c.id} god reduction`);
    const levels = o.levels || [];
    if (c.type === 'Spirit' && levels.length && levels.every(l => Array.isArray(l) && l.length === 2 && l.every(Number.isInteger))) {
      assert.deepEqual(c.levels.map(l => l.cores), levels.map(l => l[1]), `${c.id} level cores`);
    }
  }
});
