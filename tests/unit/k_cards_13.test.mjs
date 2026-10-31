// Lane K tests, file 13 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v201 (Shamanism lite): 26RBS01-094, 26RBS02-077, 26RBS02-021, 26RBS03-X08
// (viaShamanTurn mark, NO_BLOCK_SHAMAN / BP_VIA_SHAMAN / NO_ATTACK_ONE_CORE, shamanReduction, legacyGe).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));
const baseBp = (page, id, cores) => page.evaluate(([id, cores]) => {
  const lv = BS.CARDS[id].levels.reduce((k, l, i) => (cores >= l.cores ? i : k), 0);
  return BS.CARDS[id].levels[lv].bp;
}, [id, cores]);

test('K-283 data: the four bundle cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS01-094', '26RBS02-077', '26RBS02-021', '26RBS03-X08'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(','), !!BS.CARDS[id].shamanReduction];
  }));
  assert.deepEqual(r, [
    ['26RBS01-094', 2, 'STATIC:NO_BLOCK_SHAMAN,STATIC', false],
    ['26RBS02-077', 2, 'STATIC:BP_VIA_SHAMAN,STATIC:NO_ATTACK_ONE_CORE', false],
    ['26RBS02-021', 1, 'DESTROYED', true],
    ['26RBS03-X08', 2, 'SUMMONED,ALLY_BLOCKED', false],
  ], JSON.stringify(r));
});

test('K-284 26RBS01-094 LV1-2: a Spirit summoned via Shamanism this turn can\'t be blocked by Cost 3 or less Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    await BS.fireFx(P, 'SUMMONED', window.SC.spectrous);
    const bon = P.spirits.find(s => s.id === '26RBS01-016');
    G.step = 5; G.active = P.key; G.attacker = bon; G.battleNo = 9;
    return [!!bon, bon && bon.viaShamanTurn === G.turnNo, blockedByMark(bon, window.SC.cheapBlocker), blockedByMark(bon, window.SC.priceyBlocker)];
  }, SPEC('penetrating-mountain-shaman'));
  assert.deepEqual(r, [true, true, true, false], JSON.stringify(r));
});

test('K-285 26RBS01-094 LV2: your Shamanism Spirits gain +1000 BP in the Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const s = window.SC.spectrous;
    G.step = 5; G.active = P.key;
    const base = BS.CARDS['26RBS01-021'].levels[BS.lvNo(s) - 1].bp;
    const attack = BS.bpOf(s) - base;
    G.active = 'opponent';                       // Either Attack Step: also in the opposing Attack Step
    const opposing = BS.bpOf(s) - base;
    G.step = 4;                                  // outside the Attack Step the bonus is gone
    const main = BS.bpOf(s) - base;
    return [attack, opposing, main, base];
  }, SPEC('penetrating-mountain-shaman'));
  assert.deepEqual(r, [1000, 1000, 0, 4000], JSON.stringify(r));
});

test('K-286 26RBS02-077 LV1-2: only a Spirit summoned via Shamanism this turn gains +2000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const via = window.SC.viaShamanSpirit, plain = window.SC.plainSpirit;
    const base = () => BS.CARDS['26RBS01-003'].levels[0].bp, b0 = [BS.bpOf(via), BS.bpOf(plain)];
    via.viaShamanTurn = G.turnNo;
    return [BS.bpOf(via) - b0[0], BS.bpOf(plain) - b0[1], base()];
  }, SPEC('violet-hole-shaman'));
  assert.deepEqual(r, [2000, 0, 4000], JSON.stringify(r));
});

test('K-287 26RBS02-077 LV2 (Opposing Attack Step): an opposing Spirit with one core can\'t attack, one with two can', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, O = G.p.opponent;
    return [cantAttack(O, window.SC.oneCore), cantAttack(O, window.SC.twoCores), totalCores(window.SC.oneCore)];
  }, SPEC('violet-hole-shaman'));
  assert.deepEqual(r, [true, false, 1], JSON.stringify(r));
});

test('K-289 26RBS02-021 LV2 (When Destroyed): one core from each of two exhausted opposing Spirits goes to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const a = window.SC.exhaustedOne, b = window.SC.exhaustedTwo;
    await BS.fireFx(P, 'SUMMONED', window.SC.queenBabianaros);
    const d = P.spirits.find(s => s.id === '26RBS02-021');
    d.cores = BS.CARDS['26RBS02-021'].levels[1].cores;
    const r0 = O.reserve.n;
    await BS.removeSpirit(P, d, 'destroyed', true); await BS.flushBursts();
    return [3 - a.cores, 3 - b.cores, O.reserve.n - r0];
  }, SPEC('duskalon-shaman'));
  assert.deepEqual(r, [1, 1, 2], JSON.stringify(r));
});

test('K-288 26RBS02-021 (via Shamanism): the summon pays the cost with every reduction symbol fulfilled and is tagged via Shamanism', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const res0 = P.reserve.n;
    await BS.fireFx(P, 'SUMMONED', window.SC.queenBabianaros);
    const d = P.spirits.find(s => s.id === '26RBS02-021');
    const reduction = Object.values(BS.CARDS['26RBS02-021'].reduction || {}).reduce((a, b) => a + b, 0);
    const l1 = BS.CARDS['26RBS02-021'].levels[0].cores;
    return [!!d, d && d.viaShamanTurn === G.turnNo, res0 - P.reserve.n, Math.max(0, BS.CARDS['26RBS02-021'].cost - reduction) + l1];
  }, SPEC('duskalon-shaman'));
  assert.deepEqual(r, [true, true, 3, 3], JSON.stringify(r));
});

test('K-290 26RBS03-X08 LV1-2 (When Summoned): one extra Green symbol, two more when two cards were banished via Legacy', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const total = () => P.spirits.reduce((a, s) => a + BS.attackSymbols(s), 0);
    G.step = 5; G.active = P.key;
    const s0 = total();
    await BS.fireFx(P, 'SUMMONED', window.SC.gorogNarg);
    const s1 = total();
    window.SC.gorogNarg.legacyN = 2;
    await BS.fireFx(P, 'SUMMONED', window.SC.gorogNarg);
    const s2 = total();
    return [s1 - s0, s2 - s1];
  }, SPEC('gorog-narg-blocked'));
  assert.deepEqual(r, [1, 2], JSON.stringify(r));
});

test('K-291 26RBS03-X08 LV2 (When blocked): an exhausted opposing Spirit is heavy exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const g = window.SC.gorogNarg, t = window.SC.exhaustedTarget;
    G.step = 5; G.active = P.key; G.attacker = g; G.battleNo = 11;
    await BS.fireFx(P, 'ALLY_BLOCKED', g, { subject: g, attacker: g });
    return [t.exhausted, t.heavy === true];
  }, SPEC('gorog-narg-blocked'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});
