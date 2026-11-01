// v0.55.2 Burst resolution order (JP 17.0 revision notice item 6, docs/manual-notes.md): a Burst declared for an event
// resolves after every non-Burst triggered effect of that event; several Bursts resolve in declaration order, the
// non-turn player's first. flushBursts() runs the queued events (When Destroyed, ally lost, opposing Hand increased) first.
// rules: ETR:burst@0f4eac30
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
const FIX = [
  { id: 'T552-DIE', name: 'Order Dier', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'DESTROYED', actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T552-HND', name: 'Order Hand Watcher', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'OPP_HAND_UP', actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T552-BD', name: 'Order Burst Destroyed', type: 'Magic', color: 'red', cost: 3, burst: { when: 'ALLY_DESTROYED', actions: [{ do: 'COUNTER', n: 5 }] } },
  { id: 'T552-BH', name: 'Order Burst Hand', type: 'Magic', color: 'red', cost: 3, burst: { when: 'OPP_HAND_UP', actions: [{ do: 'COUNTER', n: 5 }] } },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const bu = (id, q = P) => { const i = BS.mkInst(id); q.burst = i; return i; };
  const at = (re, from = 0) => G.history.findIndex((t, k) => k >= from && re.test(String(t)));`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('B552-01 (When Destroyed) resolves before the "after your Spirit is destroyed" Burst of the same destruction', async () => {
  const r = await ev(`const s = sp('T552-DIE'); bu('T552-BD'); const h = G.history.length; BS.removeSpirit(P, s, 'destroyed', true);
    let seen = null; const A = BS.FX_ACTIONS.COUNTER, run = A.run; const order = [];
    A.run = function (c, a) { order.push(c.burst ? 'burst' : 'fx'); return run.apply(this, arguments); };
    try { await BS.flushBursts(); } finally { A.run = run; } return [order, P.count, P.burst];`);
  assert.deepEqual(r, [['fx', 'burst'], 6, null]);
});
test('B552-02 (When the opposing Hand increases) effects resolve before the OPP_HAND_UP Burst', async () => {
  const r = await ev(`sp('T552-HND'); bu('T552-BH'); BS.handUp(O, 1);
    const A = BS.FX_ACTIONS.COUNTER, run = A.run; const order = [];
    A.run = function (c, a) { order.push(c.burst ? 'burst' : 'fx'); return run.apply(this, arguments); };
    try { await BS.flushBursts(); } finally { A.run = run; } return [order, P.count];`);
  assert.deepEqual(r, [['fx', 'burst'], 6]);
});
test('B552-03 several Bursts: the non-turn player resolves first, even when declared second', async () => {
  const r = await ev(`const a = sp('T552-DIE'), b = sp('T552-DIE', O); bu('T552-BD'); bu('T552-BD', O);
    BS.removeSpirit(P, a, 'destroyed', true); BS.removeSpirit(O, b, 'destroyed', true);
    const A = BS.FX_ACTIONS.COUNTER, run = A.run; const order = [];
    A.run = function (c, a) { order.push((c.burst ? 'burst-' : 'fx-') + c.p.key); return run.apply(this, arguments); };
    try { await BS.flushBursts(); } finally { A.run = run; } return order;`);
  assert.deepEqual(r, ['fx-player', 'fx-opponent', 'burst-opponent', 'burst-player']);
});
test('B552-04 scenario burst-after-when-destroyed (real cards BS11-009 + Burst BS71-083): (When Destroyed) draw, then the Burst', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/burst-after-when-destroyed.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    const ld = BS.loadScenario(s); if (!ld.ok) return ld.error; BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const keep = {}, order = [];
    for (const k of ['DRAW', 'DESTROY_TOTAL']) { const A = BS.FX_ACTIONS[k]; keep[k] = A.run; A.run = function (c, a) { order.push((c.burst ? 'burst-' : 'fx-') + k); return keep[k].apply(this, arguments); }; }
    const blk = O.spirits[0]; window.cpuChooseBlock = () => blk;
    try { await BS.doBattle('player', P.spirits[0]); } finally { for (const k in keep) BS.FX_ACTIONS[k].run = keep[k]; }
    return [order, O.spirits.includes(blk), O.burst];
  }, spec);
  assert.deepEqual(r, [['fx-DRAW', 'burst-DESTROY_TOTAL'], false, null]);
});
