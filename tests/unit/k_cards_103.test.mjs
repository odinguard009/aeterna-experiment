import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const pre = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
  const sp = (pred) => Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && !c.token && pred(c); });
  P.nexus = []; P.onceUsed = {};`;

test('K-1126 BS65-013 Silkie: When Summoned summons Camus from Soul State (reductions fulfilled) and sends an opposing core to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const s = BS.mkInst('BS65-013'); s.cores = 1; P.spirits = [s];
    const cam = BS.mkInst('BS65-CX01'); cam.inSoulState = true; P.soulState = [cam];
    const t = BS.mkInst(sp(c => c.cost >= 3)); t.cores = 3; O.spirits = [t]; O.reserve.n = 0;
    P.reserve.n = 4; const before = P.reserve.n;
    await BS.fireFx(P, 'SUMMONED', s, {});
    return { onField: P.spirits.includes(cam), soul: P.soulState.length, opp: t.cores, paid: before - P.reserve.n - cam.cores, partial: BS.CARDS['BS65-013'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.soul, 0, JSON.stringify(r));
  assert.equal(r.opp, 2, JSON.stringify(r)); assert.equal(r.paid, 0, JSON.stringify(r));
});

test('K-1127 BS65-013 Silkie: no Camus in Soul State means no core is sent', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const s = BS.mkInst('BS65-013'); s.cores = 1; P.spirits = [s]; P.soulState = [];
    const t = BS.mkInst(sp(c => c.cost >= 3)); t.cores = 3; O.spirits = [t];
    await BS.fireFx(P, 'SUMMONED', s, {}); return { opp: t.cores, n: P.spirits.length }; })()`);
  assert.equal(r.opp, 3, JSON.stringify(r)); assert.equal(r.n, 1, JSON.stringify(r));
});

test('K-1128 BS65-013 Silkie: LV2 When Attacks sets a Blood Crystal Mirage from the Trash, only with no Mirage set', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const s = BS.mkInst('BS65-013'); s.cores = 3; P.spirits = [s];
    const j = BS.mkInst('BS60-014'); P.trash = [j]; P.mirage = null;
    await BS.fireFx(P, 'ATTACKS', s, {});
    const first = P.mirage === j, trashAfter = P.trash.length;
    const j2 = BS.mkInst('BS60-014'); P.trash = [j2]; await BS.fireFx(P, 'ATTACKS', s, {});
    return { first, trashAfter, second: P.mirage === j2 }; })()`);
  assert.equal(r.first, true, JSON.stringify(r)); assert.equal(r.trashAfter, 0, JSON.stringify(r)); assert.equal(r.second, false, JSON.stringify(r));
});

test('K-1129 BS73-066 Headspring: NEXUS_DOWN deploys it from the Trash paying 1 cost, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const nyx = BS.mkInst('BS72-CX02'); nyx.cores = 3; P.nexus = [nyx];
    const h = BS.mkInst('BS73-066'); P.trash = [h]; P.reserve.n = 6; G.turnNo = 7; P.onceUsed = {};
    await BS.fireFx(P, 'NEXUS_DOWN', nyx, {});
    return { onField: P.nexus.includes(h), trash: P.trash.length, reserve: P.reserve.n, partial: BS.CARDS['BS73-066'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r));
  assert.ok(r.reserve <= 5, JSON.stringify(r));
});

test('K-1130 BS73-066 Headspring: opposing Spirit exhausted draws a card (Lv1); not for an own Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const h = BS.mkInst('BS73-066'); h.cores = 1; P.nexus = [h]; P.deck = [BS.mkInst(sp(c => c.cost <= 2)), BS.mkInst(sp(c => c.cost <= 2))]; P.hand = [];
    await BS.fireFx(P, 'EXHAUSTED_FX', null, { side: 'opp' }); const a = P.hand.length;
    await BS.fireFx(P, 'EXHAUSTED_FX', null, { side: 'own', subject: null }); return { a, b: P.hand.length }; })()`);
  assert.equal(r.a, 1, JSON.stringify(r)); assert.equal(r.b, 1, JSON.stringify(r));
});

test('K-1131 BS73-066 Headspring Lv2: a Spirit that gets cores in the Main Step is exhausted; Lv1 and other steps do not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    BS.FX_ACTIONS.TEST_PUT = { chk: () => true, can: () => true, run: async c => { c.p.spirits[0].cores++; } };
    const h = BS.mkInst('BS73-066'); h.cores = 2; P.nexus = [h]; G.step = 4; G.turnNo = 3;
    const s = BS.mkInst(sp(c => c.cost <= 3)); s.cores = 1; P.spirits = [s]; s.exhausted = false;
    const main = BS.isMainStep();
    await BS.runActions({ p: P, opp: O, src: h, ctx: {} }, { actions: [{ do: 'TEST_PUT' }] }, 'MAIN'); const lv2 = s.exhausted;
    s.exhausted = false; h.cores = 1; await BS.runActions({ p: P, opp: O, src: h, ctx: {} }, { actions: [{ do: 'TEST_PUT' }] }, 'MAIN'); const lv1 = s.exhausted;
    h.cores = 2; G.step = 3; await BS.runActions({ p: P, opp: O, src: h, ctx: {} }, { actions: [{ do: 'TEST_PUT' }] }, 'MAIN'); const attack = s.exhausted;
    delete BS.FX_ACTIONS.TEST_PUT; return { main, lv2, lv1, attack }; })()`);
  assert.equal(r.main, true, JSON.stringify(r)); assert.equal(r.lv2, true, JSON.stringify(r)); assert.equal(r.lv1, false, JSON.stringify(r)); assert.equal(r.attack, false, JSON.stringify(r));
});
