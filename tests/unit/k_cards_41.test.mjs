// Lane K tests, file 41 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 1 (Eternal): BS38-025 (Argent-Vixen) and BS16-024 (Barbary-Chouhi) - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-421 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const v = BS.CARDS['BS38-025'], c = BS.CARDS['BS16-024'];
    return [v.implemented === true, v.effects.map(e => e.trigger).join(','), c.implemented === true, c.effects.map(e => e.trigger + (e.bp ? ':' + e.bp : '')).join(',')];
  });
  assert.deepEqual(r, [true, 'ATTACKS,BLOCKS', true, 'ALLY_BATTLE_WIN,STATIC:1000'], JSON.stringify(r));
});

test('K-422 BS16-024 (Your Attack Step): +1000 BP for each core on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.chouhi;
    G.step = 5; G.active = P.key;
    t.cores = 3;
    const inStep = BS.staticBp(t);
    G.step = 4;                                             // outside your Attack Step: off
    const outside = BS.staticBp(t);
    return [inStep, outside];
  }, SPEC('argent-vixen'));
  assert.equal(r[0] - r[1], 3000, JSON.stringify(r));
});

test('K-423 BS38-025 LV2 (When Blocks): it refreshes and gains +5000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.vixen;
    G.step = 5; G.active = G.p.opponent.key; t.exhausted = true;
    const bp0 = BS.bpOf(t);
    await BS.fireFx(P, 'BLOCKS', t, { subject: t });
    return [t.exhausted, BS.bpOf(t) - bp0];
  }, SPEC('argent-vixen'));
  assert.deepEqual(r, [false, 5000], JSON.stringify(r));
});
