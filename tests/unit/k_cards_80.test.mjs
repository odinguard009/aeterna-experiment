// Lane K tests, file 80 (rule 1b). Schemas v259-v262: DISCARD_ANY_DRAW, DEPLOY_TRASH.all, MILL_OPP.perOppHand, RESERVE_TO_SPIRIT, VOID_TO_CARD per-count. Cards: BS02-092, BS02-093, BS04-098, BS02-107, BS03-146, BS03-148, BS02-068, BS02-069, BS04-111, BS01-078, BS01-115, BS03-030, BS01-X03.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-808 MILL_OPP perOppHand: one opposing deck-top card goes to the Trash per card in the opposing Hand (BS04-111)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')]; O.deck = Array.from({ length: 6 }, () => BS.mkInst('BS01-001')); const t0 = O.trash.length;
    const act = BS.CARDS['BS04-111'].magic.by.MAIN.actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS04-111'), ctx: {} };
    await BS.FX_ACTIONS.MILL_OPP.run(c, act); return [O.deck.length, O.trash.length - t0, BS.FX_ACTIONS.MILL_OPP.chk(act)]; })()`);
  assert.deepEqual(r, [3, 3, true], JSON.stringify(r));
});

test('K-809 BS01-078 moves one core from the Trash to the Reserve when it attacks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.trashCores.n = 2; const r0 = P.reserve.n;
    const e = BS.CARDS['BS01-078'].effects[0]; const c = { p: P, opp: O, src: BS.mkInst('BS01-078'), ctx: {} };
    await BS.FX_ACTIONS.TRASH_CORES_TO.run(c, e.actions[0]); return [e.trigger, P.trashCores.n, P.reserve.n - r0]; })()`);
  assert.deepEqual(r, ['ATTACKS', 1, 1], JSON.stringify(r));
});

test('K-810 RESERVE_TO_SPIRIT: up to 3 Reserve cores go to a Spirit, then BS01-115 draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.spirits = [];
    const i = BS.mkInst('BS01-001'); i.cores = 1; P.spirits.push(i); P.reserve.n = 2; P.hand = []; P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    const acts = BS.CARDS['BS01-115'].magic.by.FLASH.actions; const c = { p: P, opp: O, src: BS.mkInst('BS01-115'), ctx: {} };
    await BS.FX_ACTIONS.RESERVE_TO_SPIRIT.run(c, acts[0]); await BS.FX_ACTIONS.DRAW.run(c, acts[1]); return [i.cores, P.reserve.n, P.hand.length, acts.length]; })()`);
  assert.deepEqual(r, [3, 0, 1, 2], JSON.stringify(r));
});

test('K-811 VOID_TO_CARD perNexus / perOtherSpirit: one Void core per Nexus (BS03-030) and per other Spirit (BS01-X03)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.spirits = []; P.nexus = [];
    const a = BS.mkInst('BS03-030'); a.cores = 1; P.spirits.push(a); const b = BS.mkInst('BS01-001'); b.cores = 1; P.spirits.push(b); P.nexus.push(BS.mkInst('BS01-X03'), BS.mkInst('BS01-X03')); P.void = 9;
    const e = BS.CARDS['BS03-030'].effects[0].actions[0]; const c = { p: P, opp: O, src: a, ctx: {} }; const k0 = a.cores;
    await BS.FX_ACTIONS.VOID_TO_CARD.run(c, e); const nx = a.cores - k0;
    const e2 = BS.CARDS['BS01-X03'].effects.find(x => x.trigger === 'SUMMONED').actions[0]; const k1 = a.cores; await BS.FX_ACTIONS.VOID_TO_CARD.run({ p: P, opp: O, src: a, ctx: {} }, e2);
    return [BS.FX_ACTIONS.VOID_TO_CARD.chk(e), BS.FX_ACTIONS.VOID_TO_CARD.chk(e2), nx, a.cores - k1]; })()`);
  assert.deepEqual(r, [true, true, 2, 1], JSON.stringify(r));
});

