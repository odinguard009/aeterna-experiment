// Lane K tests, file 19 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 5 of v0.202.0: 26RCB01-X06 (Kamen Rider Para-DX) and 26RDB01-043 (Formulia Execeeda).
// Both are data-only: costAlt {cost, if: anyLifeLe}, TREAT_LV2 {self, battle}, HAND_TO_BOTTOM with an action-level if.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-328 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RCB01-X06', '26RDB01-043'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true, c.costAlt ? c.costAlt.cost : null, c.costAlt ? c.costAlt.if.anyLifeLe : null];
  }));
  assert.deepEqual(r, [
    ['26RCB01-X06', 'ATTACKS,BLOCKS', true, 5, 3],
    ['26RDB01-043', 'SUMMONED,ALLY_BATTLE_END', true, null, null],
  ], JSON.stringify(r));
});

test('K-329 26RCB01-X06 Level Up: the first attack of the turn treats it as LV2 for that battle only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.paradx;
    G.step = 5; G.active = P.key; G.battleNo = 9; P.attacksThisTurn = 1; G.attacker = t;
    const lv0 = BS.lvNo(t);
    await BS.fireFx(P, 'ATTACKS', t);
    const inBattle = [BS.lvNo(t), t.lv2Battle === 9];
    G.attacker = null; G.battleNo = 10;
    return [lv0, inBattle, BS.lvNo(t)];
  }, SPEC('para-dx-and-formulia'));
  assert.deepEqual(r, [1, [2, true], 1], JSON.stringify(r));
});

test('K-330 26RCB01-X06 Form Change cost: Cost 5 while either Life is three or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, card = BS.CARDS['26RCB01-X06'];
    P.life = 3; O.life = 5;
    const low = BS.effCost(P, card);
    P.life = 4; O.life = 5;
    const high = BS.effCost(P, card);
    O.life = 2;
    const oppLow = BS.effCost(P, card);
    return [low, high, oppLow, low < high, oppLow === low];
  }, SPEC('para-dx-and-formulia'));
  assert.deepEqual(r.slice(3), [true, true], JSON.stringify(r));
});

test('K-331 26RDB01-043 (When Summoned): draw two and return two, one with four or more Blue Beat Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.formulia;
    P.spirits = P.spirits.filter(s => ['26RDB01-043', '26RDB01-045'].includes(s.id));      // two Blue Beat Spirits: under four
    const h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', t);
    const two = P.hand.length - h0;
    for (const id of ['26RDB01-033', '26RDB01-036']) { const x = BS.mkInst(id); x.cores = 1; P.spirits.push(x); }
    const h1 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', t);
    return [two, P.hand.length - h1];
  }, SPEC('para-dx-and-formulia'));
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-332 26RDB01-043 LV2 Ringing Charge: refreshes your Gail Fenique at the end of its battle, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.formulia, gail = window.SC.gail;
    G.battleNo = 5;
    const before = gail.exhausted;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: t });
    const after = gail.exhausted;
    gail.exhausted = true; G.battleNo = 6;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: t });
    return [before, after, gail.exhausted];
  }, SPEC('para-dx-and-formulia'));
  assert.deepEqual(r, [true, false, true], JSON.stringify(r));
});
