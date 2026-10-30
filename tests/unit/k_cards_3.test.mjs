// Lane K tests, file 3 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SETUP = `const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; q.hand.length = 0; }`;

test('K-147 26RDB01-049: Red Stella Nexus gives +1000 BP in your Attack Step; exhausted Red Stella Spirits are unaffected by opposing Magic (match.exhausted)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RDB01-049'); n.cores = 3; P.nexus.push(n);
    const fx = BS.CARDS['26RDB01-049'].effects;
    const t = BS.mkInst('26RDB01-049'); const m = fx[1].match;
    const ok = x => fxMatch(BS.CARDS[x.id], m, x);
    const A = BS.mkInst('BS48-047'); A.exhausted = true; const B = BS.mkInst('BS48-047');
    return [fx[0].bp, m.team, m.exhausted, fxMatch(BS.CARDS[A.id], { exhausted: true }, A), fxMatch(BS.CARDS[A.id], { exhausted: true }, B), fxMatch(BS.CARDS[A.id], { team: "Red Stella" }, A)]; })()`);
  assert.deepEqual(r, [1000, "Red Stella", true, true, false, false], JSON.stringify(r));
});

test('K-148 26RCB01-053: TRASH_CORES_TO toLife moves a Trash core to the Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const c = { p: P, opp: O, src: BS.mkInst('26RCB01-053'), ctx: {} };
    P.trashCores.n = 2; const l0 = P.life;
    await BS.runActions(c, { actions: [{ do: 'TRASH_CORES_TO', n: 1, toLife: true }] });
    return [P.life - l0, P.trashCores.n, BS.CARDS['26RCB01-053'].effects.length]; })()`);
  assert.deepEqual(r, [1, 1, 3], JSON.stringify(r));
});

test('K-149 26RCB01-047: Brave Fantasy LV2 draws 2 then returns 2 (HAND_TO_BOTTOM n:2 forced)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RCB01-047'].effects[2];
    const c = { p: P, opp: O, src: BS.mkInst('26RCB01-047'), ctx: {} };
    const d0 = P.deck.length; await BS.runActions(c, { actions: fx.actions });
    return [P.hand.length, d0 - P.deck.length, fx.if.ctrl.family]; })()`);
  assert.deepEqual(r, [0, 0, 'EX-AID'], JSON.stringify(r));
});

test('K-150 26RSD10-X02: Swordish BP+2000 in either Attack Step; LV2 sends 1 Token, +1 if two cards are returned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RSD10-X02'].effects;
    return [fx[0].bp, fx[0].if.oppTurn === undefined, fx[1].actions.map(a => a.do).join()]; })()`);
  assert.deepEqual(r, [2000, true, 'SEND_TOKEN,HAND_TO_BOTTOM,SEND_TOKEN'], JSON.stringify(r));
});

test('K-151 26RSD05-009: Thunder Driftways gives attacking Thunder Dragons a bpLe 1000 block mark; LV2 START_MAIN -2000', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RSD05-009'].effects, a = BS.mkInst('BS48-047'), c = { p: P, opp: O, src: BS.mkInst('26RSD05-009'), ctx: { attacker: a } };
    await BS.runActions(c, { actions: fx[0].actions });
    return [a.noBlockBy.bpLe, fx[1].trigger, fx[1].actions[0].n]; })()`);
  assert.deepEqual(r, [1000, 'START_MAIN', 2000], JSON.stringify(r));
});

test('K-152 26RSD10-T001: Swordish token gains an extra Green symbol on START_MAIN and when summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const c = { p: P, opp: O, src: BS.mkInst('26RSD10-T001'), ctx: {} }; P.spirits.push(c.src);
    await BS.runActions(c, { actions: BS.CARDS['26RSD10-T001'].effects[0].actions });
    return [c.src.symTurn.cols.join(), BS.CARDS['26RSD10-T001'].effects.map(e => e.trigger).join()]; })()`);
  assert.deepEqual(r, ['green', 'START_MAIN,SUMMONED'], JSON.stringify(r));
});

