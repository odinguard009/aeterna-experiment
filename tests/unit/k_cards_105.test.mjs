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

test('K-1157 BS74-012 Notosaurus: Flash summon needs five counters and a Soul Core to send; costs are treated as paid, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const n = BS.mkInst('BS74-012'); const nx = BS.mkInst('BS74-CX01'); nx.soul = false; P.nexus = [nx]; P.hand = [n]; P.reserve.n = 3; P.reserve.soul = true; P.trashCores.soul = false;
    P.count = 4; const a = highSpeedOK(P, n); P.count = 5; const b = highSpeedOK(P, n);
    await highSpeedSummon(P, n);
    return { a, b, onField: P.spirits.some(s => s.id === 'BS74-012'), soul: nx.soul, viaHS: P.spirits[0] && P.spirits[0].viaHS, res: P.reserve.n }; })()`);
  assert.deepEqual(r, { a: false, b: true, onField: true, soul: true, viaHS: true, res: 1 }); // the Nexus' Neo-Core Charge moves one more core onto the new Lava Fish
});

test('K-1158 BS74-012 Notosaurus: When Summoned destroys up to three Spirits; the BP limit is 7000 + 1000 per counter', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const n = BS.mkInst('BS74-012'); P.spirits = [n]; n.cores = 1;
    const mk = (bp) => { const t = BS.mkInst(sp(x => x.levels[0].bp === bp)); t.cores = 1; return t; };
    O.spirits = [mk(9000), mk(9000)]; P.count = 1; const k = BS.CARDS['BS74-012'];
    const acts = k.effects[0].actions; const cands = (cnt) => { P.count = cnt; return FX_ACTIONS.DESTROY.cands({ p: P, opp: O, src: n, ctx: {} }, acts[0]).length; };
    return { lo: cands(1), hi: cands(2), partial: k.partial, n: acts[0].n }; })()`);
  assert.deepEqual(r, { lo: 0, hi: 2, partial: false, n: 3 });
});

test('K-1159 BS74-006 Aquilo-Lamda: counter +1, and the Soul Core makes the Nexus destruction unpreventable', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const s = BS.mkInst('BS74-006'); s.cores = 3; P.spirits = [s]; const nx = BS.mkInst('BS74-CX01'); nx.soul = false; P.nexus = [nx]; P.reserve.soul = true; P.count = 0;
    const t = BS.mkInst('BS74-CX01'); O.nexus = [t]; O.nexus[0].cores = 3;
    await BS.fireFx(P, 'SUMMONED', s, {});
    return { count: P.count, hit: O.nexus.length === 0 || O.nexus[0].cores < 3, noPrevent: !!(BS.CARDS['BS74-006'].effects[0].actions[2].do === 'SOUL_NO_PREVENT'), soul: nx.soul, partial: BS.CARDS['BS74-006'].partial }; })()`);
  assert.ok(r.count >= 1, JSON.stringify(r)); assert.ok(r.hit && r.noPrevent, JSON.stringify(r)); assert.equal(r.soul, true, JSON.stringify(r)); assert.equal(r.partial, false);
});

test('K-1160 BS74-001 Eurymeteos: High Speed on the opposing turn only; When Summoned that way deploys a Contractor Ometeotl from the Trash free', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const e = BS.mkInst('BS74-001'); P.hand = [e]; P.reserve.n = 5; P.nexus = []; P.trash = [BS.mkInst('BS74-CX01')];
    G.active = P.key; const mine = highSpeedOK(P, e); G.active = O.key; const theirs = highSpeedOK(P, e);
    await highSpeedSummon(P, e);
    return { mine, theirs, nexus: P.nexus.length, trash: P.trash.length, partial: BS.CARDS['BS74-001'].partial }; })()`);
  assert.deepEqual(r, { mine: false, theirs: true, nexus: 1, trash: 3, partial: false }); // the revived Nexus' own When Summoned trashes 3 deck cards
});

test('K-1161 BS74-CX01 Nexus: complete, Revive flag, Flash Destroy needs 5 Nexus cores or the Soul Core; summon trashes 3 deck cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const k = BS.CARDS['BS74-CX01'];
    const kinds = k.effects.map(e => e.trigger + ':' + (e.actions || []).map(a => a.do).join('+'));
    const nx = BS.mkInst('BS74-CX01'); nx.soul = true; P.nexus = [nx]; P.count = 0;
    const d0 = P.deck.length; const t0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', nx, {});
    return { partial: k.partial, revive: !!k.revive, kinds, moved: (d0 - P.deck.length) <= 3 }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.revive, true);
  assert.ok(r.kinds.some(s => s.startsWith('ACTIVATE:DESTROY')), JSON.stringify(r.kinds));
  assert.ok(r.kinds.some(s => s.includes('SOUL_CORE_TO_TRASH+DESTROY')), JSON.stringify(r.kinds));
  assert.ok(r.kinds.some(s => s.startsWith('SUMMONED:DECK_TO_TRASH_CORES')), JSON.stringify(r.kinds)); assert.ok(r.moved);
});

test('K-1162 BS74-X13 Aztlan: Soul Unleash Flash moves the Soul Core from the Nexus onto it; destroys up to two with 3 symbols total', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const z = BS.mkInst('BS74-X13'); const nx = BS.mkInst('BS74-CX01'); nx.soul = true; P.nexus = [nx]; P.hand = [z]; P.reserve.n = 0; P.count = 6;
    const o = BS.mkInst('BS74-X13'); o.cores = 0; P.spirits = [o]; P.spirits = [];
    const ok = highSpeedOK(P, z); await highSpeedSummon(P, z);
    const a = P.spirits.find(s => s.id === 'BS74-X13');
    const mk = (sy) => { const t = BS.mkInst(sp(x => x.symbols === sy)); t.cores = 1; return t; };
    O.nexus = []; O.spirits = [mk(1), mk(1), mk(1)];
    a.cores = 5; await BS.fireFx(P, 'SUMMONED', a, {});
    return { ok, nxSoul: nx.soul, spSoul: a.soul, left: O.spirits.length, partial: BS.CARDS['BS74-X13'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.nxSoul, false); assert.equal(r.spSoul, true);
  assert.equal(r.left, 1, JSON.stringify(r)); assert.equal(r.partial, false);
});
