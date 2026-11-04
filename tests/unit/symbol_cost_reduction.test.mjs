// v0.32.7 owner request: cost reduction by Field symbols per the Eternal rule manual VER.17.0
// (p. 18 Nexus symbols, p. 24-25 reduction + six-colour reduction symbols, p. 39 Ultimate symbol, p. 42/44 God symbols,
//  p. 49 Burst Area, p. 55 Soul State). Quiet boards only.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const FIX = [
  { id: 'R-PAY', name: 'Pay Red 2', type: 'Spirit', color: 'red', cost: 5, reduction: { red: 2 }, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'R-ALL', name: 'Pay Six', type: 'Spirit', color: 'red', cost: 5, reduction: { red: 1, all: 1 }, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'R-ULT', name: 'Pay Ult', type: 'Spirit', color: 'red', cost: 5, reduction: { ultimate: 2 }, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'R-GOD', name: 'Pay God', type: 'Spirit', color: 'red', cost: 5, reduction: { god: 1, red: 1 }, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'R-RW', name: 'Pay RW', type: 'Spirit', color: 'red', cost: 5, reduction: { red: 1, white: 1 }, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'R-CHEAP', name: 'Cheap', type: 'Spirit', color: 'red', cost: 1, reduction: { red: 3 }, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'R-SOUL', name: 'Soul Reduce', type: 'Spirit', color: 'red', cost: 5, reduction: { red: 2 }, soulReduce: true, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'R-GW', name: 'Plain Walker', type: 'Nexus', color: 'blue', cost: 3, families: ['Grandwalker'], levels: [{ cores: 0 }] },
  { id: 'R-MC', name: 'Two Colour', type: 'Spirit', colors: ['red', 'white'], cost: 3, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'R-CG', name: 'Coloured God', type: 'Nexus', color: 'green', cost: 3, symbolColors: ['god-green'], levels: [{ cores: 0 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => { const x = BS.importCards(JSON.stringify(fix)); BS.defBuiltin({ id: 'R-ULTC', name: 'Ult Card', type: 'Ultimate', symbol: 'red', cost: 6, symbols: 1, levels: [{ cores: 1, bp: 8000 }] }); return x; }, FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.spirits = []; P.nexus = []; P.soulState = []; P.burst = null; P.mirage = null; O.spirits = []; O.nexus = [];
  const sp = (id, z = P.spirits) => { const i = BS.mkInst(id); i.cores = 1; z.push(i); return i; }, nx = id => { const i = BS.mkInst(id); i.cores = 0; P.nexus.push(i); return i; };
  const cost = id => BS.effCost(P, BS.CARDS[id]);`;
const ev = body => g.page.evaluate(`(() => { ${PRE}\n${body} })()`);

// rules: ETR:cost.paying@06d788b2
test('R01 manual p. 22 example: 2 red reduction symbols, 3 red + 1 off-colour symbol on the Field -> cost 5 - 2 = 3', async () => {
  assert.equal(await ev(`sp('BS75-X02'); sp('BS75-X01'); sp('BS75-CX01'); sp('BS74-047'); return cost('R-PAY');`), 3);
});
test('R02 Nexus symbols reduce costs (p. 18)', async () => {
  assert.deepEqual(await ev(`const a = cost('R-PAY'); nx('BS75-061'); return [a, cost('R-PAY')];`), [5, 4]);
});
test('R03 a Contract Grandwalker Nexus has a coloured God symbol: it reduces its colour (p. 44)', async () => {
  assert.equal(await ev(`nx('BS74-CX01'); return cost('R-PAY');`), 4);
});
test('R04 a plain Grandwalker God symbol never reduces the six colours, only God reduction (p. 42)', async () => {
  assert.deepEqual(await ev(`nx('R-GW'); return [cost('R-PAY'), cost('R-GOD'), BS.symbolAttrs(BS.CARDS['R-GW'])];`), [5, 4, [['god']]]);
});
test('R05 a coloured God symbol (data "god-green") counts as God and green', async () => {
  assert.deepEqual(await ev(`return BS.symbolAttrs(BS.CARDS['R-CG']);`), [['god', 'green']]);
});
test('R06 Ultimate symbols reduce only Ultimate reduction symbols (p. 39)', async () => {
  assert.deepEqual(await ev(`sp('R-ULTC'); return [cost('R-ULT'), cost('R-PAY'), BS.symbolAttrs(BS.CARDS['R-ULTC'])];`), [4, 5, [['ultimate']]]);
});
test('R07 six-colour reduction symbols take any coloured symbol, never God or Ultimate (p. 25)', async () => {
  assert.deepEqual(await ev(`sp('BS74-047'); const a = cost('R-ALL'); P.spirits = []; nx('R-GW'); sp('R-ULTC'); return [a, cost('R-ALL')];`), [4, 5]);
});
test('R08 each Field symbol pays for one reduction symbol only', async () => {
  assert.equal(await ev(`sp('BS75-X02'); return cost('R-ALL');`), 4);
});
test('R09 symbols are matched to reduction symbols in the best way (red to red, white to six-colour)', async () => {
  assert.equal(await ev(`sp('BS74-047'); sp('BS75-X02'); return cost('R-ALL');`), 3);
});
test("R10 a two-colour card's symbol counts as either colour, but pays only once", async () => {
  assert.deepEqual(await ev(`sp('R-MC'); const a = cost('R-RW'); sp('R-MC'); return [a, cost('R-RW'), BS.symbolAttrs(BS.CARDS['R-MC'])];`), [4, 3, [['red', 'white']]]);
});
test('R11 Soul State symbols do not reduce other cards (p. 55); a card that says so may use them', async () => {
  assert.deepEqual(await ev(`const s = BS.mkInst('BS75-X02'); s.inSoulState = true; P.soulState.push(s); return [cost('R-PAY'), cost('R-SOUL')];`), [5, 4]);
});
test('R12 cards in the Burst Area / Mirage do not reduce (p. 49)', async () => {
  assert.equal(await ev(`P.burst = BS.mkInst('BS75-X02'); P.mirage = BS.mkInst('BS75-X01'); return cost('R-PAY');`), 5);
});
test("R13 the opponent's symbols never count", async () => {
  assert.equal(await ev(`sp('BS75-X02', O.spirits); sp('BS75-X01', O.spirits); return cost('R-PAY');`), 5);
});
test('R14 a cost never goes below 0', async () => {
  assert.equal(await ev(`sp('BS75-X02'); sp('BS75-X01'); sp('BS75-CX01'); return cost('R-CHEAP');`), 0);
});
test('R15 a 2-symbol Spirit gives two symbols of its colour', async () => {
  assert.equal(await ev(`sp('BS75-X03'); return cost('R-PAY');`), 3);
});
test('R16 Magic cards have no symbols', async () => {
  assert.deepEqual(await ev(`return BS.symbolAttrs(BS.CARDS['BS75-073']);`), []);
});
test('R17 symbolsOn counts per attribute (a coloured God symbol counts in both)', async () => {
  assert.deepEqual(await ev(`nx('BS74-CX01'); sp('BS75-X03'); return BS.symbolsOn(P);`), { god: 1, red: 3 });
});
test('R18 import accepts six-colour / Ultimate / God reduction symbols and rejects unknown ones', async () => {
  const r = await ev(`const t = red => (BS.parseCard({ id: 'R-X', name: 'X', type: 'Spirit', color: 'red', cost: 3, reduction: red, levels: [{ cores: 1, bp: 1000 }] }).errors || []).length;
    return [t({ all: 1 }), t({ ultimate: 1 }), t({ god: 1 }), t({ pink: 1 }) > 0, (BS.parseCard({ id: 'R-Y', name: 'Y', type: 'Nexus', color: 'red', cost: 1, symbolColors: ['god-pink'], levels: [{ cores: 0 }] }).errors || []).length > 0];`);
  assert.deepEqual(r, [0, 0, 0, true, true]);
});
// imported Contractor Nexus cards with no known symbol (symbols 0) are excluded: nothing to reduce with
test('R19 the built-in pack keeps its reductions (every Contract Grandwalker reduces its own colour)', async () => {
  const r = await ev(`return Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker') && /Contractor/.test(BS.CARDS[k].name) && BS.CARDS[k].symbols > 0).map(k => { const a = BS.symbolAttrs(BS.CARDS[k]); return a.length === 1 && a[0].includes('god') && a[0].includes(BS.CARDS[k].symbol); });`);
  assert.ok(r.length >= 5 && r.every(Boolean), JSON.stringify(r));
});
test('R20 no page errors', () => { assert.deepEqual(g.errors, []); });
