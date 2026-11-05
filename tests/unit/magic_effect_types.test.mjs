// v0.41 Magic effect types (see docs/ai/roadmap-open.md): MAGIC_FX.ACTIONS, DESTROY_EACH_COST, SYMBOLS_ZERO_OPP, SUMMON_HAND from the Trash.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; }, dk = (id, q = P) => { const i = BS.mkInst(id); q.deck.push(i); return i; };
  const ids = L => L.map(x => x.id);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\nlet ok;\n${body} })()`);

// v0.41 Magic effect types: MAGIC_FX.ACTIONS runs engine actions. Cards: Dana Draw, Whirling Tide, Magic Bullet, Hades Disaster, Thunder Counter, Lightning Tempest (Plutonic Wall is data only).
const DANA = 'BS71-083', TIDE = 'BS71-084', BULLET = 'BS72-083', PLUTO = 'BS68-076', HADES = 'BS68-077', THUNDER = 'BS75-082', TEMPEST = 'BS75-083', INDRA = 'BS75-CX03', NUA = 'BS71-CX03';
const T3 = 'BS75-006', T4 = 'BS75-008', T5 = 'BS75-011', T8 = 'BS75-013', SPEAR = 'BS71-063';
const cast = (id, ctx = 'flash') => `ok = await (async () => { const m = hd('${id}'); const u = BS.magicUsable(P, m, '${ctx}'); if (u) await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: '${ctx}' }); return u; })();`;

test('M01 the seven Magic cards are in the pack as Magic, all with a wired effect (Plutonic Wall since v0.47)', async () => {
  const r = await g.page.evaluate(L => L.map(i => { const c = BS.CARDS[i]; return [c.type, !!(c.magic && c.magic.effect)]; }), [DANA, TIDE, BULLET, PLUTO, HADES, THUNDER, TEMPEST]);
  assert.deepEqual(r, [['Magic', true], ['Magic', true], ['Magic', true], ['Magic', true], ['Magic', true], ['Magic', true], ['Magic', true]]);
});
test('M02 Magic Bullet destroys one Spirit of each cost 3, 4, 5 and 6 (nothing of cost 8 below seven counters)', async () => {
  const r = await ev(`sp('${T3}', O); sp('${T4}', O); sp('${T5}', O); sp('${T8}', O); P.count = 6; ${cast(BULLET)} return [ok, ids(O.spirits)];`);
  assert.deepEqual(r, [true, [T8]]);
});
test('M03 Magic Bullet with seven counters also destroys a Cost 7 or more Spirit', async () => {
  const r = await ev(`sp('${T3}', O); sp('${T8}', O); P.count = 7; ${cast(BULLET)} return [ok, ids(O.spirits), P.trash.map(x => x.id)];`);
  assert.deepEqual(r, [true, [], [BULLET]]);
});
test('M04 Magic Bullet is not usable against an empty board', async () => {
  const r = await ev(`const m = hd('${BULLET}'); return BS.magicUsable(P, m, 'flash');`);
  assert.equal(r, false);
});
test('M05 Hades Disaster destroys a Spirit with two cores or less, never one with three', async () => {
  const r = await ev(`sp('${T4}', O, 3); sp('${T5}', O, 2); ${cast(HADES)} return [ok, ids(O.spirits)];`);
  assert.deepEqual(r, [true, [T4]]);
});
test('M06 Thunder Counter needs a Contractor Indra; then an opposing Spirit can not attack or block', async () => {
  const r = await ev(`const t = sp('${T5}', O); const before = BS.magicUsable(P, hd('${THUNDER}'), 'flash'); nx('${INDRA}', P, 0); ${cast(THUNDER)} return [before, ok, t.noAB === true];`);
  assert.deepEqual(r, [false, true, true]);
});
test('M07 Lightning Tempest fixes the symbols of every opposing Spirit at zero for the turn', async () => {
  const r = await ev(`const t = sp('${T5}', O); const s0 = BS.attackSymbols(t); nx('${INDRA}', P, 0); ${cast(TEMPEST)} const s1 = BS.attackSymbols(t); G.turnNo++; return [s0 > 0, s1, BS.attackSymbols(t) === s0];`);
  assert.deepEqual(r, [true, 0, true]);
});
test('M08 Whirling Tide summons a Scalostle Brave from the Trash without paying; the card leaves the Trash', async () => {
  const r = await ev(`const b = BS.mkInst('${SPEAR}'); P.trash.push(b); ${cast(TIDE)} return [ok, P.spirits.some(s => s.id === '${SPEAR}'), P.trash.some(x => x.id === '${SPEAR}'), P.trash.some(x => x.id === '${TIDE}')];`);
  assert.deepEqual(r, [true, true, false, true]);
});
test('M09 Dana Draw (Main): draw three, discard three; each Contractor Nuadha controlled means one discard less', async () => {
  const r = await ev(`for (let i = 0; i < 6; i++) dk('${T3}'); ${cast(DANA, 'main')} const a = [ok, P.hand.length]; P.hand = []; P.trash = []; nx('${NUA}', P, 0); ${cast(DANA, 'main')} return [a, P.hand.length];`);
  assert.deepEqual(r, [[true, 0], 1]);
});
test('M10 Dana Draw Burst: cost destruction up to Cost 6, +4 with five counters', async () => {
  const r = await g.page.evaluate(i => { const b = BS.CARDS[i].burst; return [b.when, b.actions[0].do, b.actions[0].total, b.actions[0].boost]; }, DANA);
  assert.deepEqual(r, ['ALLY_LOST', 'DESTROY_TOTAL', 6, { counterGe: 5, n: 4 }]);
});

test('M11 the card text of each wired Magic card is built from its actions', async () => {
  const r = await g.page.evaluate(L => L.map(i => BS.magicText(BS.CARDS[i])), [BULLET, HADES, THUNDER, TEMPEST, TIDE, DANA]);
  assert.match(r[0], /cost 3 and 4 and 5 and 6/); assert.match(r[1], /2 cores or less/); assert.match(r[2], /can't attack\/block/);
  assert.match(r[3], /fixed as zero/); assert.match(r[4], /from your Trash/); assert.match(r[5], /draw 3/i);
});
test('M12 casting a Magic card pays its cost and sends it to the Trash', async () => {
  const r = await ev(`sp('${T5}', O); const before = P.reserve.n; ${cast(BULLET)} return [ok, P.reserve.n < before, P.hand.length, P.trash.some(x => x.id === '${BULLET}')];`);
  assert.deepEqual(r, [true, true, 0, true]);
});
test('M13 Whirling Tide is not usable without a Scalostle/Celtica Brave or Nexus in the Trash', async () => {
  const r = await ev(`const m = hd('${TIDE}'); const none = BS.magicUsable(P, m, 'flash'); P.trash.push(BS.mkInst('${SPEAR}')); return [none, BS.magicUsable(P, m, 'flash')];`);
  assert.deepEqual(r, [false, true]);
});
test('M14 Whirling Tide never summons a Spirit from the Trash (Brave and Nexus cards only)', async () => {
  const r = await ev(`const m = hd('${TIDE}'); P.trash.push(BS.mkInst('BS71-053')); return BS.magicUsable(P, m, 'flash');`);
  assert.equal(r, false);
});
test('M15 Thunder Counter does not stack on a Spirit that already can not attack or block', async () => {
  const r = await ev(`const t = sp('${T5}', O); t.noAB = true; nx('${INDRA}', P, 0); const m = hd('${THUNDER}'); return BS.magicUsable(P, m, 'flash');`);
  assert.equal(r, false);
});
test('M16 Lightning Tempest leaves the symbols of your own Spirits alone', async () => {
  const r = await ev(`const mine = sp('${T5}', P), t = sp('${T5}', O); const s0 = BS.attackSymbols(mine); nx('${INDRA}', P, 0); ${cast(TEMPEST)} return [ok, BS.attackSymbols(mine) === s0, BS.attackSymbols(t)];`);
  assert.deepEqual(r, [true, true, 0]);
});
test('M17 Lightning Tempest is not usable against an empty opposing board', async () => {
  const r = await ev(`nx('${INDRA}', P, 0); const m = hd('${TEMPEST}'); return BS.magicUsable(P, m, 'flash');`);
  assert.equal(r, false);
});
test('M18 Dana Draw is Main only; a Flash-timing Magic card can also be cast in the Main Step', async () => {
  const r = await ev(`for (let i = 0; i < 4; i++) dk('${T3}'); const d = hd('${DANA}'); sp('${T5}', O); const b = hd('${BULLET}'); return [BS.magicUsable(P, d, 'flash'), BS.magicUsable(P, d, 'main'), BS.magicUsable(P, b, 'main')];`);
  assert.deepEqual(r, [false, true, true]);
});
test('M19 Hades Disaster is not usable when every opposing Spirit holds three cores or more', async () => {
  const r = await ev(`sp('${T4}', O, 3); const m = hd('${HADES}'); return BS.magicUsable(P, m, 'flash');`);
  assert.equal(r, false);
});
test('M20 Plutonic Wall is wired since v0.47 (AB_CORE_TAX_TURN, usable from the Trash)', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [c.magic.effect, !!c.implemented, !!c.magic.trashUse]; }, PLUTO);
  assert.deepEqual(r, ['ACTIONS', true, true]);
});
