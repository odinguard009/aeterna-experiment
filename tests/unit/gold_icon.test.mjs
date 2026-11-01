// Official reduction check (owner order 2026-11-01: official card database first). No browser.
// The official field `reductionIcons` counts the `極` icon, which the engine stores as `ultimate`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const COLORS = ['red', 'blue', 'white', 'green', 'purple', 'yellow'];
const read = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const staged = readdirSync(join(ROOT, 'data/import')).filter(f => /^saga-\d+\.json$/.test(f))
  .flatMap(f => { const d = read(`data/import/${f}`); return Array.isArray(d) ? d : d.cards; });
const curated = read('build/all-cards.json');
const OFFICIAL = join(ROOT, 'data/sources/official-fields.json');
const official = existsSync(OFFICIAL) ? read('data/sources/official-fields.json') : null;

test('no card data carries a raw "gold" reduction key', () => {
  for (const c of staged.concat(curated)) assert.ok(!('gold' in (c.reduction || {})), c.id);
});
test('reduction keys are colours, ultimate or god (the official fields supply both special icons)', () => {
  for (const c of staged.concat(curated)) for (const k of Object.keys(c.reduction || {})) assert.ok(COLORS.includes(k) || k === 'ultimate' || k === 'god', `${c.id} ${k}`);
});
test('the four cards named in the roadmap carry their Ultimate reduction symbols (BS74-X14 promoted to the game data in v0.46.0)', () => {
  const by = Object.fromEntries(staged.concat(curated).map(c => [c.id, c]));
  assert.deepEqual([by['BS74-X14'], by['BS75-016'], by['BS75-077'], by['BS75-X04']].map(c => c.reduction.ultimate), [1, 1, 1, 2]);
});
test('staged ultimate count equals the official 極 icon count (skipped without official fields)', { skip: !official }, () => {
  for (const c of staged) {
    const o = official[c.id];
    if (!o) continue;
    const n = (o.reductionIcons || []).filter(x => x === '極').length;
    assert.equal((c.reduction || {}).ultimate || 0, n, c.id);
  }
});
