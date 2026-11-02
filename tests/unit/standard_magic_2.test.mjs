// v0.89.0 S1 Standard Magic part 2 (roadmap item L): the Standard Magic cards that needed a new action.
// Schema v3: condition ctrlFamily; BP_TARGET.perExhausted, DESTROY_PICKED (with END_BATTLE), BP_MINUS.other, EXHAUST_OPP.oppChooses,
// SOUL_HOLDER_CORE, BOUNCE_OPP.bpLeOwnLv1, LIFE_SHIELD, BLOCK_EXHAUSTED_OPP. Real cards are cast on quiet boards with test Spirits.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
const sp = (id, cost, extra = {}) => Object.assign({ id, name: id, type: 'Spirit', color: 'red', cost, symbols: 1, levels: [{ cores: 1, bp: cost * 1000 }] }, extra);
const FIX = [
  sp('T89-C3', 3), sp('T89-C5', 5), sp('T89-C4', 4),
  sp('T89-GAIM', 3, { families: ['GAIM'] }), sp('T89-GENM', 4, { name: 'Kamen Rider Genm', families: ['EX-AID'] }),
  sp('T89-STELLA', 2, { text: '[Team: Red Stella]\n\n[LV1] (When Summoned) Draw a card.' }), sp('T89-STELLA2', 2, { text: '[Teams: Shiny Hearts/Red Stella]' }),
  sp('T89-TOP4', 4, { families: ['Topaz'], color: 'yellow' }), sp('T89-TOP6', 6, { families: ['Topaz'], color: 'yellow' }), sp('T89-TOP5', 5, { families: ['Topaz'], color: 'yellow' }),
  sp('T89-RYUKI', 4, { families: ['RYUKI', 'Kamen'] }), sp('T89-RYUKI1', 4, { families: ['RYUKI'] }),
  sp('T89-P2', 2, { color: 'purple' }), sp('T89-WAIL', 2, { families: ['Wailwraith'] }), sp('T89-C2', 2),
  { id: 'T89-NEX', name: 'T89-NEX', type: 'Nexus', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
// mine / theirs: [id, cores, exhausted]; returns the expression's value after casting `card` (Flash) when it is usable
const cast = (card, mine, theirs, setup = '', out = '') => g.page.evaluate(async ([card, mine, theirs, setup, out]) => {
  BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = O.key; G.step = 5;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.trash = []; q.hand = []; }
  P.reserve.n = 10; P.reserve.soul = true;
  const put = (q, [id, cores, ex]) => { const i = BS.mkInst(id); i.cores = cores == null ? 1 : cores; i.exhausted = !!ex; (BS.CARDS[id].type === 'Nexus' ? q.nexus : q.spirits).push(i); return i; };
  mine.forEach(x => put(P, x)); theirs.forEach(x => put(O, x));
  eval(setup);
  const m = BS.mkInst(card); P.hand.push(m); const ok = BS.magicUsable(P, m, 'flash');
  if (ok) await BS.castMagic(P, { inst: m, ctx: 'flash' });
  return [ok, await eval(out || "O.spirits.map(s => s.id)")];
}, [card, mine, theirs, setup, out]);


test('S89-01 Unmask: +5000 BP to your Purple Spirit, destroyed when this battle ends; not usable in the Main Step', async () => {
  const r = await cast('26RBS02-088', [['T89-P2']], [['T89-C3']], 'G.battleNo = (G.battleNo || 0) + 1; G.attacker = P.spirits[0]; G.eob = [];',
    "(async () => { const bp = BS.bpOf(P.spirits[0]); await BS.endOfBattle(); return [bp, P.spirits.length]; })()");
  assert.deepEqual(r, [true, [7000, 0]]);
  const main = await g.page.evaluate(() => { const P = BS.G.p.player, m = BS.mkInst('26RBS02-088'); P.hand.push(m); return BS.magicUsable(P, m, 'main'); });
  assert.equal(main, false);
});
test('S89-02 Rapid Ripper: the opponent chooses which refreshed Spirit is exhausted (the CPU gives up its weakest)', async () => {
  assert.deepEqual(await cast('26RBS02-089', [], [['T89-C5'], ['T89-C3'], ['T89-C2', 1, true]], '', "O.spirits.map(s => s.exhausted)"), [true, [false, true, true]]);
});
test('S89-03 Portal Hack: two different opposing Spirits get -2000 (-3000 with a Wailwraith/Hexcraft Spirit); 0 BP ones are destroyed', async () => {
  assert.deepEqual(await cast('26RBS02-091', [['T89-C3']], [['T89-C2'], ['T89-C4']], '', "O.spirits.map(s => [s.id, BS.bpOf(s)])"), [true, [['T89-C4', 2000]]]);
  assert.deepEqual(await cast('26RBS02-091', [['T89-WAIL']], [['T89-C2'], ['T89-C3']], '', "O.spirits.map(s => [s.id, BS.bpOf(s)])"), [true, []]);
});
test('S89-04 Evil Hazard: a core leaves the opposing Spirit that holds the Soul Core; the opponent keeps the Soul Core while it can', async () => {
  assert.deepEqual(await cast('26RBS03-088', [], [['T89-C3', 1], ['T89-C4', 2]], 'O.spirits[0].soul = true; O.reserve.soul = false; O.reserve.n = 0;', "[O.spirits.map(s => [s.cores, !!s.soul]), O.reserve.n]"), [true, [[[0, true], [2, false]], 1]]);
  assert.deepEqual(await cast('26RBS03-088', [], [['T89-C4', 2]], 'O.reserve.soul = true;'), [false, ['T89-C4']]);
});
test('S89-05 Strike Vent: returns an opposing Spirit with BP up to the LV1 BP of your "RYUKI" & "Kamen" Spirit', async () => {
  assert.deepEqual(await cast('26RCB01-066', [['T89-RYUKI']], [['T89-C5'], ['T89-C4']]), [true, ['T89-C5']]);
  assert.deepEqual(await cast('26RCB01-066', [['T89-RYUKI1']], [['T89-C3']]), [false, ['T89-C3']]);
});
test('S89-06 Defensive Gate: the shielded Spirit attacks unblocked and the Life stays; two targets after a Life reduction', async () => {
  const r = await cast('26RSD04-014', [], [['T89-C3', 1], ['T89-C4', 1]], 'G.active = O.key; G.step = 5;',
    "(async () => { const life = P.life, att = O.spirits.find(s => s.lifeShield); await BS.doBattle(O.key, att); return [life, P.life, O.spirits.filter(s => s.lifeShield).length]; })()");
  assert.deepEqual(r, [true, [5, 5, 1]]);
  assert.deepEqual(await cast('26RSD04-014', [], [['T89-C3'], ['T89-C4']], 'BS.lifeTake(P, 1, "reserve");', "O.spirits.filter(s => s.lifeShield).length"), [true, 2]);
});
test('S89-07 Meteor Crash: an exhausted opposing Spirit can block during this battle only', async () => {
  const r = await cast('26RBS01-109', [['T89-C3']], [['T89-C4', 1, true]], 'G.battleNo = (G.battleNo || 0) + 1; G.attacker = P.spirits[0];',
    "(() => { const a = BS.canBlockState(O, O.spirits[0]); G.battleNo++; return [a, BS.canBlockState(O, O.spirits[0])]; })()");
  assert.deepEqual(r, [true, [true, false]]);
});
test('S89-08 Flame Summoning: +3000 BP for each exhausted Spirit you control', async () => {
  assert.deepEqual(await cast('26RBS02-087', [['T89-C3', 1, true], ['T89-C2', 1, true], ['T89-P2', 1]], [], '', "P.spirits.map(s => BS.bpOf(s))"), [true, [9000, 2000, 2000]]);
});
