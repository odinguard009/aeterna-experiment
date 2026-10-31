// Lane K tests, file 10 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v195 (the 50th card): 26RSD09-X02, 26RBS02-012, 26RCB01-028 (CORE_TO_ALLY / pickPerLegacy+perBp / refreshedOnly).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-257 data: the three release cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RSD09-X02', '26RBS02-012', '26RCB01-028'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [
    ['26RSD09-X02', 2, 'SUMMONED,ALLY_BATTLE_END'],
    ['26RBS02-012', 2, 'SUMMONED,ALLY_BATTLE_END'],
    ['26RCB01-028', 2, 'STATIC,BATTLE_WIN'],
  ], JSON.stringify(r));
});

test('K-258 26RSD09-X02 LV1-2: one 6000 BP or less Spirit is destroyed, two with the Soul Core paid', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.zekuga;
    const left1 = (await BS.fireFx(P, 'SUMMONED', x), O.spirits.length);
    x.soulPaid = true;
    await BS.fireFx(P, 'SUMMONED', x);
    return [left1, O.spirits.length, BS.CARDS['26RSD09-X02'].effects[0].actions.length];
  }, SPEC('zekuga-purgatory-wings'));
  assert.deepEqual(r, [1, 0, 2], JSON.stringify(r));
});

test('K-259 26RSD09-X02 LV2 (During Attack): up to two cores go from this Spirit to another Purgatory Wings Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.zekuga, ally = window.SC.purgatoryAlly;
    G.step = 5; G.active = P.key; G.attacker = x; G.battleNo = 30;
    const c0 = [x.cores, ally.cores];
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: x, attacker: x });
    return [c0, x.cores, ally.cores, BS.CARDS['26RSD09-X02'].effects[1].actions[0].do];
  }, SPEC('zekuga-purgatory-wings'));
  assert.deepEqual(r, [[3, 1], 1, 3, 'CORE_TO_ALLY'], JSON.stringify(r));
});

test('K-260 26RBS02-012 LV1-2: +3000 BP to one Spirit, plus one per EX Symbol banished via Legacy', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.duraluel;
    const bps = () => P.spirits.map(s => BS.bpOf(s));
    const b0 = bps();
    await BS.fireFx(P, 'SUMMONED', x);
    const one = bps().filter((b, i) => b - b0[i] === 3000).length;
    for (const s of P.spirits) s.bpMod = 0;
    x.legacyN = 2;
    const b1 = bps();
    await BS.fireFx(P, 'SUMMONED', x);
    const three = bps().filter((b, i) => b - b1[i] === 3000).length;
    return [one, three, BS.CARDS['26RBS02-012'].effects[0].actions[0].pickPerLegacy];
  }, SPEC('duraluel-legacy'));
  assert.deepEqual(r, [1, 3, true], JSON.stringify(r));
});

test('K-261 26RBS02-012 LV2: for every 10000 BP it has, a Cost 6 or less Spirit is refreshed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.duraluel; x.cores = 4;                     // LV2
    x.bpMod = 20000 - BS.bpOf(x);                                  // make it 20000 BP: two refreshes
    const a = window.SC.allyA, b = window.SC.allyB;
    G.step = 5; G.active = P.key; G.attacker = x; G.battleNo = 31;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: x, attacker: x });
    return [a.exhausted, b.exhausted, BS.CARDS['26RBS02-012'].effects[1].actions[0].perBp];
  }, SPEC('duraluel-legacy'));
  assert.deepEqual(r, [false, false, 10000], JSON.stringify(r));
});

test('K-262 26RCB01-028 LV1-2: an extra White symbol only while paying for Kamen Rider Ouja in your Main Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.active = P.key; G.step = 4;
    const ouja = BS.CARDS['26RCB01-X04'];
    const other = BS.CARDS['26RBS01-002'];
    const forOuja = summonSymbols(P, ouja).length;
    const forOther = summonSymbols(P, other).length;
    G.step = 5;
    const outside = summonSymbols(P, ouja).length;
    return [forOuja, forOther, outside, BS.CARDS['26RCB01-028'].effects[0].flag];
  }, SPEC('venosnaker-blocks'));
  assert.deepEqual(r, [1, 0, 0, 'SUMMON_SYMBOL'], JSON.stringify(r));
});

test('K-263 26RCB01-028 LV2 (During Block): a refreshed 3000 BP or less opposing Spirit is returned to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.venosnaker; x.cores = 3;                   // LV2
    const weak = window.SC.refreshedWeak, strong = window.SC.strongSpirit;
    G.step = 5; G.battleNo = 32; G.blocker = x; G.attacker = null;
    await BS.fireFx(P, 'BATTLE_WIN', x, { subject: x, attacking: false });
    return [O.hand.includes(weak), O.spirits.includes(weak), O.spirits.includes(strong), BS.CARDS['26RCB01-028'].effects[1].actions[0].refreshedOnly];
  }, SPEC('venosnaker-blocks'));
  assert.deepEqual(r, [true, false, true, true], JSON.stringify(r));
});
