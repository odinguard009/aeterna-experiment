// v0.90.0 S1 Standard Magic part 3 (roadmap item L). Schema v4: match keyword / noText, SUMMON_HAND by colour (ctx.picked),
// OWN_CORE_TO_LIFE. Real cards are cast on quiet boards with test Spirits.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
const sp = (id, cost, extra = {}) => Object.assign({ id, name: id, type: 'Spirit', color: 'red', cost, symbols: 1, levels: [{ cores: 1, bp: cost * 1000 }] }, extra);
const FIX = [
  sp('T90-C3', 3), sp('T90-C5', 5), sp('T90-C4', 4),
  sp('T90-GAIM', 3, { families: ['GAIM'] }), sp('T90-GENM', 4, { name: 'Kamen Rider Genm', families: ['EX-AID'] }),
  sp('T90-STELLA', 2, { text: '[Team: Red Stella]\n\n[LV1] (When Summoned) Draw a card.' }), sp('T90-STELLA2', 2, { text: '[Teams: Shiny Hearts/Red Stella]' }),
  sp('T90-TOP4', 4, { families: ['Topaz'], color: 'yellow' }), sp('T90-TOP6', 6, { families: ['Topaz'], color: 'yellow' }), sp('T90-TOP5', 5, { families: ['Topaz'], color: 'yellow' }),
  sp('T90-RYUKI', 4, { families: ['RYUKI', 'Kamen'] }), sp('T90-RYUKI1', 4, { families: ['RYUKI'] }),
  sp('T90-P2', 2, { color: 'purple' }), sp('T90-WAIL', 2, { families: ['Wailwraith'] }), sp('T90-C2', 2),
  sp('T90-CLASH', 3, { text: '[LV1][LV2] Clash (During Attack)\nOpposing Spirits must block if possible.' }), sp('T90-MENTION', 4, { text: '[LV1] (When Summoned) Target a Spirit card with Clash in your Trash. Return it to the Hand.' }),
  sp('T90-PV', 3, { color: 'purple' }), sp('T90-BV', 3, { color: 'blue' }), sp('T90-BFX', 3, { color: 'blue', text: '[LV1] (When Summoned) Draw a card.' }),
  { id: 'T90-NEX', name: 'T90-NEX', type: 'Nexus', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
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



test('S90-01 Vermillion Roar: +3000 BP only to a Spirit that has Clash (not one that only mentions it)', async () => {
  const out = "P.spirits.map(s => BS.bpOf(s))";
  assert.deepEqual(await cast('26RBS01-111', [['T90-MENTION'], ['T90-CLASH']], [], '', out), [true, [4000, 6000]]);
  assert.deepEqual(await cast('26RBS01-111', [['T90-MENTION']], [], '', out), [false, [4000]]);
});
test('S90-02 Awakening: summons a Purple Spirit with no printed effects from the Trash for free, destroyed when this battle ends', async () => {
  const r = await cast('26RBS01-113', [['T90-C3']], [], "P.trash.push(BS.mkInst('T90-PV'), BS.mkInst('T90-BV')); G.battleNo = (G.battleNo || 0) + 1; G.attacker = P.spirits[0]; G.eob = [];",
    "(async () => { const on = P.spirits.map(s => s.id); await BS.endOfBattle(); return [on, P.spirits.map(s => s.id), P.trash.map(t => t.id).sort()]; })()");
  assert.deepEqual(r, [true, [['T90-C3', 'T90-PV'], ['T90-C3'], ['26RBS01-113', 'T90-BV', 'T90-PV']]]);
});
test('S90-03 Thunder Shutter: a core from your Topaz Spirit goes to your Life', async () => {
  assert.deepEqual(await cast('26RBS01-123', [['T90-TOP4', 2]], [], '', "[P.spirits[0].cores, P.life]"), [true, [1, 6]]);
  assert.deepEqual(await cast('26RBS01-123', [['T90-C3', 2]], [], '', "[P.spirits[0].cores, P.life]"), [false, [2, 5]]);
});
test('S90-04 Massive Grow: every Blue Spirit of yours with no printed effects gets +2000 BP this turn', async () => {
  assert.deepEqual(await cast('26RBS03-098', [['T90-BV'], ['T90-BFX'], ['T90-PV']], [], '', "P.spirits.map(s => BS.bpOf(s))"), [true, [5000, 3000, 3000]]);
});
