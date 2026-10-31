// v0.97.0: format default Standard + the ten Standard starter decks (roadmap "format default" + "Standard decks").
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { quietBoard, closeBrowser, ROOT } from './lib/game.mjs';

let page, errors;
const ev = (fn, arg) => page.evaluate(fn, arg);
before(async () => { await (async () => { ({ page, errors } = await quietBoard(true)); })(); });
after(async () => { await closeBrowser(); });

const recipes = () => readdirSync(join(ROOT, 'data/decks')).filter(f => /^standard-26rsd\d\d-/.test(f)).sort().map(f => {
  const rec = {};
  for (const l of readFileSync(join(ROOT, 'data/decks', f), 'utf8').split('\n')) { const m = /^\s*(\d+)\s+(\S+)/.exec(l); if (m) rec[m[2]] = (rec[m[2]] || 0) + Number(m[1]); }
  return { f, id: 'std' + /26rsd(\d\d)/.exec(f)[1], rec };
});

test('S97-1 the ten Standard starters are in PREBUILT with the full official recipe (40 cards each)', async () => {
  const r = recipes(); assert.equal(r.length, 10);
  const got = await ev(() => BS.PREBUILT.filter(d => d.kind === 'starter').map(d => [d.id, d.recipe]));
  assert.deepEqual(got.map(x => x[0]), r.map(x => x.id));
  for (const [i, [, rec]] of got.entries()) { assert.deepEqual(rec, r[i].rec, r[i].f); assert.equal(Object.values(rec).reduce((a, b) => a + b, 0), 40, r[i].f); }
});
test('S97-2 every complete starter validates as Standard; only an incomplete one is short, and it says so', async () => {
  const r = await ev(() => BS.PREBUILT.filter(d => d.kind === 'starter').map(d => [d.id, d.missing, BS.validateDeck(d.cards, 'standard'), BS.prebuiltLabel(d)]));
  for (const [id, missing, v, label] of r) {
    if (missing === 0) assert.ok(v.ok, `${id}: ${v.errors.join(' / ')}`);
    else { assert.ok(!v.ok); assert.match(label, new RegExp(`\\(incomplete, ${missing} missing\\)`)); }
  }
  assert.ok(r.filter(x => x[1] === 0).length >= 9, 'the nine starters whose cards are all in the library');
});
test('S97-3 the incomplete state appears when a card is missing and clears when it is added', async () => {
  const r = await ev(() => {
    const d = BS.PREBUILT.find(x => x.id === 'std01'), id = '26RSD01-001', c = BS.CARDS[id];
    const before = [d.missing, BS.prebuiltLabel(d)];
    delete BS.CARDS[id];
    const gone = [d.missing, BS.prebuiltLabel(d), Object.keys(d.cards).includes(id), BS.cpuDeckFor('standard') !== d.cards];
    BS.SETTINGS.cpuDeck = 'std01'; BS.cpuDeckFor('standard'); const pickedWhileMissing = BS.CPU_DECK_NAME === d.name;
    BS.CARDS[id] = c;
    const back = [d.missing, BS.prebuiltLabel(d)];
    BS.SETTINGS.cpuDeck = 'std03';
    return { before, gone, pickedWhileMissing, back };
  });
  assert.equal(r.before[0], 0); assert.equal(r.back[0], 0); assert.equal(r.back[1], r.before[1]);
  assert.equal(r.gone[0], 3); assert.match(r.gone[1], /incomplete, 3 missing/); assert.equal(r.gone[2], false);
  assert.equal(r.pickedWhileMissing, false, 'an incomplete starter is never the CPU deck');
});
test('S97-4 a random CPU deck in Standard is always a legal Standard starter, never the training deck; Training Red stays selectable', async () => {
  const r = await ev(() => { const keep = BS.SETTINGS.cpuDeck, out = []; BS.SETTINGS.cpuDeck = 'random'; for (let s = 1; s <= 40; s++) { BS.seedRng(s); const d = BS.cpuDeckFor('standard'); out.push([BS.CPU_DECK_NAME, BS.validateDeck(d, 'standard').ok]); } BS.SETTINGS.cpuDeck = 'train'; BS.cpuDeckFor('standard'); const t = BS.CPU_DECK_NAME; BS.SETTINGS.cpuDeck = keep; return { out, t }; });
  for (const [n, ok] of r.out) { assert.ok(ok, n); assert.doesNotMatch(n, /Training/); assert.match(n, /26R/); }
  assert.match(r.t, /Training Red/);
});
test('S97-5 defaults: Standard format, first-run deck is a Standard starter, CPU default is a Standard starter, names carry no developer notes', async () => {
  const r = await ev(() => ({ fmt: BS.FORMAT, def: BS.validateDeck(BS.defaultDeck(), 'standard'), cpu: BS.SETTINGS.cpuDeck, names: BS.PREBUILT.map(d => d.name), btn: BS.fmtButton('eternal') + '|' + BS.fmtButton('standard') }));
  assert.equal(r.fmt, 'standard'); assert.ok(r.def.ok, r.def.errors.join(' / ')); assert.equal(r.cpu, 'std03');
  for (const n of r.names) assert.doesNotMatch(n, /\bv0\.\d|for testing|draft/i, n);
  assert.equal(r.btn, 'ETERNAL (PREVIEW)|STANDARD');
});
test('S97-6 ban lists are per format: the Eternal list does not apply to Standard (no Standard list exists on the official page)', async () => {
  const r = await ev(() => ({ e: BS.banStatus('bs72-019', 'eternal'), s: BS.banStatus('bs72-019', 'standard'), d: BS.banStatus('BS75-054'), l1e: BS.banStatus('BS75-054', 'eternal'), l1s: BS.banStatus('BS75-054', 'standard'), mx: [BS.maxCopies('BS75-054', 'eternal'), BS.maxCopies('BS75-054', 'standard')], info: BS.BAN_LIST_INFO }));
  assert.equal(r.e, 'banned'); assert.equal(r.s, null); assert.equal(r.d, 'limit1');
  assert.equal(r.l1e, 'limit1'); assert.equal(r.l1s, null); assert.deepEqual(r.mx, [1, 3]);
  assert.match(r.info.checked, /^\d{4}-\d\d-\d\d$/);
});
test('S97-7 no page errors', async () => { assert.deepEqual(errors, []); });