test('K-153 BLOCK_TAX: a blocker needs a Reserve core (reserve) or another untapped Spirit (exhaust); payment moves/exhausts', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const att = BS.mkInst('26RSD06-X01'), b1 = BS.mkInst('BS48-047'), b2 = BS.mkInst('BS48-047'); O.spirits.length = 0; O.spirits.push(b1);
    G.battleNo = 9; att.blockTax = { battleNo: 9, kind: 'exhaust' };
    const a0 = blockTaxOK(O, att, b1); O.spirits.push(b2); const a1 = blockTaxOK(O, att, b1);
    O.cpu = true; const paid = await payBlockTax(O, att, b1);
    att.blockTax = { battleNo: 9, kind: 'reserve' }; O.reserve.n = 0; const r0 = blockTaxOK(O, att, b1); O.reserve.n = 2; const t0 = O.trashCores.n;
    await payBlockTax(O, att, b1);
    return [a0, a1, paid, b2.exhausted, b1.exhausted, r0, O.reserve.n, O.trashCores.n - t0, BS.CARDS['26RSD06-X01'].effects[1].actions[0].kind]; })()`);
  assert.deepEqual(r, [false, true, true, true, false, false, 1, 1, 'exhaust'], JSON.stringify(r));
});

test('K-154 UNBLOCKABLE_PICK.costGe (26RCB01-050): the picked Spirit cannot be blocked by Cost 8+ Spirits this turn only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const t = BS.mkInst('BS48-047'), hi = BS.mkInst('BS48-047'), lo = BS.mkInst('BS48-047'); G.turnNo = 11; BS.CARDS[hi.id].cost; t.noBlockTurnCost = { turn: 11, costGe: BS.CARDS[hi.id].cost };
    const a = blockedByMark(t, hi); G.turnNo = 12; const b = blockedByMark(t, hi);
    const fx = BS.CARDS['26RCB01-050'].effects; return [a, b, fx[0].actions[1].costGe, fx[1].actions[0].kind]; })()`);
  assert.deepEqual(r, [true, false, 8, 'reserve'], JSON.stringify(r));
});

test('K-155 26RBS02-X08: Invoke exhausts a Current Spirit for +1 symbol; LV2 refreshes every exhausted Cost 5 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RBS02-X08'].effects, lo = BS.mkInst('BS48-047'), hi = BS.mkInst('26RBS02-X08'); P.spirits.length = 0; P.spirits.push(lo, hi); lo.exhausted = hi.exhausted = true;
    const cl = BS.CARDS[lo.id].cost, ch = BS.CARDS[hi.id].cost;
    const c = { p: P, opp: O, src: hi, ctx: {} }; await BS.runActions(c, { actions: fx[1].actions });
    return [cl <= 5 ? !lo.exhausted : lo.exhausted, ch <= 5 ? !hi.exhausted : hi.exhausted, fx[0].cost.exhaustOwn.match.keyword, fx[1].match.symbolsGe]; })()`);
  assert.deepEqual(r, [true, true, 'Current', 2], JSON.stringify(r));
});

test('K-156 26RBS02-X14: BP_MINUS zeroBottom returns a 0 BP opposing Spirit to the deckbottom; Invoke returnOwn.toHand costLe 6', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RBS02-X14'].effects, t = BS.mkInst('BS48-047'); O.spirits.push(t); t.bpMod = -(bpOf(t) - 4000);
    const c = { p: P, opp: O, src: BS.mkInst('26RBS02-X14'), ctx: {} }, d0 = O.deck.length;
    await BS.runActions(c, { actions: fx[0].actions });
    return [O.spirits.length, O.deck.length - d0, fx[0].if.firstAttack, fx[1].cost.returnOwn.toHand, fx[1].cost.returnOwn.match.costLe]; })()`);
  assert.deepEqual(r, [0, 1, false, true, 6], JSON.stringify(r));
});

test('K-157 26RDB01-053: SUMMON_TAX adds 1 to the opponent summon cost of a Cost 3 or less Spirit on their turn (LV2 only)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const lo = Object.values(BS.CARDS).find(k => k.type === 'Spirit' && k.cost === 3), hi = Object.values(BS.CARDS).find(k => k.type === 'Spirit' && k.cost === 5);
    const n = BS.mkInst('26RDB01-053'); P.nexus.push(n); G.active = 'opponent';
    n.cores = 0; const a = effCost(O, lo), a5 = effCost(O, hi); n.cores = 3; const b = effCost(O, lo), c = effCost(O, hi) - a5; G.active = 'player'; const d = effCost(O, lo);
    return [b - a, c, d - a, BS.CARDS['26RDB01-053'].effects[1].flag]; })()`);
  assert.deepEqual(r, [1, 0, 0, 'SUMMON_TAX'], JSON.stringify(r));
});

test('K-158 26RBS02-040: Leucomyst Amplify Invoke (LV1-2) and LV2 Camou 1 compile', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const k = BS.CARDS['26RBS02-040']; return [true, k.effects[0].lv.join(), k.effects[1].flag, k.effects[1].n]; })()`);
  assert.deepEqual(r, [true, '1,2', 'CAMOU', 1], JSON.stringify(r));
});

