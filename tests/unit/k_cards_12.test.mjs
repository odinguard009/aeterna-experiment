// Lane K tests, file 12 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v199: 26RBS03-017, 26RBS02-033, 26RSD09-X01
// (card field handCost / OPP_CORES_TO_RESERVE multi-target / EXHAUST_EITHER / oppRefreshedLe / REVEAL_PICK.soulBonus).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-276 data: the three bundle cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS03-017', '26RBS02-033', '26RSD09-X01'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger).join(','), !!(BS.CARDS[id].handCost)];
  }));
  assert.deepEqual(r, [
    ['26RBS03-017', 1, 'DESTROYED', true],
    ['26RBS02-033', 2, 'SUMMONED,END_STEP', false],
    ['26RSD09-X01', 2, 'SUMMONED,STATIC', false],
  ], JSON.stringify(r));
});

test('K-277 26RBS03-017: the card in Hand becomes Cost 4 only while the opponent controls a Cost 3 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const withOpp = handCostSet(P, BS.CARDS['26RBS03-017']);
    O.spirits = O.spirits.filter(s => BS.CARDS[s.id].cost > 3);
    const without = handCostSet(P, BS.CARDS['26RBS03-017']);
    return [withOpp, without, BS.CARDS['26RBS03-017'].cost];
  }, SPEC('maskthorn-bloodrouse'));
  assert.deepEqual(r, [4, null, 5], JSON.stringify(r));
});

test('K-278 26RBS03-017 LV1-2 (When Destroyed): the opposing-turn branch sends three cores (one target is depleted), the normal branch one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const fx = BS.CARDS['26RBS03-017'].effects[0], src = BS.mkInst('26RBS03-017'); src.cores = 2; P.spirits.push(src);
    G.active = P.key;
    const r0 = O.reserve.n, n0 = O.spirits.length;
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: fx.actions });
    const own = [O.reserve.n - r0, n0 - O.spirits.length];
    const l2 = BS.loadScenario(spec); if (l2.error) return ['scenario2', l2.error];
    const G2 = BS.G, P2 = G2.p.player, O2 = G2.p.opponent;
    const src2 = BS.mkInst('26RBS03-017'); src2.cores = 2; P2.spirits.push(src2);
    G2.active = O2.key;
    const r2 = O2.reserve.n, n2 = O2.spirits.length;
    await BS.runActions({ p: P2, opp: O2, src: src2, ctx: {} }, { actions: fx.actions });
    return [own, [O2.reserve.n - r2, n2 - O2.spirits.length]];
  }, SPEC('maskthorn-bloodrouse'));
  assert.deepEqual(r, [[1, 0], [3, 1]], JSON.stringify(r));
});

test('K-279 26RBS02-033 LV1-2 (When Summoned): a refreshed Spirit is exhausted, an exhausted one is heavy exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.daisy;
    O.spirits = [window.SC.oppRefreshed];                       // one refreshed target: exhaust it
    await BS.fireFx(P, 'SUMMONED', x);
    const fresh = [window.SC.oppRefreshed.exhausted, window.SC.oppRefreshed.heavy === true];
    const l2 = BS.loadScenario(spec); if (l2.error) return ['scenario2', l2.error];
    const G2 = BS.G, P2 = G2.p.player, O2 = G2.p.opponent;
    O2.spirits = [window.SC.oppExhausted];                      // one exhausted target: heavy exhaust it
    await BS.fireFx(P2, 'SUMMONED', window.SC.daisy);
    return [fresh, window.SC.oppExhausted.heavy === true];
  }, SPEC('mirecaller-daisy'));
  assert.deepEqual(r, [[true, false], true], JSON.stringify(r));
});

test('K-280 26RBS02-033 LV2 (Your End Step): the opponent heavy exhausts one exhausted non-heavy Spirit when it has one refreshed Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const e = window.SC.oppExhausted, rr = window.SC.oppRefreshed;
    G.step = 7; G.active = P.key;
    await BS.fireFx(P, 'END_STEP', null, {});
    const one = [e.heavy === true, rr.exhausted];
    // two refreshed Spirits: the condition fails
    const l2 = BS.loadScenario(spec); if (l2.error) return ['scenario2', l2.error];
    const G2 = BS.G, P2 = G2.p.player, O2 = G2.p.opponent;
    const extra = BS.mkInst('26RBS01-005'); extra.cores = 1; O2.spirits.push(extra);   // second refreshed Spirit
    G2.step = 7; G2.active = P2.key;
    await BS.fireFx(P2, 'END_STEP', null, {});
    return [one, window.SC.oppExhausted.heavy === true];
  }, SPEC('mirecaller-daisy'));
  assert.deepEqual(r, [[true, false], false], JSON.stringify(r));
});

test('K-281 26RSD09-X01 LV1-2: reveal three, add one Purgatory Wings Spirit with a different name; two with the Soul Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const b = window.SC.boreowl;
    const deck0 = P.deck.length;
    await BS.fireFx(P, 'SUMMONED', b);
    const one = [P.hand.length, deck0 - P.hand.length];
    const l2 = BS.loadScenario(spec); if (l2.error) return ['scenario2', l2.error];
    const b2 = window.SC.boreowl; b2.soulPaid = true;
    await BS.fireFx(BS.G.p.player, 'SUMMONED', b2, { selfInst: b2 });
    return [one, BS.G.p.player.hand.length];
  }, SPEC('hundred-eyes-boreowl'));
  assert.deepEqual(r, [[1, 2], 2], JSON.stringify(r));
});

test('K-282 26RSD09-X01 LV2 (Your Attack Step): all your Spirits gain +1000 BP while the Soul Core is in your Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const b = window.SC.boreowl, a = window.SC.redCloudAlly;
    G.step = 5; G.active = P.key;
    const withSoul = [BS.bpOf(b), BS.bpOf(a)];
    P.trashCores.soul = false;
    const noSoul = [BS.bpOf(b), BS.bpOf(a)];
    G.active = 'opponent';
    const oppTurn = BS.bpOf(a);
    return [withSoul, noSoul, oppTurn];
  }, SPEC('hundred-eyes-boreowl'));
  // Boreowl 6000 -> 7000 and the ally 3000 -> 4000; without the Soul Core or outside your Attack Step the bonus is gone
  assert.deepEqual(r, [[7000, 4000], [6000, 3000], 3000], JSON.stringify(r));
});
