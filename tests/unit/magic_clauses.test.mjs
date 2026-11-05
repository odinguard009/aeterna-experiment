// v0.47 remaining Magic clauses (session F): sent-to-Trash triggers (Whirling Tide, Thunder Counter, Hades Disaster), use from the Trash
// (Hades Disaster, Plutonic Wall), Plutonic Wall's attack/block core tax, Lightning Tempest (Trash symbols, Hand protection),
// Thunder Counter's Hand trigger at the start of the opposing Attack Step, Dana Draw (pay to use the Main effect after the Burst, Brave-summon activation).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const WT = 'BS71-084', TC = 'BS75-082', LT = 'BS75-083', PW = 'BS68-076', HD = 'BS68-077', DD = 'BS71-083';
const NUA = 'BS71-CX03', IND = 'BS75-CX03', HAD = 'BS68-CX01', HOUND = 'BS68-014', EK = 'BS74-038', SPEAR = 'BS71-063', SCOUT = 'BS71-053';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; G.active = 'player'; G.turnNo = 3; G.attackEnded = 0; G.endAttackAfter = null; G.attacker = null;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.trashCores.n = 0; q.trashCores.soul = false; q.tokens = {}; q.onceUsed = {}; q.life = 5; q.void = 20; q.abTax = 0; }
  for (let k = 0; k < 6; k++) { P.deck.push(BS.mkInst('${EK}')); O.deck.push(BS.mkInst('${EK}')); }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; }, tr = (id, q = P) => { const i = BS.mkInst(id); q.trash.push(i); return i; }, top = (id, q = P) => { const i = BS.mkInst(id); q.deck.unshift(i); return i; };
  const run = async (src, actions, q = P) => BS.runActions({ p: q, opp: G.p[q.key === 'player' ? 'opponent' : 'player'], src, ctx: {} }, { actions });
  const mill = { do: 'DECK_TO_TRASH_CORES', n: 3, match: { family: ['NoSuchFamily'] } };
  const cast = async (q, m, ctx = 'flash') => BS.castMagic(q, { inst: m, target: null, plan: null, ctx });`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('M01 data: five Magic cards are complete; Dana Draw keeps one residual (Burst on depletion)', async () => {
  const r = await g.page.evaluate(ids => ids.map(id => [id, BS.CARDS[id].fxComplete !== false && !(BS.CARDS[id].residual || []).length]), [WT, TC, LT, PW, HD, DD]);
  assert.deepEqual(r.filter(x => !x[1]).map(x => x[0]), []);   // Dana Draw was completed in Lane K (Burst on depletion or destruction)
});
test('M02 Whirling Tide sent from the Deck by Contractor Nuadha: added to the Hand, +1 core from the Void to Nuadha', async () => {
  const r = await ev(`const n = nx('${NUA}'); const w = top('${WT}'); const v = P.void; await run(n, [mill]); return [P.hand.includes(w), P.trash.includes(w), n.cores, v - P.void];`);
  assert.deepEqual(r, [true, false, 1, 1]);
});
test('M03 Whirling Tide sent from the Deck by another card (Hound-Beros) stays in the Trash', async () => {
  const r = await ev(`const n = nx('${NUA}'); const h = sp('${HOUND}'); const w = top('${WT}'); await run(h, [{ do: 'MILL', n: 2 }]); return [P.hand.includes(w), P.trash.includes(w), n.cores];`);
  assert.deepEqual(r, [false, true, 0]);
});
test('M04 Thunder Counter sent from the Deck by Contractor Indra: added to the Hand, +1 core to Indra', async () => {
  const r = await ev(`const n = nx('${IND}'); const w = top('${TC}'); await run(n, [mill]); return [P.hand.includes(w), n.cores];`);
  assert.deepEqual(r, [true, 1]);
});
test('M05 Hades Disaster milled by an Infernal Lord effect stays in the Trash and gives +1 core to the Grandwalker Nexus', async () => {
  const r = await ev(`const n = nx('${HAD}'); const h = sp('${HOUND}'); const w = top('${HD}'); await run(h, [{ do: 'MILL', n: 2 }]); return [P.trash.includes(w), P.hand.includes(w), n.cores];`);
  assert.deepEqual(r, [true, false, 1]);
});
test('M06 Hades Disaster discarded from the Hand by Contractor Hades: +1 core; without a Grandwalker Nexus nothing happens', async () => {
  const r = await ev(`const n = nx('${HAD}'); const w = hd('${HD}'); await run(n, [{ do: 'DISCARD_HAND', n: 1 }]); const a = [P.trash.includes(w), n.cores];
    P.nexus = []; const h = sp('${HOUND}'); top('${HD}'); const v = P.void; await run(h, [{ do: 'MILL', n: 1 }]); return a.concat([v - P.void]);`);
  assert.deepEqual(r, [true, 1, 0]);
});
test('M07 Hades Disaster from the Trash needs Contractor Hades; it destroys a 4-core Spirit and is banished', async () => {
  const r = await ev(`const w = tr('${HD}'); const t = sp('${EK}', O, 4); const a = BS.magicUsable(P, w, 'flash'); nx('${HAD}'); const b = BS.magicUsable(P, w, 'flash');
    await cast(P, w); return [a, b, O.spirits.includes(t), P.trash.includes(w), P.removed.includes(w)];`);
  assert.deepEqual(r, [false, true, false, false, true]);
});
test('M08 Hades Disaster from the Hand only reaches Spirits with two cores or less', async () => {
  const r = await ev(`const w = hd('${HD}'); sp('${EK}', O, 4); const a = BS.magicUsable(P, w, 'flash'); const t = sp('${EK}', O, 2); await cast(P, w); return [a, O.spirits.includes(t), P.trash.includes(w)];`);
  assert.deepEqual(r, [false, false, true]);
});
test('M09 Plutonic Wall from the Trash with Contractor Hades: taxes the opponent this turn and is banished', async () => {
  const r = await ev(`const w = tr('${PW}'); const a = BS.magicUsable(P, w, 'flash'); nx('${HAD}'); await cast(P, w); return [a, O.abTax === G.turnNo, P.removed.includes(w), P.trash.includes(w)];`);
  assert.deepEqual(r, [false, true, true, false]);
});
test('M10 Plutonic Wall tax: a CPU attacker pays a core to the Trash to attack; one without a spare core cannot attack', async () => {
  const r = await ev(`G.active = 'opponent'; O.abTax = G.turnNo; const a = sp('${EK}', O, 1); const c1 = BS.cpuAttackChoice(O); const b = sp('${EK}', O, 3);
    const c2 = BS.cpuAttackChoice(O); await BS.doBattle('opponent', c2); return [c1, c2 === b, b.cores, O.trashCores.n, P.life];`);
  assert.deepEqual(r, [null, true, 2, 1, 4]);
});
test('M11 Plutonic Wall tax on blocking: a blocker without a spare core cannot block, one with a spare core pays it', async () => {
  const r = await ev(`P.abTax = G.turnNo; const a = sp('${EK}', O, 3); const b1 = sp('${EK}', P, 1); G.active = 'opponent'; await BS.doBattle('opponent', a);
    const life1 = P.life; P.spirits = []; const b2 = sp('${EK}', P, 4); b2.bpMod = 9000; a.exhausted = false; await BS.doBattle('opponent', a);
    return [life1, b1.exhausted, P.life, b2.cores, P.trashCores.n];`);
  assert.deepEqual(r, [4, false, 4, 3, 1]);
});
test('M12 Lightning Tempest can use Yellow symbols in the Trash to reduce its cost', async () => {
  const r = await ev(`hd('${LT}'); const a = BS.effCost(P, BS.CARDS['${LT}']); tr('${TC}'); tr('BS75-042'); tr('BS75-043'); const b = BS.effCost(P, BS.CARDS['${LT}']);
    return [a, b, BS.effCost(P, BS.CARDS['BS75-082'])];`);
  assert.deepEqual(r, [6, 4, 4]);   // Thunder Counter itself does not use Trash symbols
});
test('M13 Lightning Tempest in the Hand is unaffected by opposing discard/remove effects', async () => {
  const r = await ev(`const w = hd('${LT}', O); hd('${EK}', O); const src = sp('${EK}'); await run(src, [{ do: 'REMOVE_OPP_HAND', n: 2 }]); return [O.hand.includes(w), O.hand.length];`);
  assert.deepEqual(r, [true, 1]);
});
test('M14 Thunder Counter from the Hand at the start of the opposing Attack Step: CPU pays 2 Indra cores to the Void and the cost', async () => {
  const r = await ev(`const n = nx('${IND}', O, 3); const w = hd('${TC}', O); const a = sp('${EK}', P, 3); G.active = 'player'; await BS.startAttackFx(P);
    return [n.cores, a.noAB, O.trash.includes(w), O.hand.includes(w)];`);
  assert.deepEqual(r, [1, true, true, false]);
});
test('M15 Thunder Counter Hand trigger needs two cores on a Contractor Indra', async () => {
  const r = await ev(`nx('${IND}', O, 1); const w = hd('${TC}', O); const a = sp('${EK}', P, 3); await BS.startAttackFx(P); return [!!a.noAB, O.hand.includes(w)];`);
  assert.deepEqual(r, [false, true]);
});
test('M16 Dana Draw Burst with Contractor Nuadha: the CPU pays to use the Main effect (draw 3, discard 2)', async () => {
  const r = await ev(`nx('${NUA}', O); const t = sp('${EK}', P, 1); const b = BS.mkInst('${DD}'); O.burst = b; const h0 = O.hand.length; await BS.maybeBurst(O, 'ALLY_DESTROYED', {});
    return [O.hand.length - h0, O.trash.includes(b), P.spirits.includes(t)];`);
  assert.deepEqual(r, [1, true, false]);
});
test('M17 Dana Draw activates when a Scalostle Brave is summoned with five counters or more', async () => {
  const r = await ev(`G.active = 'opponent'; nx('${NUA}', O); O.count = 5; const b = BS.mkInst('${DD}'); O.burst = b; const t = sp('${EK}', P, 1);
    const s = sp('${SCOUT}', O, 3); const br = hd('${SPEAR}', O); BS.braveSummon(O, br, s, null); await BS.braveSummonedFx(O, br);
    const a = [O.burst === null, P.spirits.includes(t)]; O.count = 0; const b2 = BS.mkInst('${DD}'); O.burst = b2; const br2 = hd('${SPEAR}', O); const s2 = sp('${SCOUT}', O, 3);
    BS.braveSummon(O, br2, s2, null); await BS.braveSummonedFx(O, br2); return a.concat([O.burst === b2]);`);
  assert.deepEqual(r, [true, false, true]);
});
test('M18 Lightning Tempest: Spirits summoned later in the same turn also have zero symbols', async () => {
  const r = await ev(`nx('${IND}'); const a = sp('${EK}', O, 1); await cast(P, hd('${LT}')); const b = sp('${EK}', O, 1); const x = [BS.attackSymbols(a), BS.attackSymbols(b)]; G.turnNo++; return x.concat([BS.attackSymbols(b)]);`);
  assert.deepEqual(r, [0, 0, 1]);
});
