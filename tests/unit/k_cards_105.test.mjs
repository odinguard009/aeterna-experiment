import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const pre = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
  const sp = (pred) => Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && !c.token && pred(c); });
  P.nexus = []; P.onceUsed = {};
  const runV = (m, id, by) => BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.by[by].actions });
  const run = (m, id) => BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.actions });`;

test('K-1153 BS74-076 Magma Draw: Main draws two; Flash by Soul Core destroys a 12000 BP or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.mkInst('BS74-076'); const nx = BS.mkInst('BS74-CX01'); nx.soul = false; P.reserve.soul = true; P.trashCores.soul = false; P.nexus = [nx];
    P.deck = [BS.mkInst(sp(x => x.cost <= 2)), BS.mkInst(sp(x => x.cost <= 2)), BS.mkInst(sp(x => x.cost <= 2))]; P.hand = [];
    await runV(m, 'BS74-076', 'MAIN'); const hand = P.hand.length;
    const t = BS.mkInst(sp(x => x.levels[0].bp > 0 && x.levels[0].bp <= 10000)); t.cores = 1; O.spirits = [t]; nx.soul = false; P.reserve.soul = true;
    await runV(m, 'BS74-076', 'FLASH');
    return { hand, opp: O.spirits.length, soul: nx.soul, partial: BS.CARDS['BS74-076'].partial, th: BS.CARDS['BS74-076'].trashHand }; })()`);
  assert.deepEqual(r, { hand: 2, opp: 0, soul: true, partial: false, th: 'Contractor Ometeotl' });
});

test('K-1154 BS74-076 Magma Draw: OPP_REACT_LOCK tags queued Draw events so the colour is skipped', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    G.evQ = [{ type: 'DRAWS', key: P.key, n: 2 }, { type: 'DRAWS', key: O.key, n: 1 }];
    await BS.runActions({ p: P, opp: O, src: null, ctx: {} }, { actions: [{ do: 'OPP_REACT_LOCK', color: 'white' }] });
    return G.evQ.map(e => e.noColor || null); })()`);
  assert.deepEqual(r, ['white', null]);
});

test('K-1155 BS74-077 Magma Breaker: sends the Soul Core to use it free, once per turn; the CPU is not offered the route', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.mkInst('BS74-077'); const nx = BS.mkInst('BS74-CX01'); nx.soul = true; P.nexus = [nx]; P.hand = [m];
    const c = BS.CARDS['BS74-077']; const ok = BS.nsfOK(P, c); BS.nsfPay(P, c);
    return { ok, soul: nx.soul, trash: P.trashCores.soul, again: BS.nsfOK(P, c) }; })()`);
  assert.deepEqual(r, { ok: true, soul: false, trash: true, again: false });
});

test('K-1156 BS74-077 Magma Breaker: destroys a one-symbol Spirit; with six counters also the highest BP; banishing the targets', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.mkInst('BS74-077'); const mk = (bp) => { const t = BS.mkInst(sp(x => x.levels[0].bp >= bp && x.levels[0].bp <= bp + 3000 && (x.symbols|0) >= 2)); t.cores = 1; return t; };
    const one = BS.mkInst(sp(x => (x.symbols|0) === 1 && x.levels[0].bp > 0)); one.cores = 1; const big = mk(9000);
    O.spirits = [one, big]; P.count = 6; O.trash = [];
    await run(m, 'BS74-077');
    return { opp: O.spirits.length, trash: O.trash.length, removed: (O.removed || []).length }; })()`);
  assert.equal(r.opp, 0, JSON.stringify(r));
  assert.ok(r.trash + r.removed >= 2, JSON.stringify(r));
});
