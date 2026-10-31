// v0.201.0 owner request: the ready-made list holds only official Battle Spirits recipes: the ten Standard starters and the
// official deck-feature ready decks of the Standard sets (battlespirits.com "Deck Feature", feature/structure/<set>/deck_0N.php).
// The hand-made colour / Contract decks are internal fixtures now (hidden, not listed anywhere); their recipes stay for the
// engine tests and CPU sims (v0.162.0 rule).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { quietBoard, closeBrowser, ROOT } from './lib/game.mjs';

let page, errors;
const ev = (fn, arg) => page.evaluate(fn, arg);
before(async () => { ({ page, errors } = await quietBoard(true)); });
after(async () => { await closeBrowser(); });

// data/decks/ready-<id>-<slug>.txt: one deck per file, the id is the PREBUILT id
const files = () => readdirSync(join(ROOT, 'data/decks')).filter(f => /^ready-(rbs|rcb|rdb)\d\d-\d-/.test(f)).sort().map(f => {
  const id = /^ready-((?:rbs|rcb|rdb)\d\d-\d)-/.exec(f)[1], rec = {};
  for (const l of readFileSync(join(ROOT, 'data/decks', f), 'utf8').split('\n')) { const m = /^\s*(\d+)\s+(\S+)/.exec(l); if (m) rec[m[2]] = (rec[m[2]] || 0) + Number(m[1]); }
  return { f, id, rec };
});

test('RD-1 the 26 official ready decks are in PREBUILT with their published recipe and source URL', async () => {
  const fs = files(); assert.equal(fs.length, 26);
  const got = await ev(() => BS.PREBUILT.filter(d => d.kind === 'ready').map(d => ({ id: d.id, name: d.name, recipe: d.recipe, source: d.source, key: d.key, format: d.format, hidden: !!d.hidden })));
  assert.deepEqual(got.map(d => d.id), fs.map(f => f.id));
  for (const [i, d] of got.entries()) {
    assert.deepEqual(d.recipe, fs[i].rec, fs[i].f);
    assert.equal(d.format, 'standard'); assert.equal(d.hidden, false);
    assert.match(d.source, /^https:\/\/www\.battlespirits\.com\/feature\/structure\/[0-9A-Za-z]+\/deck_\d\d\.php$/);
    assert.match(d.name, /\((26RBS01|26RBS02|26RBS03|26RCB01|26RDB01)\)$/);
  }
});

test('RD-2 the published recipes are 40 cards, except the two pages that publish 41 / 37 cards', async () => {
  const r = await ev(() => BS.PREBUILT.filter(d => d.kind === 'ready').map(d => [d.id, Object.values(d.recipe).reduce((a, b) => a + b, 0)]));
  const odd = r.filter(x => x[1] !== 40);
  assert.deepEqual(odd, [['rbs01-5', 41], ['rdb01-1', 37]], 'battlespirits.com publishes 41 cards for 26RBS01 #5 and 37 for 26RDB01 #1');
});

test('RD-3 every complete ready deck validates as Standard; the three with a card still missing say so', async () => {
  const r = await ev(() => BS.PREBUILT.filter(d => d.kind === 'ready').map(d => [d.id, d.missing, BS.validateDeck(d.cards, 'standard'), BS.prebuiltLabel(d)]));
  const missing = r.filter(x => x[1] > 0).map(x => [x[0], x[1]]);
  assert.deepEqual(missing, [['rbs02-6', 3], ['rbs03-5', 2], ['rdb01-3', 2]], '26RBS02-092 x3, 26RBS03-095 x2, 26RSD08-013 x2 are not in the library yet');
  for (const [id, miss, v, label] of r) {
    if (miss > 0) assert.match(label, new RegExp(`\\(incomplete, ${miss} missing\\)`));
    else if (id !== 'rdb01-1') assert.ok(v.ok, `${id}: ${v.errors.join(' / ')}`);   // rdb01-1 is 37 cards as published
  }
  assert.equal(r.filter(x => x[1] === 0).length, 23, '23 of the 26 published recipes are fully in the library');
  assert.deepEqual(r.filter(x => x[1] === 0 && !x[2].ok).map(x => x[0]), ['rdb01-1'], 'only the 37-card published recipe is short of 40');
});

test('RD-4 the six hand-made colour / Contract decks are hidden fixtures, not ready-made decks', async () => {
  const r = await ev(() => {
    const ids = ['mitra', 'red', 'blue', 'green', 'purple', 'yellow'];
    const fx = ids.map(id => BS.PREBUILT.find(d => d.id === id));
    BS.switchView('view-decks'); BS.renderDecks();
    const dom = document.getElementById('dk-starters').textContent + document.getElementById('dk-ready').textContent;
    return { hidden: fx.every(d => !!d && d.hidden), kind: fx.every(d => d.kind === 'fixture'), inDom: fx.filter(d => dom.includes(d.name)).map(d => d.id) };
  });
  assert.deepEqual(r, { hidden: true, kind: true, inDom: [] });
});
