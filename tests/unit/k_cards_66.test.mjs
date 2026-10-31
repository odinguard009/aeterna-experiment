// Lane K tests, file 66 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 2 (v0.203.0+): BS10-038, BS38-020, BS14-082 (BOUNCE_OPP.all).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-503 data: the three cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS10-038', 'BS38-020', 'BS14-082'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS10-038', true, 'SUMMONED'], ['BS38-020', true, 'SUMMONED'], ['BS14-082', true, 'STATIC,OPP_DRAWS']], JSON.stringify(r));
});

test('K-504 BS10-038 (When Summoned): every 4000 BP or less Spirit returns to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.bouncerAll;
    G.step = 5; G.active = P.key;
    O.spirits = [];
    const small = BS.mkInst('26RBS01-031'); small.cores = 1; O.spirits.push(small);      // 1000 BP
    const mid = BS.mkInst('26RBS01-004'); mid.cores = 1; O.spirits.push(mid);            // 4000 BP
    const big = BS.mkInst('BS24-058'); big.cores = 1; O.spirits.push(big);               // 6000 BP: stays
    const h0 = O.hand.length;
    await BS.fireFx(P, 'SUMMONED', t);
    return [O.spirits.length, O.spirits[0] && O.spirits[0].id, O.hand.length - h0];
  }, SPEC('bounce-all-and-boards'));
  assert.deepEqual(r, [1, 'BS24-058', 2], JSON.stringify(r));
});

test('K-505 BS38-020 (When Summoned during an Attack Step): every opposing Spirit is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.exhauster;
    G.step = 5; G.active = P.key;                       // Attack Step
    await BS.fireFx(P, 'SUMMONED', t);
    const inStep = O.spirits.filter(s => s.exhausted).length;
    for (const s of O.spirits) s.exhausted = false;
    G.step = 4;                                         // Main Step: nothing
    await BS.fireFx(P, 'SUMMONED', t);
    return [inStep, O.spirits.filter(s => s.exhausted).length];
  }, SPEC('bounce-all-and-boards'));
  assert.deepEqual(r, [2, 0], JSON.stringify(r));
});

test('K-506 BS14-082: the Hand is protected and the outside-draw clause draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.fortress;
    const flag = (BS.CARDS['BS14-082'].effects || []).some(e => e.flag === 'HAND_UNAFFECTED');
    G.active = O.key; G.step = 4;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    return [flag, P.hand.length - h0];
  }, SPEC('bounce-all-and-boards'));
  assert.deepEqual(r, [true, 1], JSON.stringify(r));
});
