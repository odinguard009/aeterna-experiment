// Lane K tests, file 46 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 6 (Eternal): BS31-030 (Rappanther) and BS31-039 (Setadog) - static BP with Soul Core conditions.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-436 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS31-030', 'BS31-039'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger + (e.bp ? ':' + e.bp : '')).join(',')];
  }));
  assert.deepEqual(r, [['BS31-030', true, 'ATTACKS,STATIC:4000'], ['BS31-039', true, 'STATIC:5000']], JSON.stringify(r));
});

test('K-437 BS31-030 LV2: +4000 BP while the Soul Core is in your Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.rappanther;
    P.reserve.soul = false;
    const without = BS.staticBp(t);
    P.reserve.soul = true;
    const withSoul = BS.staticBp(t);
    return [without, withSoul];
  }, SPEC('soul-bp-two'));
  assert.equal(r[1] - r[0], 4000, JSON.stringify(r));
});

test('K-438 BS31-039: +5000 BP while the Soul Core is on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.setadog;
    t.soul = false;
    const without = BS.staticBp(t);
    t.soul = true;
    const withSoul = BS.staticBp(t);
    return [without, withSoul];
  }, SPEC('soul-bp-two'));
  assert.equal(r[1] - r[0], 5000, JSON.stringify(r));
});
