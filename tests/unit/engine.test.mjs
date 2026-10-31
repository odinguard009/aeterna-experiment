// Engine unit tests against the real build in headless Chromium, on a quiet board (BS.testSetup: no match loop).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { quietBoard, closeBrowser, ROOT } from './lib/game.mjs';

let page, errors;
const ev = (fn, arg) => page.evaluate(fn, arg);
before(async () => { ({ page, errors } = await quietBoard()); });
// testSetup() empties both Hands without changing deckSize; give the board consistent card counts for the invariant checks
beforeEach(async () => { await ev(() => { BS.testSetup(); for (const p of Object.values(BS.G.p)) p.deckSize = p.deck.length; return 1; }); });
after(async () => { await closeBrowser(); });

test('E01 the game loads without page errors and reports the package version', async () => {
  assert.deepEqual(errors, []);
  assert.equal(await ev(() => BS.VERSION), JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version);
});
test('E02 seeded RNG: the same seed gives the same sequence, values in [0,1)', async () => {
  const [a, b] = await ev(() => { const s = n => { BS.seedRng(n); return Array.from({ length: 50 }, () => BS.rng()); }; return [s(42), s(42)]; });
  assert.deepEqual(a, b); for (const x of a) assert.ok(x >= 0 && x < 1);
});
test('E03 seeded RNG: different seeds give different sequences', async () => {
  const [a, b] = await ev(() => { const s = n => { BS.seedRng(n); return Array.from({ length: 10 }, () => BS.rng()); }; return [s(1), s(2)]; });
  assert.notDeepEqual(a, b);
});
test('E04 every Eternal prebuilt deck is legal in Eternal (the Standard starters are tested in std_decks97)', async () => {
  const r = await ev(() => BS.PREBUILT.filter(d => !d.format).map(d => [d.id, BS.validateDeck(d.cards, 'eternal')]));
  for (const [id, v] of r) assert.ok(v.ok, `${id}: ${v.errors.join(' / ')}`);
});
test('E05 a 39-card deck is rejected (manual: 40 or more cards)', async () => {
  const v = await ev(() => { const d = Object.assign({}, BS.PREBUILT.find(x => x.id === 'red').cards); let n = Object.values(d).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(d)) { while (n > 39 && d[k] > 0) { d[k]--; n--; } } return BS.validateDeck(d, 'eternal'); });
  assert.equal(v.ok, false); assert.equal(v.total, 39); assert.match(v.errors.join(' '), /at least 40/);
});
test('E06 four copies of one name are rejected (manual: max 3 per name)', async () => {
  const v = await ev(() => { const d = Object.assign({}, BS.PREBUILT.find(x => x.id === 'red').cards); const k = Object.keys(d)[1]; d[k] = 4; return BS.validateDeck(d, 'eternal'); });
  assert.equal(v.ok, false); assert.match(v.errors.join(' '), /max 3 copies/);
});
test('E07 only one type of Contract card is allowed in a deck', async () => {
  const v = await ev(() => { const ids = Object.keys(BS.CARDS).filter(id => BS.CARDS[id].contract); if (ids.length < 2) return null;
    const d = Object.assign({}, BS.PREBUILT.find(x => x.id === 'red').cards); d[ids[0]] = 1; d[ids[1]] = 1; return BS.validateDeck(d, 'eternal'); });
  if (v === null) return; // fewer than two Contract cards in the pack
  assert.match(v.errors.join(' '), /one type of Contract/);
});
test('E08 the CPU deck for each format is legal in that format', async () => {
  const r = await ev(() => ['eternal', 'standard'].map(f => { const d = BS.cpuDeckFor(f); return [f, d ? BS.validateDeck(d, f) : null]; }));
  for (const [f, v] of r) if (v) assert.ok(v.ok, `${f}: ${v.errors.join(' / ')}`);
});
test('E09 takeFromVoid creates missing cores (unlimited supply) and keeps the core count consistent', async () => {
  const r = await ev(() => { const p = BS.G.p.player, m0 = p.made; p.reserve.n -= 1; p.void = 1; const got = BS.takeFromVoid(p, 3); p.reserve.n += got; let e = null; try { BS.checkInvariants(); } catch (x) { e = x.message; } return { got, made: p.made - m0, v: p.void, e }; });
  assert.equal(r.got, 3); assert.equal(r.made, 2); assert.equal(r.v, 0); assert.equal(r.e, null);
});
test('E10 takeFromVoid(0) and negative amounts take nothing', async () => {
  assert.deepEqual(await ev(() => { const p = BS.G.p.player, m = p.made; return [BS.takeFromVoid(p, 0), BS.takeFromVoid(p, -2), p.made - m]; }), [0, 0, 0]);
});
test('E11 lvIndex: for every Spirit, exactly the level threshold reaches that level', async () => {
  const bad = await ev(() => { const out = [];
    for (const [id, c] of Object.entries(BS.CARDS)) { if (c.type !== 'Spirit' || c.countLv) continue;
      c.levels.forEach((L, k) => { const i = BS.mkInst(id); i.cores = L.cores; if (BS.lvIndex(i) !== k) out.push(`${id} LV${k + 1}`);
        if (L.cores > 0) { i.cores = L.cores - 1; if (BS.lvIndex(i) !== k - 1) out.push(`${id} below LV${k + 1}`); } }); }
    return out; });
  assert.deepEqual(bad, []);
});
test('E12 the Soul Core counts as a core for the level (manual: Soul Core is a core)', async () => {
  const bad = await ev(() => { const out = [];
    for (const [id, c] of Object.entries(BS.CARDS)) { if (c.type !== 'Spirit' || c.countLv || c.levels.length < 2) continue;
      const i = BS.mkInst(id); i.cores = c.levels[1].cores - 1; i.soul = true; if (BS.lvIndex(i) !== 1) out.push(id); }
    return out; });
  assert.deepEqual(bad, []);
});
test('E13 effCost without symbols on the field is the printed cost', async () => {
  const bad = await ev(() => { const p = BS.G.p.player; p.spirits = []; p.nexus = []; const out = [];
    for (const [id, c] of Object.entries(BS.CARDS)) if (!c.costAlt && !c.reduceIf && BS.effCost(p, c) !== c.cost) out.push(id); return out; });   // v0.202.0: a reduceIf card lowers the cost even with no symbols
  assert.deepEqual(bad, []);
});
test('E14 effCost with every reduction symbol present is cost - reduction, never below 0', async () => {
  const { bad, checked } = await ev(() => { const p = BS.G.p.player, out = []; let checked = 0;
    for (const [id, c] of Object.entries(BS.CARDS)) { if (c.costAlt || c.soulReduce || c.reduceIf) continue;
      p.spirits = []; p.nexus = []; let skip = false;
      for (const [col, n] of Object.entries(c.reduction || {})) {
        const donor = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].symbol === col && BS.CARDS[k].symbols === 1);
        if (!donor) { skip = true; break; }          // no single-symbol Spirit of that colour in the pack
        for (let j = 0; j < n; j++) { const s = BS.mkInst(donor); s.cores = BS.CARDS[donor].levels[0].cores; p.spirits.push(s); } }
      if (skip) continue; checked++;
      const red = Object.values(c.reduction || {}).reduce((a, b) => a + b, 0);
      if (BS.effCost(p, c) !== Math.max(0, c.cost - red)) out.push(`${id}: ${BS.effCost(p, c)} vs ${Math.max(0, c.cost - red)}`); }
    p.spirits = []; return { bad: out, checked }; });
  assert.deepEqual(bad, []); assert.ok(checked > 40, `only ${checked} cards checked`);
});
test('E15 deck text round trip: textToDeck(deckToText()) gives the same deck', async () => {
  const r = await ev(() => { const r = BS.textToDeck(BS.deckToText()); return { a: r.deck || r, b: Object.assign({}, BS.PLAYER_DECK) }; });
  assert.deepEqual(r.a, r.b);
});
test('E16 checkInvariants passes on a fresh board', async () => {
  assert.equal(await ev(() => { try { BS.checkInvariants(); return 'ok'; } catch (e) { return e.message; } }), 'ok');
});
test('E17 checkInvariants catches a lost core', async () => {
  assert.match(await ev(() => { BS.G.p.player.reserve.n -= 1; try { BS.checkInvariants(); return 'ok'; } catch (e) { return e.message; } }), /Core mismatch/);
});
test('E18 checkInvariants catches a lost card', async () => {
  assert.match(await ev(() => { BS.G.p.opponent.deck.pop(); try { BS.checkInvariants(); return 'ok'; } catch (e) { return e.message; } }), /Card mismatch/);
});
test('E19 checkInvariants catches a second Soul Core', async () => {
  assert.match(await ev(() => { BS.G.p.player.trashCores.soul = true; BS.G.p.player.made += 0; try { BS.checkInvariants(); return 'ok'; } catch (e) { return e.message; } }), /Soul Core count/);
});
test('E20 a new player starts with 5 Life, 3 Reserve cores + the Soul Core, 4 cards in Hand', async () => {
  const r = await ev(() => { const g = BS.newGame(BS.PREBUILT.find(x => x.id === 'red').cards, BS.PREBUILT.find(x => x.id === 'mitra').cards);
    return ['player', 'opponent'].map(k => { const p = g.p[k]; return [p.life, p.reserve.n, p.reserve.soul, p.hand.length, p.deck.length + p.hand.length === p.deckSize]; }); });
  for (const x of r) assert.deepEqual(x, [5, 3, true, 4, true]);
});
test('E21 a new game puts a Contract card of the deck in the starting Hand (the human may undo it, see E21b)', async () => {
  const r = await ev(() => { const g = BS.newGame(BS.PREBUILT.find(x => x.id === 'red').cards, BS.PREBUILT.find(x => x.id === 'mitra').cards);
    return ['player', 'opponent'].map(k => g.p[k].hand.some(i => BS.CARDS[i.id].contract)); });
  const decks = await ev(() => ['red', 'mitra'].map(d => Object.keys(BS.PREBUILT.find(x => x.id === d).cards).some(id => BS.CARDS[id].contract)));
  assert.deepEqual(r, decks);
});
test('E21b contractToDeck moves the Contract card back to the Deck and draws a replacement', async () => {
  const r = await ev(() => { const g = BS.newGame(BS.PREBUILT.find(x => x.id === 'mitra').cards, BS.PREBUILT.find(x => x.id === 'red').cards); const p = g.p.player;
    const had = p.hand.some(i => BS.CARDS[i.id].contract), moved = BS.contractToDeck(p);
    return { had, moved, n: p.hand.length, inHand: p.hand.some(i => BS.CARDS[i.id].contract), total: p.deck.length + p.hand.length === p.deckSize }; });
  assert.deepEqual(r, { had: true, moved: true, n: 4, inHand: false, total: true });
});
test('E21d starting Hand is 4 with or without a Contract card; a redraw returns the Contract card and draws 4', async () => {
  const r = await ev(() => { const P = id => BS.PREBUILT.find(x => x.id === id).cards; const out = {};
    for (const [k, d] of [['gw', 'mitra'], ['plain', 'red']]) { const g = BS.newGame(P(d), P('red')); const p = g.p.player;
      const had = p.hand.some(i => BS.CARDS[i.id].contract); BS.redrawHand(p);
      out[k] = { had, n0: 4, n: p.hand.length, total: p.deck.length + p.hand.length === p.deckSize }; }
    let lost = 0; for (let s = 0; s < 20; s++) { const g = BS.newGame(P('mitra'), P('red')); const p = g.p.player; const n = p.hand.length; BS.redrawHand(p); if (n !== 4 || p.hand.length !== 4) lost++; }
    out.loop = lost; return out; });
  assert.equal(r.gw.had, true); assert.equal(r.gw.n, 4); assert.equal(r.gw.total, true);
  assert.equal(r.plain.n, 4); assert.equal(r.plain.total, true); assert.equal(r.loop, 0);
});
test('E21e CPU keeps a starting Hand with its Contract card; redraws an all-cost-4+ hand otherwise', async () => {
  const r = await ev(() => { const ids = Object.keys(BS.CARDS), con = ids.find(id => BS.CARDS[id].contract), hi = ids.filter(id => !BS.CARDS[id].contract && !BS.CARDS[id].token && BS.CARDS[id].cost > 3).slice(0, 4), lo = ids.find(id => !BS.CARDS[id].contract && !BS.CARDS[id].token && BS.CARDS[id].cost <= 3);
    const h = a => a.map(id => ({ id }));
    return { allHi: BS.cpuWantsRedraw(h(hi)), withCon: BS.cpuWantsRedraw(h([...hi.slice(0, 3), con])), withLow: BS.cpuWantsRedraw(h([...hi.slice(0, 3), lo])) }; });
  assert.deepEqual(r, { allHi: true, withCon: false, withLow: false });
});
test('E21c deck builder filters match colour, cost and type', async () => {
  const r = await ev(() => { const ids = Object.keys(BS.CARDS).filter(id => !BS.CARDS[id].token), f = (c, k, t) => ids.filter(id => BS.dbFilterOK(BS.CARDS[id], c, k, t));
    return { all: f('', '', '').length === ids.length, red: f('red', '', '').every(id => BS.cardColors(BS.CARDS[id]).includes('red')), c3: f('', '3', '').every(id => BS.CARDS[id].cost === 3),
      hi: f('', '10', '').every(id => BS.CARDS[id].cost >= 10), nex: f('', '', 'Nexus').every(id => BS.CARDS[id].type === 'Nexus'), con: f('', '', 'Contract').every(id => BS.CARDS[id].contract) }; });
  assert.deepEqual(r, { all: true, red: true, c3: true, hi: true, nex: true, con: true });
});
test('E22 every card renders its detail panel and card-style effect text without errors', async () => {
  const bad = await ev(() => { const out = [];
    for (const id of Object.keys(BS.CARDS)) { try { const a = BS.cardDetailHTML(BS.CARDS[id]); const b = BS.effectTextHTML(BS.CARDS[id], true); if (!a || !b) out.push(id + ' empty'); } catch (e) { out.push(`${id}: ${e.message}`); } }
    return out; });
  assert.deepEqual(bad, []);
});
// Item T (owner, 2026-10-21): with ~6,000 playable Spirits/Nexuses this took 73 s and ran in every `npm run loop` (smoke set). In the
// quick loop (BS_QUICK) it takes every 20th card in id order (fixed sample, still > 250 cards); CI (`npm test`) keeps every card.
const E23_STEP = process.env.BS_QUICK ? 20 : 1;
test('E23 a field with every Spirit and Nexus of the pack renders and keeps the invariants', async () => {
  const r = await ev((step) => { const p = BS.G.p.player; let added = 0, seen = 0;
    for (const [id, c] of Object.entries(BS.CARDS)) { if (c.type !== 'Spirit' && c.type !== 'Nexus') continue; if (id.startsWith('TRAIN') || id.startsWith('TST')) continue; if (seen++ % step) continue;
      const i = BS.mkInst(id); const need = c.type === 'Spirit' && !c.countLv ? c.levels[0].cores : 0; i.cores = need; BS.takeFromVoid(p, need);
      (c.type === 'Spirit' ? p.spirits : p.nexus).push(i); p.deckSize++; added++; }
    let e = null; try { BS.render(); BS.checkInvariants(); } catch (x) { e = x.message; } return { added, e }; }, E23_STEP);
  assert.ok(r.added > (E23_STEP > 1 ? 250 : 20), `${r.added} cards on the field`); assert.equal(r.e, null);
});
test('E24 no page errors were raised by the engine tests', () => { assert.deepEqual(errors, []); });
