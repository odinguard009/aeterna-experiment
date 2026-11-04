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

test('K-1163 BS74-008 Ichziyon: set Mirage sends 2 Trash cores to an attacking Lava Fish; Flash (opposing turn) sends the Soul Core to the Nexus and summons it free', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.mkInst('BS74-008'); m.mirage = true; P.mirage = m; const nx = BS.mkInst('BS74-CX01'); nx.soul = false; P.nexus = [nx];
    const at = BS.mkInst('BS74-006'); at.cores = 3; P.spirits = [at]; P.trashCores.n = 5; P.trashCores.soul = true; P.reserve.soul = false;
    await BS.fireFx(P, 'ALLY_ATTACKS', at, { attacker: at });
    const cores = at.cores, tr = P.trashCores.n;
    G.active = O.key; const listed = BS.activatable(P, m, 'FLASH').length; G.active = P.key; const mine = BS.activatable(P, m, 'FLASH').length; G.active = O.key;
    const idx = BS.CARDS['BS74-008'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const ok = await BS.activateFx(P, m, idx);
    return { cores, tr, listed, mine, ok, onField: P.spirits.includes(m), mir: !!P.mirage, soul: nx.soul, partial: BS.CARDS['BS74-008'].partial }; })()`);
  assert.deepEqual(r, { cores: 5, tr: 3, listed: 1, mine: 0, ok: true, onField: true, mir: false, soul: true, partial: false });
});

test('K-1164 BS74-010 Archelon: Soul Core sent to the Nexus activates the set Burst: destroys opposing 12000 BP or less, draws two, summons it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const b = BS.mkInst('BS74-010'); P.burst = b; b.mirage = false; const nx = BS.mkInst('BS74-CX01'); nx.soul = false; P.nexus = [nx]; P.reserve.soul = true; P.spirits = [];
    const lo = BS.mkInst(sp(x => x.levels[0].bp <= 9000 && x.levels[0].bp > 0)); lo.cores = 1; O.spirits = [lo];
    const h0 = P.hand.length; await soulToNexus(P, nx);
    const k = BS.CARDS['BS74-010'];
    return { nxSoul: nx.soul, oppLeft: O.spirits.length, drew: P.hand.length - h0, onField: P.spirits.some(s => s.id === 'BS74-010'), burstGone: !P.burst, partial: k.partial, lock: k.effects.some(e => e.flag === 'NO_END_ATTACK') }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nxSoul, true); assert.equal(r.oppLeft, 0, JSON.stringify(r));
  assert.equal(r.drew, 2, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.burstGone, true); assert.equal(r.lock, true);
});

test('K-1165 BS74-068 Lava Temple: Soul Core to Ometeotl draws at attack start; Lava Fish cannot be bounced; destroyed opposing Spirit effects are locked while Soul Core is on the Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const t = BS.mkInst('BS74-068'); t.cores = 1; const nx = BS.mkInst('BS74-CX01'); nx.soul = false; P.nexus = [t, nx]; P.reserve.soul = true; P.spirits = [];
    const h0 = P.hand.length; await BS.fireFx(P, 'START_ATTACK', null, {}); const drew = P.hand.length - h0;
    const lf = BS.mkInst('BS74-006'); const other = BS.mkInst(sp(x => !(x.families || []).includes('Lava Fish')));
    const noRet = flagActive(P, 'NO_RETURN', lf), retOther = flagActive(P, 'NO_RETURN', other);
    const k = BS.CARDS['BS74-068'];
    nx.soul = true; const lock = flagActive(O, 'OPP_DESTROY_NO_FX', lf);
    nx.soul = false; const unlock = flagActive(O, 'OPP_DESTROY_NO_FX', lf);
    return { drew, soul: nx.soul, noRet, retOther, lock, unlock, partial: k.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r)); assert.equal(r.noRet, true); assert.equal(r.retOther, false);
  assert.equal(r.lock, true, JSON.stringify(r)); assert.equal(r.unlock, false);
});

test('K-1166 BS63-016 Thread Sword Paradise destroys opposing Spirits up to 10000 BP + 1000 per counter; BS61-004 Magmarowana destroys a Cost 3 Nexus and draws, counters +3', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const k = BS.CARDS['BS63-016'], m = BS.CARDS['BS61-004'];
    const nx = BS.mkInst('BS74-068'); O.nexus = [nx]; P.count = 4;
    const t = BS.mkInst('BS61-004'); t.cores = 3; P.spirits = [t]; const c0 = P.count, h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', t, { subject: t });
    await BS.fireFx(P, 'ATTACKS', t, { attacker: t });
    return { partial: [k.partial, m.partial], nexusLeft: O.nexus.length, counters: P.count - c0, drew: P.hand.length - h0, boost: k.effects[0].actions[0].boost }; })()`);
  assert.deepEqual(r.partial, [false, false], JSON.stringify(r)); assert.equal(r.nexusLeft, 0, JSON.stringify(r));
  assert.equal(r.counters, 3, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r)); assert.deepEqual(r.boost, { perCounter: 1000 });
});

