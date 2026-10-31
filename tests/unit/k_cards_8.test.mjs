// Lane K tests, file 8 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v193: 26RSD07-011, 26RSD06-010, 26RBS03-X01 (EXTRA_SYMBOL / sameCostAttacker / bpPerLegacy).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-243 data: the three bundle cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RSD07-011', '26RSD06-010', '26RBS03-X01'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger + ':' + (e.flag || '')).join(',')];
  }));
  assert.deepEqual(r, [
    ['26RSD07-011', 2, 'STATIC:EXTRA_SYMBOL,ALLY_DIED:'],
    ['26RSD06-010', 2, 'STATIC:EXTRA_SYMBOL,OPP_ATTACKS:'],
    ['26RBS03-X01', 2, 'SUMMONED:,END_STEP:'],
  ], JSON.stringify(r));
});

test('K-244 26RSD07-011 LV1-2: the Nexus gains an extra Purple symbol while a ZEZTZ Spirit is exhausted in your Main Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const withExtra = BS.symbolsOn(P).purple || 0;                 // exhausted ZEZTZ + Main Step: the extra symbol is on
    window.SC.zeztzSpirit.exhausted = false;
    const refreshed = BS.symbolsOn(P).purple || 0;
    window.SC.zeztzSpirit.exhausted = true;
    G.step = 5;
    const attackStep = BS.symbolsOn(P).purple || 0;
    return [withExtra, refreshed, attackStep, BS.CARDS['26RSD07-011'].effects[0].color];
  }, SPEC('zeztz-extra-symbol'));
  assert.deepEqual(r, [3, 2, 2, 'purple'], JSON.stringify(r));
});

test('K-245 26RSD07-011 LV2 (Either Attack Step): a destroyed ZEZTZ ally sends one core from an opposing Spirit to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    window.SC.zeroider.cores = 3;                                  // LV2
    const z = window.SC.zeztzSpirit, t = window.SC.oppSpirit;
    G.step = 5; G.battleNo = 20;
    const c0 = t.cores;
    BS.removeSpirit(P, z, 'destroyed', false); await BS.flushBursts();
    return [c0, t.cores, BS.CARDS['26RSD07-011'].effects[1].actions[0].do];
  }, SPEC('zeztz-extra-symbol'));
  assert.deepEqual(r, [2, 1, 'OPP_CORES_TO_RESERVE'], JSON.stringify(r));
});

test('K-246 26RSD06-010 LV1-2: the Nexus gains an extra Blue symbol with three or more Blue Nexuses in your Main Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.active = P.key; G.step = 4;                                  // the printed "Your Main Step" window
    P.nexus[0].cores = 0;                                          // the extra symbol does not depend on this Nexus' level
    const one = BS.symbolsOn(P).blue || 0;                         // one blue Nexus: no condition yet
    P.nexus.push(BS.mkInst('26RSD06-010'), BS.mkInst('26RSD06-010'));
    const three = BS.symbolsOn(P).blue || 0;                       // three blue Nexuses: each gains the extra symbol (+2 base +3 extras)
    return [three - one, BS.CARDS['26RSD06-010'].effects[0].n];
  }, SPEC('ferobeast-same-cost'));
  assert.deepEqual(r, [5, 1], JSON.stringify(r));
});

test('K-247 26RSD06-010 LV2 (Opposing Attack Step): only the Ferobeast Spirit with the attacker\'s cost is refreshed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const a = window.SC.attackerCost4, f4 = window.SC.ferobeastCost4, f5 = window.SC.ferobeastCost5;
    G.step = 5; G.active = O.key; G.attacker = a;
    await BS.fireFx(P, 'OPP_ATTACKS', a, { subject: a, attacker: a });
    return [f4.exhausted, f5.exhausted, BS.CARDS[a.id].cost];
  }, SPEC('ferobeast-same-cost'));
  assert.deepEqual(r, [false, true, 4], JSON.stringify(r));
});

test('K-248 26RBS03-X01 LV1-2: one banished Red Cloud Legacy card raises the destroy BP limit from 4000 to 6000', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.rittenia, t = window.SC.bigTarget;
    t.bpMod = 4000;                                                // 6000 BP
    await BS.runActions({ p: P, opp: O, src: x, ctx: {} }, { actions: BS.CARDS['26RBS03-X01'].effects[0].actions });
    const withoutLegacy = O.spirits.includes(t);
    x.legacyCards = ['26RBS01-002'];                               // one Red Cloud EX card banished via Legacy
    await BS.runActions({ p: P, opp: O, src: x, ctx: {} }, { actions: BS.CARDS['26RBS03-X01'].effects[0].actions });
    return [withoutLegacy, O.spirits.includes(t)];
  }, SPEC('deepredbladessom-legacy'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-249 26RBS03-X01 LV2 (Your End Step): a core from the Trash goes to this Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.rittenia; x.cores = 3;                     // LV2
    P.trashCores.n = 2; G.step = 7; G.active = P.key;
    const c0 = x.cores;
    await BS.fireFx(P, 'END_STEP', null, {});
    return [x.cores - c0, P.trashCores.n, BS.CARDS['26RBS03-X01'].effects[1].actions[0].toSelf];
  }, SPEC('deepredbladessom-legacy'));
  assert.deepEqual(r, [1, 1, true], JSON.stringify(r));
});
