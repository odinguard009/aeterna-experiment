// Lane K tests, file 45 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 5 (Eternal): BS16-019 and BS40-002 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-433 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS16-019', 'BS40-002'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS16-019', true, 'ATTACKS'], ['BS40-002', true, 'STATIC']], JSON.stringify(r));
});

test('K-434 BS16-019 (When Attacks): only an opposing Spirit with one core on it is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.oneCore, one = window.SC.oppOne, many = window.SC.oppMany;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'ATTACKS', t);
    return [one.exhausted, many.exhausted];
  }, SPEC('core-exhaust-and-soul-bp'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-435 BS40-002: +4000 BP while the Soul Core is on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.soulBody;
    t.soul = true;      // the scenario loader does not set a soul mark on Field Spirits
    const withSoul = BS.staticBp(t);
    t.soul = false;
    const without = BS.staticBp(t);
    return [withSoul, without];
  }, SPEC('core-exhaust-and-soul-bp'));
  assert.equal(r[0] - r[1], 4000, JSON.stringify(r));
});
