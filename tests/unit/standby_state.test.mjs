// v0.57.0 Standby state (JP 17.0 revision notice item 4, docs/manual-notes.md): "a card leaving the Field waits in
// Standby while its leave triggers resolve, then it goes to the Trash or its destination; its symbols still reduce
// costs; cores go to the Reserve". The engine keeps such a card in p.standby until every queued event that names it
// (When Destroyed, ally lost) has resolved; a card with no leave trigger goes to its destination at once.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
const FIX = [
  { id: 'T557-DIE', name: 'Standby Dier', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'DESTROYED', actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T557-LOST', name: 'Standby Lost Watcher', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'ALLY_LOST', actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T557-VAN', name: 'Standby Vanilla', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T557-LV2', name: 'Standby Level Two', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 1000 }, { cores: 3, bp: 3000 }], effects: [{ trigger: 'DESTROYED', lv: [2], actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T557-CON', name: 'Standby Contract', type: 'Spirit', color: 'red', cost: 3, symbols: 1, contract: true, levels: [{ cores: 1, bp: 2000 }], effects: [{ trigger: 'DESTROYED', actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T557-BRV', name: 'Standby Brave', type: 'Brave', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], brave: { bp: 2000 } },
  { id: 'T557-RED', name: 'Standby Reduced', type: 'Spirit', color: 'red', cost: 4, reduction: { red: 1 }, symbols: 1, levels: [{ cores: 1, bp: 3000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.standby = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const spy = f => { const A = BS.FX_ACTIONS.COUNTER, run = A.run; A.run = function (c, a) { f(c); return run.apply(this, arguments); }; return () => { A.run = run; }; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('S557-01 (When Destroyed) resolves while the card waits in Standby: not in the Trash yet, cores already in the Reserve', async () => {
  const r = await ev(`const s = sp('T557-DIE', P, 2); const r0 = P.reserve.n; BS.removeSpirit(P, s, 'destroyed', true);
    const mid = [P.standby.includes(s), P.trash.includes(s), P.reserve.n - r0];
    let seen = null; const undo = spy(c => { seen = [P.standby.includes(c.src), P.trash.includes(c.src)]; });
    try { await BS.flushBursts(); } finally { undo(); } return [mid, seen, P.standby.length, P.trash.includes(s), P.count];`);
  assert.deepEqual(r, [[true, false, 2], [true, false], 0, true, 1]);
});
test('S557-02 symbols of a card in Standby still reduce costs; after it reaches the Trash they do not', async () => {
  const r = await ev(`const s = sp('T557-DIE'); const card = BS.CARDS['T557-RED']; const before = BS.effCost(P, card);
    BS.removeSpirit(P, s, 'destroyed', true); let during = null; const undo = spy(() => { during = BS.effCost(P, card); });
    try { await BS.flushBursts(); } finally { undo(); } return [before, during, BS.effCost(P, card)];`);
  assert.deepEqual(r, [3, 3, 4]);
});
test('S557-03 a depleted Spirit waits in Standby while (when an ally is lost) effects resolve, then goes to the Trash', async () => {
  const r = await ev(`sp('T557-LOST'); const s = sp('T557-VAN', P, 0); BS.checkDepletion(P);
    const mid = [P.standby.includes(s), P.trash.includes(s)]; let seen = null; const undo = spy(() => { seen = P.standby.includes(s); });
    try { await BS.flushBursts(); } finally { undo(); } return [mid, seen, P.standby.length, P.trash.includes(s), P.count];`);
  assert.deepEqual(r, [[true, false], true, 0, true, 1]);
});
test('S557-04 a card with no leave trigger goes to its destination at once; a new turn empties Standby', async () => {
  const r = await ev(`const a = sp('T557-VAN'); BS.removeSpirit(P, a, 'destroyed', false); const at1 = [P.standby.length, P.trash.includes(a)];
    const b = sp('T557-DIE'); BS.removeSpirit(P, b, 'destroyed', true); const mid = P.standby.length;
    G.over = true; await BS.flushBursts(); G.over = false; const atOver = [P.standby.length, P.trash.includes(b)];
    const c = sp('T557-DIE'); BS.removeSpirit(P, c, 'destroyed', true);
    await BS.beginTurn('opponent'); return [at1, mid, atOver, P.standby.length, P.trash.includes(c)];`);
  assert.deepEqual(r, [[0, true], 1, [0, true], 0, true]);
});
test('S557-05 a destruction not by the opponent with (When Destroyed) also waits in Standby', async () => {
  const r = await ev(`const s = sp('T557-DIE'); BS.removeSpirit(P, s, 'destroyed', false); const mid = P.standby.includes(s);
    await BS.flushBursts(); return [mid, P.standby.length, P.trash.includes(s), P.count];`);
  assert.deepEqual(r, [true, 0, true, 1]);
});
test('S557-06 depleted with no (when an ally is lost) listener: straight to the Trash, nothing waits', async () => {
  const r = await ev(`const s = sp('T557-VAN', P, 0); BS.checkDepletion(P); return [P.standby.length, P.trash.includes(s)];`);
  assert.deepEqual(r, [0, true]);
});
test('S557-07 destroyed by the opponent with no leave trigger: Trash at once, the Burst check is still queued', async () => {
  const r = await ev(`const s = sp('T557-VAN'); BS.removeSpirit(P, s, 'destroyed', true); return [P.standby.length, P.trash.includes(s), G.burstQ.length];`);
  assert.deepEqual(r, [0, true, 1]);
});
test('S557-08 the Soul Core of a card entering Standby goes to the Reserve at once', async () => {
  const r = await ev(`const s = sp('T557-DIE'); s.soul = true; P.reserve.soul = false; BS.removeSpirit(P, s, 'destroyed', true);
    const mid = [P.standby.includes(s), s.soul, P.reserve.soul]; await BS.flushBursts(); return mid;`);
  assert.deepEqual(r, [true, false, true]);
});
test('S557-09 (When Destroyed) [LV2] uses the level just before Standby', async () => {
  const r = await ev(`const a = sp('T557-LV2', P, 3), b = sp('T557-LV2', P, 1); BS.removeSpirit(P, a, 'destroyed', true); BS.removeSpirit(P, b, 'destroyed', true);
    await BS.flushBursts(); return [P.count, P.standby.length, P.trash.includes(a), P.trash.includes(b)];`);
  assert.deepEqual(r, [1, 0, true, true]);
});
test('S557-10 two cards destroyed together: each leaves Standby right after its own (When Destroyed)', async () => {
  const r = await ev(`const a = sp('T557-DIE'), b = sp('T557-DIE'); BS.removeSpirit(P, a, 'destroyed', true); BS.removeSpirit(P, b, 'destroyed', true);
    const seen = []; const undo = spy(c => seen.push([c.src === a ? 'a' : 'b', P.standby.includes(a), P.trash.includes(a)]));
    try { await BS.flushBursts(); } finally { undo(); } return [seen.length, seen[0][0], seen[1], P.trash.filter(x => x === a || x === b).length];`);
  assert.deepEqual(r, [2, 'a', ['b', false, true], 2]);
});
test('S557-11 a Contract card destroyed by the opponent enters Soul State, not Standby; its (When Destroyed) still resolves', async () => {
  const r = await ev(`const s = sp('T557-CON'); BS.removeSpirit(P, s, 'destroyed', true); const mid = [P.standby.length, P.soulState.includes(s)];
    await BS.flushBursts(); return [mid, P.count, P.trash.includes(s)];`);
  assert.deepEqual(r, [[0, true], 1, false]);
});
test('S557-12 a Brave combined with a Spirit leaving into Standby goes to the Trash at once (its traits leave with it)', async () => {
  const r = await ev(`const s = sp('T557-DIE', P, 2); const b = BS.mkInst('T557-BRV'); s.brave = b; BS.removeSpirit(P, s, 'destroyed', true);
    const mid = [P.standby.includes(s), P.trash.includes(b), !!s.brave]; await BS.flushBursts(); return [mid, P.trash.includes(s)];`);
  assert.deepEqual(r, [[true, true, false], true]);
});
test('S557-13 Standby symbols count for Accel cost reduction too', async () => {
  const r = await ev(`const s = sp('T557-DIE'); const e = { cost: 4, reduction: { red: 1 } }; const before = BS.accelCost(P, e);
    BS.removeSpirit(P, s, 'destroyed', true); let during = null; const undo = spy(() => { during = BS.accelCost(P, e); });
    try { await BS.flushBursts(); } finally { undo(); } return [before, during, BS.accelCost(P, e)];`);
  assert.deepEqual(r, [3, 3, 4]);
});
test('S557-14 a card in Standby is not on the Field: "while you have a red symbol" (Rush) does not see it', async () => {
  const r = await ev(`const s = sp('T557-DIE'); const before = BS.fxIf(P, O, { hasSymbol: 'red' }, {});
    BS.removeSpirit(P, s, 'destroyed', true); let during = null; const undo = spy(() => { during = BS.fxIf(P, O, { hasSymbol: 'red' }, {}); });
    try { await BS.flushBursts(); } finally { undo(); } return [before, during, BS.fieldList(P).includes(s)];`);
  assert.deepEqual(r, [true, false, false]);
});
test('S557-15 "banish one destroyed by this effect" can take the card from Standby; it never reaches the Trash', async () => {
  const r = await ev(`const src = sp('T557-VAN'), t = sp('T557-DIE', O); BS.removeSpirit(O, t, 'destroyed', true);
    const c = { p: P, opp: O, src, ctx: { destroyed: [t] } }; const n = BS.FX_ACTIONS.BANISH_DESTROYED.cands(c).length;
    await BS.FX_ACTIONS.BANISH_DESTROYED.run(c, {}); await BS.flushBursts();
    return [n, O.standby.length, O.trash.includes(t), O.removed.filter(x => x === t).length];`);
  assert.deepEqual(r, [1, 0, false, 1]);
});
test('S557-16 a card summoned out of Standby by an effect leaves Standby and stays on the Field', async () => {
  const r = await ev(`const s = sp('T557-DIE'); BS.removeSpirit(P, s, 'destroyed', true); P.reserve.n = 3; G.evQ.length = 0;
    await BS.summonFree(P, s); BS.releaseStandby && BS.releaseStandby(true); await BS.flushBursts();
    return [P.spirits.includes(s), P.standby.length, P.trash.includes(s)];`);
  assert.deepEqual(r, [true, 0, false]);
});
test('S557-17 a card put into Soul State from Standby leaves Standby', async () => {
  const r = await ev(`const s = sp('T557-DIE'); BS.removeSpirit(P, s, 'destroyed', true); BS.toSoulState(P, s); await BS.flushBursts();
    return [P.soulState.includes(s), P.standby.length, P.trash.includes(s)];`);
  assert.deepEqual(r, [true, 0, false]);
});
test('S557-18 releaseStandby(false) keeps a card whose event is still queued; force releases it', async () => {
  const r = await ev(`const s = sp('T557-DIE'); BS.removeSpirit(P, s, 'destroyed', true); BS.releaseStandby(false); const a = P.standby.length;
    BS.releaseStandby(true); return [a, P.standby.length, P.trash.includes(s)];`);
  assert.deepEqual(r, [1, 0, true]);
});
const SCN = JSON.parse(readFileSync(new URL('../scenarios/burst-after-when-destroyed.json', import.meta.url), 'utf8'));
const battle = body => g.page.evaluate(`(async s => { const ld = BS.loadScenario(s); if (!ld.ok) return ld.error; BS.SETTINGS.speed = 'instant';
  const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true; const blk = O.spirits[0]; window.cpuChooseBlock = () => blk;
  const keep = {}; const wrap = (k, f) => { const A = BS.FX_ACTIONS[k]; keep[k] = A.run; A.run = function (c) { f(c); return keep[k].apply(this, arguments); }; };
  ${body} })(${JSON.stringify(SCN)})`);
test('S557-19 battle (real card BS11-009): its (When Destroyed) draw resolves while it waits in Standby; the Burst after it sees it in the Trash', async () => {
  const r = await battle(`const seen = {}; wrap('DRAW', () => { seen.draw = [O.standby.includes(blk), O.trash.includes(blk)]; });
    wrap('DESTROY_TOTAL', () => { seen.burst = [O.standby.includes(blk), O.trash.includes(blk)]; });
    try { await BS.doBattle('player', P.spirits[0]); } finally { for (const k in keep) BS.FX_ACTIONS[k].run = keep[k]; }
    return [seen.draw, seen.burst, O.standby.length, O.trash.includes(blk)];`);
  assert.deepEqual(r, [[true, false], [false, true], 0, true]);
});
test('S557-20 battle: the card-count invariant holds while a card waits in Standby', async () => {
  const r = await battle(`let ok = null; wrap('DRAW', () => { try { BS.checkInvariants(); ok = O.standby.length === 1; } catch (e) { ok = String(e.message); } });
    try { await BS.doBattle('player', P.spirits[0]); } finally { for (const k in keep) BS.FX_ACTIONS[k].run = keep[k]; } BS.checkInvariants(); return ok;`);
  assert.equal(r, true);
});