test('K-159 BOUNCE_OPP.costTotalLe (26RBS03-X09): returns up to two opposing Spirits whose total cost is 3 or less to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const lo = Object.values(BS.CARDS).find(k => k.type === 'Spirit' && k.cost === 2), hi = Object.values(BS.CARDS).find(k => k.type === 'Spirit' && k.cost === 4), one = Object.values(BS.CARDS).find(k => k.type === 'Spirit' && k.cost === 1);
    const a = BS.mkInst(lo.id), b = BS.mkInst(one.id), h = BS.mkInst(hi.id); for (const x of [a, b, h]) x.cores = 1; O.spirits.push(a, b, h);
    const c = { p: P, opp: O, src: BS.mkInst('26RBS03-X09'), ctx: {} }, act = BS.CARDS['26RBS03-X09'].effects[0].actions[0], d0 = O.deck.length;
    const cand = FX_ACTIONS.BOUNCE_OPP.cands(c, act).length;
    await BS.runActions(c, { actions: [act] });
    return [cand, O.spirits.length, O.deck.length - d0, O.spirits.includes(h)]; })()`);
  assert.deepEqual(r, [2, 1, 2, true], JSON.stringify(r));
});

test('K-160 BOUNCE_OPP.bpOrGe (26RBS02-045): with Legacy the targets are 5000 BP or less OR 8000 BP or more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const mk = bp => { const x = BS.mkInst('BS48-047'); x.cores = 1; x.bpMod = bp - bpOf(x); return x; };
    const lo = mk(4000), mid = mk(6000), hi = mk(9000); O.spirits.push(lo, mid, hi);
    const fx = BS.CARDS['26RBS02-045'].effects, c = { p: P, opp: O, src: BS.mkInst('26RBS02-045'), ctx: {} };
    const a = FX_ACTIONS.BOUNCE_OPP.cands(c, fx[0].actions[0]), b = FX_ACTIONS.BOUNCE_OPP.cands(c, fx[1].actions[0]);
    return [a.length, a[0] === lo, b.length, b.includes(mid), fx[1].if.viaLegacy, fx[2].flag]; })()`);
  assert.deepEqual(r, [1, true, 2, false, true, 'CAMOU'], JSON.stringify(r));
});

test('K-161 OPP_CORES_TO_RESERVE.eachLegacy (26RBS02-X06): sends +1 core per EX Symbol banished via Legacy', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const t = BS.mkInst('BS48-047'); t.cores = 5; O.spirits.push(t); const r0 = O.reserve.n;
    const src = BS.mkInst('26RBS02-X06'); src.legacyN = 2; const c = { p: P, opp: O, src, ctx: {} };
    const fx = BS.CARDS['26RBS02-X06'].effects;
    await BS.runActions(c, { actions: [Object.assign({}, fx[0].actions[1], { if: undefined })] });
    return [O.reserve.n - r0, fx[0].optional, fx[0].actions[1].if.prev, fx[1].if.trashAllColor]; })()`);
  assert.deepEqual(r, [3, true, true, 'purple'], JSON.stringify(r));
});

test('K-162 TREAT_LV2.highest + LOOT.perLegacy (26RBS02-X17): target is treated as its highest level; Legacy scales the loot', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const t = BS.mkInst('26RBS02-X17'); t.cores = 1; P.spirits.push(t);
    const L = BS.CARDS['26RBS02-X17'].levels.length, k0 = lvIndex(t);
    const c = { p: P, opp: O, src: t, ctx: {} };
    const fx = BS.CARDS['26RBS02-X17'].effects;
    t.cores = 1; await BS.runActions(c, { actions: [Object.assign({}, fx[1].actions[0], { if: undefined })] });
    const k1 = lvIndex(t);
    return [L > 1, k1 === L - 1, t.lvHighTurn === true, fx[0].actions[0].perLegacy, k0 <= k1]; })()`);
  assert.deepEqual(r, [true, true, true, true, true], JSON.stringify(r));
});

test('K-163 EXHAUST_OWN (26RCB01-X07): exhausts a matching own Spirit, then REFRESH refreshes the source; none -> did=false', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const src = BS.mkInst('26RCB01-X07'); src.cores = 1; src.exhausted = true; P.spirits.push(src);
    const fx = BS.CARDS['26RCB01-X07'].effects, ex = fx.find(e => e.trigger === 'ATTACKS').actions[0];
    const c0 = { p: P, opp: O, src, ctx: {} }; await BS.runActions(c0, { actions: [ex] }); const none = c0.ctx.did;
    const m = BS.mkInst(ex.match.family ? BS.CARDS[Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('EX-AID') && BS.CARDS[k].type === 'Spirit' && k !== '26RCB01-X07')].id : 'x'); m.cores = 1; P.spirits.push(m);
    const c = { p: P, opp: O, src, ctx: {} }; await BS.runActions(c, { actions: [ex] });
    return [none, m.exhausted, fx.some(e => e.flag === 'UNAFFECTED' && e.if.allHave.family === 'EX-AID')]; })()`);
  assert.deepEqual(r, [false, true, true], JSON.stringify(r));
});
