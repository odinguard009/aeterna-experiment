// Lane K tests, file 36 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 22 of v0.202.0: 26RDB01-051 (Penlight Wave).
// Engine piece: STATIC flag COST_RELIEF read by exhaustCostRelief inside payInvokeCost.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-404 data: Penlight Wave carries both printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RDB01-051'];
    return [c.implemented === true, c.effects.map(e => e.trigger + (e.flag ? ':' + e.flag : '') + (e.bp ? ':' + e.bp : '')).join(',')];
  });
  assert.deepEqual(r, [true, 'STATIC:COST_RELIEF,STATIC:3000'], JSON.stringify(r));
});

test('K-405 26RDB01-051 LV1-2: the Nexus exhausts to treat one cost as paid, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, n = window.SC.penlight;
    G.step = 5; G.active = P.key;
    const first = BS.exhaustCostRelief(P, null);
    const second = BS.exhaustCostRelief(P, null);
    return [first, second, n.exhausted];
  }, SPEC('penlight-wave'));
  assert.deepEqual(r, [1, 0, true], JSON.stringify(r));
});

test('K-406 26RDB01-051 LV2: the Diva Saraswati Spirit gains 3000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, sar = window.SC.saraswati, n = window.SC.penlight;
    G.step = 5; G.active = P.key;
    const on = BS.staticBp(sar);
    n.cores = 0;                                              // LV1: the True Release is off
    const off = BS.staticBp(sar);
    return [on, off];
  }, SPEC('penlight-wave'));
  assert.equal(r[0] - r[1], 3000, JSON.stringify(r));
});
