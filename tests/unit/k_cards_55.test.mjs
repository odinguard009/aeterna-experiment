// Lane K tests, file 55 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 15 (Eternal): BS09-050 and BS42-RV011 - data only (ALLY_SUMMONED match type Nexus).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-463 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS09-050', 'BS42-RV011'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS09-050', true, 'ALLY_SUMMONED'], ['BS42-RV011', true, 'ALLY_SUMMONED']], JSON.stringify(r));
});

test('K-464 BS09-050 LV2: a deployed Nexus gives it a Void core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.deployBuyer, nx = window.SC.grove;
    G.step = 5; G.active = P.key;
    const c0 = t.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: nx });
    return t.cores - c0;
  }, SPEC('nexus-deploy-cores'));
  assert.equal(r, 1, String(r));
});

test('K-465 BS42-RV011: only one Void core per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.onceBuyer, nx = window.SC.grove;
    G.step = 5; G.active = P.key;
    const c0 = t.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: nx });
    const first = t.cores - c0;
    await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: nx });
    return [first, t.cores - c0];
  }, SPEC('nexus-deploy-cores'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});