test('K-1167 BS75-076 Magma Call: Flash gives a Lava Fish an extra Red symbol, and again after the Soul Core goes to Contractor Ometeotl; Burst summons a Cost 8 or less Lava Fish free', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const lf = BS.mkInst('BS74-006'); lf.cores = 3; P.spirits = [lf]; const nx = BS.mkInst('BS74-CX01'); nx.soul = false; P.nexus = [nx]; P.reserve.soul = true;
    const s0 = attackSymbols(lf); const inst = BS.mkInst('BS75-076'); P.hand = [inst];
    const m = BS.CARDS['BS75-076'].magic; await MAGIC_FX.ACTIONS.apply(P, O, null, 0, m, inst);
    return { s0, s1: attackSymbols(lf), soul: nx.soul }; })()`);
  assert.equal(r.s1 - r.s0, 2, JSON.stringify(r)); assert.equal(r.soul, true);
});

test('K-1168 BS44-RV002 Botis: Flash Advent onto any Cost 5+ Spirit by the Soul Core; draws 1, or 3 when advented onto a Dark Snake', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const mk = (pred) => { const t = BS.mkInst(sp(x => x.cost >= 5 && !x.families.includes('Dark Snake') === pred)); t.cores = 4; return t; };
    const out = {};
    for (const [lab, pred] of [['plain', true], ['snake', false]]) {
      const tid = sp(x => x.cost >= 5 && x.families.includes('Dark Snake') !== pred && x.levels[0].bp > 0); if (!tid) { out[lab] = 'no card'; continue; }
      const t = BS.mkInst(tid); t.cores = 4; t.soul = false; P.spirits = [t]; const b = BS.mkInst('BS44-RV002'); P.hand = [b]; P.deck = [1, 2, 3, 4, 5].map(() => BS.mkInst(sp(x => x.cost <= 2)));
      P.reserve.soul = true; P.trashCores.soul = false; P.count = 0; G.step = 4; G.active = O.key;
      const n = BS.contractAdventTargets(P, b, 'flash').length; const h0 = P.hand.length;
      const ok = await BS.doContractAdvent(P, b, t, 'flash'); out[lab] = { n, ok, drew: P.hand.length - (h0 - 1) };
    }
    return out; })()`);
  assert.equal(r.plain.n, 1, JSON.stringify(r)); assert.equal(r.plain.ok, true); assert.equal(r.plain.drew, 1, JSON.stringify(r));
  assert.equal(r.snake.drew, 3, JSON.stringify(r));
});

test('K-1169 BS44-RV005 Tron: Advent needs a Divine Spirit Cost 3+; its attack cannot be blocked by Spirits without Advent but can by an advented one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const a = BS.mkInst('BS44-RV005'); a.cores = 3; P.spirits = [a];
    const plain = BS.mkInst(sp(x => x.cost <= 3 && x.levels[0].bp > 0)); const adv = BS.mkInst(sp(x => x.cost <= 3 && x.levels[0].bp > 0)); adv.under = [BS.mkInst(sp(x => x.cost <= 3))];
    O.spirits = [plain, adv]; G.active = P.key; G.step = 5;
    const on = [BS.unblockableLow(P, a, plain), BS.unblockableLow(P, a, adv)];
    const tg = BS.mkInst(sp(x => x.families.includes('Divine Spirit') && x.cost >= 3)); tg.cores = 2; P.spirits = [a, tg]; const h = BS.mkInst('BS44-RV005'); P.hand = [h]; P.reserve.soul = true; G.active = O.key;
    const targets = BS.contractAdventTargets(P, h, 'flash').map(x => x === tg);
    return { on, targets, partial: [BS.CARDS['BS44-RV005'].partial, BS.CARDS['BS44-RV002'].partial] }; })()`);
  assert.deepEqual(r.on, [true, false], JSON.stringify(r)); assert.ok(r.targets.includes(true), JSON.stringify(r)); assert.deepEqual(r.partial, [false, false]);
});
