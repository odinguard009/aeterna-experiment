import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1149 BS34-071 The World of Owari: God-Sechs Spirits count as highest level in your Attack Step; at LV2 only the highest-BP opposing Spirit can block them', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels.length > 1);
    const gs = BS.mkInst('BS34-016'); gs.cores = 1; P.spirits = [gs];
    const nx = BS.mkInst('BS34-071'); nx.cores = 0; P.nexus = [nx];
    const lv1 = BS.lvIndex(gs);
    nx.cores = 3; const lvNx = BS.lvIndex(gs);
    const weak = BS.mkInst(any), strong = BS.mkInst(any); strong.cores = 5; O.spirits = [weak, strong];
    const can = O.spirits.filter(s => !BS.unblockableLow(P, gs, s)).length;
    G.step = 4; const lvOff = BS.lvIndex(gs);
    return { lv1, lvNx, can, lvOff, partial: BS.CARDS['BS34-071'].partial, strongBp: BS.bpOf(strong), weakBp: BS.bpOf(weak) }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r));
  assert.equal(r.lv1, 2, JSON.stringify(r)); assert.equal(r.lvNx, 2, JSON.stringify(r)); assert.equal(r.lvOff, 0, JSON.stringify(r));
  assert.equal(r.can, 1, JSON.stringify(r));
});

test('K-1150 BS34-075 The HeavenlyDemonKing Advents: returns a purple/white Spirit from the Trash, then summons Type Destroy from the Hand free when a God-Sechs is in the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const z = BS.mkInst('BS34-016'), d = BS.mkInst('BS34-XX02'); P.trash = [z]; P.hand = [d]; P.spirits = []; P.reserve.n = 10;
    const m = BS.mkInst('BS34-075');
    await BS.FX_ACTIONS.RETURN_TRASH.run({ p: P, opp: O, src: m, ctx: {} }, BS.CARDS['BS34-075'].magic.actions[0]);
    const back = P.hand.some(h => h.id === 'BS34-016');
    P.trash = [BS.mkInst('BS34-016')]; P.hand = [d];
    const c = { p: P, opp: O, src: m, ctx: {} }; const a = BS.CARDS['BS34-075'].magic.actions[1];
    await BS.runActions(c, { actions: [a] });
    return { back, summoned: P.spirits.some(s => s.id === 'BS34-XX02'), partial: BS.CARDS['BS34-075'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r));
});

test('K-1151 BS34-XX02 Type Destroy: summoned free from the Hand by returning a God-Sechs after its attack; Rush 4 destroys one opposing Spirit per symbol colour', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const gs = BS.mkInst('SD32-X02'); gs.cores = 2; P.spirits = [gs]; const d = BS.mkInst('BS34-XX02'); P.hand = [d]; P.reserve.n = 10;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: gs, attacker: gs });
    const summoned = P.spirits.some(s => s.id === 'BS34-XX02'), back = P.hand.some(h => h.id === 'SD32-X02');
    const d2 = BS.mkInst('BS34-XX02'); P.hand = [];  P.trash = [d2]; P.spirits = [BS.mkInst('BS34-XX02')];
    const sp = P.spirits[0]; const fromTrashBefore = P.trash.length;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: sp, attacker: sp });
    const noRetNonExact = P.trash.length === fromTrashBefore;
    const cols = ['red','purple','green','yellow','blue','white'];
    const byColor = {}; for (const k of Object.keys(BS.CARDS)) { const c = BS.CARDS[k]; if (c.type === 'Spirit' && !c.token && (c.colors || [c.symbol]).length === 1 && c.symbols >= 1 && !byColor[c.symbol]) byColor[c.symbol] = k; }
    O.spirits = cols.filter(k => byColor[k]).map(k => BS.mkInst(byColor[k]));
    const n0 = O.spirits.length;
    const src = BS.mkInst('BS34-XX02'); src.soul = true; P.spirits = [src].concat(Object.values(byColor).map(k => { const q = BS.mkInst(k); q.cores = 5; return q; }));
    const syms = BS.symbolsOn(P); const nsym = cols.filter(k => (syms[k] || 0) >= 1).length;
    O.burst = BS.mkInst('BS34-016');
    await BS.runActions({ p: P, opp: O, src, ctx: { selfInst: src } }, { actions: [BS.CARDS['BS34-XX02'].effects[2].actions[1]] });
    return { summoned, back, noRetNonExact, n0, left: O.spirits.length, nsym, partial: BS.CARDS['BS34-XX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r));
  assert.equal(r.noRetNonExact, true, JSON.stringify(r)); assert.ok(r.nsym >= 4, JSON.stringify(r)); assert.equal(r.left, r.n0 - r.nsym, JSON.stringify(r));
});

test('K-1152 BS35-041 Type Five: also Green/Yellow, refreshes at the end of battle, Rush 5 makes the other God-Sechs unblockable this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const src = BS.mkInst('BS35-041'); src.cores = 2; P.spirits = [src];
    const sy = BS.symbolsOn(P); const both = (sy.green || 0) >= 1 && (sy.yellow || 0) >= 1;
    const E = BS.CARDS['BS35-041'].effects;
    G.attacker = src; G.eob = []; src.exhausted = true;
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: E[1].actions });
    await BS.endOfBattle(); const refreshed = !src.exhausted; G.eob = null; G.attacker = null;
    const gs = BS.mkInst('SD32-X02'), other = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !/God-Sechs/.test(BS.CARDS[k].name) && BS.CARDS[k].symbols >= 1));
    const byColor = {}; for (const k of Object.keys(BS.CARDS)) { const c = BS.CARDS[k]; if (c.type === 'Spirit' && !c.token && (c.colors || [c.symbol]).length === 1 && c.symbols >= 1 && !byColor[c.symbol]) byColor[c.symbol] = k; }
    P.spirits = [src, gs, other].concat(Object.values(byColor).map(k => { const q = BS.mkInst(k); q.cores = 5; return q; }));
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: E[2].actions });
    return { both, refreshed, gsFree: gs.noBlockTurn === G.turnNo, srcFree: src.noBlockTurn === G.turnNo, otherFree: other.noBlockTurn === G.turnNo, partial: BS.CARDS['BS35-041'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.both, true, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r));
  assert.equal(r.gsFree, true, JSON.stringify(r)); assert.equal(r.srcFree, false, JSON.stringify(r)); assert.equal(r.otherFree, false, JSON.stringify(r));
});
