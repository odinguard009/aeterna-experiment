// Lane K tests, file 54 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 14 (Eternal): BS24-007 and BS47-065 - data + new conditions firstBattle/oppLifeGe.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-460 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const a = BS.CARDS['BS24-007'], b = BS.CARDS['BS47-065'];
    return [a.implemented === true, (a.effects || []).map(e => e.trigger).join(','), b.implemented === true, (b.effects || []).map(e => e.trigger).join(',')];
  });
  assert.deepEqual(r, [true, 'ACTIVATE,STATIC', true, 'ATTACKS,SUMMONED'], JSON.stringify(r));
});

test('K-461 BS24-007: +6000 BP only during the first battle of the turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.battler;
    G.step = 5; G.active = P.key;
    G.attacker = t; G.battleNo = 1;
    const first = BS.staticBp(t);
    G.battleNo = 2;
    const later = BS.staticBp(t);
    return [first, later];
  }, SPEC('battle-life'));
  assert.equal(r[0] - r[1], 6000, JSON.stringify(r));
});

test('K-462 BS47-065 (When Summoned): draws two and discards one only while the opposing Life is five or more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.summoner;
    G.step = 5; G.active = P.key;
    O.life = 5;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', t);
    const high = P.hand.length - h0;
    O.life = 4;
    const h1 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', t);
    return [high, P.hand.length - h1];
  }, SPEC('battle-life'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});
