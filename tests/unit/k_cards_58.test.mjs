// Lane K tests, file 58 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 18 (Eternal): BS13-020 + BP_TARGET.perCores.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-472 data: Bushbabe carries its printed clause', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['BS13-020'];
    return [c.implemented === true, c.effects.map(e => e.trigger).join(','), c.effects[0].actions[0].perCores === true];
  });
  assert.deepEqual(r, [true, 'ATTACKS', true], JSON.stringify(r));
});

test('K-473 BS13-020 (When Attacks): +1000 BP for each core on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.bushbabe;
    G.step = 5; G.active = P.key; t.cores = 5;
    const bp0 = BS.bpOf(t);
    await BS.fireFx(P, 'ATTACKS', t);
    const withFive = BS.bpOf(t) - bp0;
    t.cores = 2;
    const bp1 = BS.bpOf(t);
    await BS.fireFx(P, 'ATTACKS', t);
    return [withFive, BS.bpOf(t) - bp1];
  }, SPEC('bushbabe'));
  assert.deepEqual(r, [5000, 2000], JSON.stringify(r));
});
