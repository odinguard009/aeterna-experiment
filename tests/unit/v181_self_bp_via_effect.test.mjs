// v0.181.0: fxIf selfBpGe ("If this Spirit has N BP or more") and viaEffect ("If this Spirit is summoned via an effect").
// rules: ETR:cost.paying@06d788b2
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 0; q.reserve.soul = false; }`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V181-01 selfBpGe: compares this Spirit\'s current BP (BS01-035 Lv1 2000, Lv2 3000)', async () => {
  const r = await ev(`const s = BS.mkInst('BS01-035'); s.cores = 1; P.spirits.push(s);
    const lv1 = [2000, 3000].map(n => BS.fxIf(P, O, { selfBpGe: n }, { selfInst: s }));
    s.cores = 2;
    return [lv1, [2000, 3000, 4000].map(n => BS.fxIf(P, O, { selfBpGe: n }, { selfInst: s })), BS.fxIf(P, O, { selfBpGe: 1000 }, {})];`);
  assert.deepEqual(r, [[true, false], [true, true, false], false]);
});

test('V181-02 viaEffect: true for a free summon, false for a paid one', async () => {
  const r = await ev(`const out = [];
    const a = BS.mkInst('BS01-035'); P.hand = [a]; P.reserve.n = 5;
    BS.summon(P, a, { reserve: BS.effCost(P, BS.CARDS[a.id]), by: {}, rsoul: false, fsoul: null });
    out.push([BS.fxIf(P, O, { viaEffect: true }, { selfInst: a }), BS.fxIf(P, O, { viaEffect: false }, { selfInst: a })]);
    const b = BS.mkInst('BS01-035'); P.hand = [b]; P.reserve.n = 5;
    await BS.summonFree(P, b, {});
    out.push([BS.fxIf(P, O, { viaEffect: true }, { selfInst: b }), BS.fxIf(P, O, { viaEffect: false }, { selfInst: b })]);
    return out;`);
  assert.deepEqual(r, [[false, true], [true, false]]);
});

test('V181-03 DRAW_PLUS: BS05-014 Lv2 adds a card in the own Draw Step with 3 Fairy/Imaginary Beast Spirits', async () => {
  const r = await ev(`const s = BS.mkInst('BS05-014'); s.cores = 2; P.spirits.push(s);
    const fam = BS.CARDS['BS05-014'].families; const out = [];
    BS.G.turn = 'player'; BS.G.step = 2;
    out.push(BS.drawPlusOf(P));
    for (let i = 0; i < 2; i++) { const t = BS.mkInst('BS05-014'); t.cores = 1; P.spirits.push(t); }
    out.push(BS.drawPlusOf(P));
    BS.G.step = 4; out.push(BS.drawPlusOf(P));
    BS.G.step = 2; s.cores = 1; out.push(BS.drawPlusOf(P));
    return out;`);
  assert.deepEqual(r, [0, 1, 0, 0]);
});
