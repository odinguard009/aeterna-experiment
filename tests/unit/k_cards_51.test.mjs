// Lane K tests, file 51 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 11 (Eternal): BS64-078 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-451 data: the Divine Trees carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['BS64-078'];
    return [c.implemented === true, c.effects.map(e => e.trigger).join(',')];
  });
  assert.deepEqual(r, [true, 'OPP_ATTACKS,SUMMONED'], JSON.stringify(r));
});

test('K-452 BS64-078 (When Deployed): counter +1 and a Void core to the Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.trees;
    G.step = 5; G.active = P.key;
    const c0 = t.cores, n0 = P.count, v0 = P.void;
    await BS.fireFx(P, 'SUMMONED', t);
    return [P.count - n0, t.cores - c0, v0 - P.void];
  }, SPEC('divine-trees-kongou'));
  assert.deepEqual(r, [1, 1, 1], JSON.stringify(r));      // counter +1 and Nexus core +1 (the counter's Void core is counted by takeFromVoid)
});