test('K-812 BS02-068 deploys a White Nexus from the Hand free and skips a non-White one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.nexus = [];
    P.hand = [BS.mkInst('BS01-102')]; const e = BS.CARDS['BS02-068'].effects[0]; const act = e.actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS02-068'), ctx: {} };
    await BS.FX_ACTIONS.SUMMON_HAND.run(c, act); const none = P.nexus.length;
    P.hand = [BS.mkInst('BS01-110')]; await BS.FX_ACTIONS.SUMMON_HAND.run(c, act);
    return [e.trigger, e.optional, none, P.nexus.length, P.nexus[0] && P.nexus[0].id, BS.FX_ACTIONS.SUMMON_HAND.chk(act)]; })()`);
  assert.deepEqual(r, ['SUMMONED', true, 0, 1, 'BS01-110', true], JSON.stringify(r));
});

test('K-813 DISCARD_ANY_DRAW: the CPU discards every Nexus in hand and draws one per card (BS03-146)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    P.hand = [BS.mkInst('BS01-102'), BS.mkInst('BS01-110'), BS.mkInst('BS01-001')]; P.deck = Array.from({ length: 5 }, () => BS.mkInst('BS01-001')); const t0 = P.trash.length;
    const act = BS.CARDS['BS03-146'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.DISCARD_ANY_DRAW.run({ p: P, opp: O, src: BS.mkInst('BS03-146'), ctx: {} }, act);
    return [P.trash.length - t0, P.hand.length, P.deck.length, BS.FX_ACTIONS.DISCARD_ANY_DRAW.chk(act)]; })()`);
  assert.deepEqual(r, [2, 3, 3, true], JSON.stringify(r));
});

test('K-814 DEPLOY_TRASH all: every Red/Green/Blue Nexus in the Trash is deployed, others stay (BS03-148)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.nexus = [];
    const act = BS.CARDS['BS03-148'].magic.by.MAIN.actions[0]; const ids = ['BS01-098', 'BS01-099'];
    P.trash = [BS.mkInst(ids[0]), BS.mkInst(ids[1]), BS.mkInst('BS01-102')];
    await BS.FX_ACTIONS.DEPLOY_TRASH.run({ p: P, opp: O, src: BS.mkInst('BS03-148'), ctx: {} }, act);
    return [P.nexus.length, P.trash.map(x => x.id), BS.FX_ACTIONS.DEPLOY_TRASH.chk(act)]; })()`);
  assert.equal(r[0], 2, JSON.stringify(r)); assert.deepEqual(r[1], ['BS01-102']); assert.equal(r[2], true);
});

test('K-815 OPP_CORE_TO_TRASH_NR: the CPU takes a core from the opposing Nexus holding the most, else the Reserve (BS02-092)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const n = BS.mkInst('BS01-098'); n.cores = 2; O.nexus = [n]; O.reserve.n = 3; const t0 = O.trashCores.n;
    const act = BS.CARDS['BS02-092'].magic.by.MAIN.actions[0]; const c = () => ({ p: P, opp: O, src: BS.mkInst('BS02-092'), ctx: {} });
    await BS.FX_ACTIONS.OPP_CORE_TO_TRASH_NR.run(c(), act); const a = [n.cores, O.reserve.n, O.trashCores.n - t0];
    n.cores = 0; await BS.FX_ACTIONS.OPP_CORE_TO_TRASH_NR.run(c(), act); return [a, [n.cores, O.reserve.n, O.trashCores.n - t0], BS.FX_ACTIONS.OPP_CORE_TO_TRASH_NR.chk(act)]; })()`);
  assert.deepEqual(r, [[1, 3, 1], [0, 2, 2], true], JSON.stringify(r));
});

test('K-816 BOTH_CORES_TO_TRASH: each player sends four cores from their Spirits to their own Trash (BS02-093)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true; P.spirits = []; O.spirits = [];
    const mk = (q, n) => { const i = BS.mkInst('BS01-001'); i.cores = n; q.spirits.push(i); return i; }; const a = mk(P, 5), b = mk(O, 3); const pt = P.trashCores.n, ot = O.trashCores.n;
    const act = BS.CARDS['BS02-093'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.BOTH_CORES_TO_TRASH.run({ p: P, opp: O, src: BS.mkInst('BS02-093'), ctx: {} }, act);
    return [a.cores, b.cores, P.trashCores.n - pt, O.trashCores.n - ot, BS.FX_ACTIONS.BOTH_CORES_TO_TRASH.chk(act)]; })()`);
  assert.deepEqual(r, [1, 0, 4, 3, true], JSON.stringify(r));
});

test('K-817 VOID_TO_NEXUS_LV: Void cores fill a Nexus up to its LV2 threshold and no further (BS04-098)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const n = BS.mkInst('BS01-098'); n.cores = 0; P.nexus = [n]; P.void = 20; const need = BS.CARDS['BS01-098'].levels[1].cores;
    const act = BS.CARDS['BS04-098'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.VOID_TO_NEXUS_LV.run({ p: P, opp: O, src: BS.mkInst('BS04-098'), ctx: {} }, act);
    return [n.cores === need, P.void === 20 - need, BS.FX_ACTIONS.VOID_TO_NEXUS_LV.chk(act)]; })()`);
  assert.deepEqual(r, [true, true, true], JSON.stringify(r));
});
