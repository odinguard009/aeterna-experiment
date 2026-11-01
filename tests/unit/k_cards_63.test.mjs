// Lane K tests, file 63 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 23 (Eternal): OPP_DRAWS trigger + outsideDraw condition, four cards.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-490 data: the four cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS03-028', 'BS08-022', 'BS11-023', 'BS41-039'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r.map(x => x[0] + ':' + x[2]), ['BS03-028:OPP_DRAWS', 'BS08-022:OPP_DRAWS', 'BS11-023:OPP_DRAWS', 'BS41-039:STATIC,OPP_DRAWS'], JSON.stringify(r));
});

test('K-491 BS03-028 LV2: refreshes only while it is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.mogrunner;
    G.step = 4; G.active = G.p.opponent.key;
    t.exhausted = true;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    const first = t.exhausted;
    t.exhausted = true;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    return [first, t.exhausted];
  }, SPEC('opponent-draws'));
  assert.deepEqual(r, [false, false], JSON.stringify(r));
});

test('K-492 BS11-023: the opponent draw refreshes it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.totemowl;
    G.step = 4; G.active = G.p.opponent.key; t.exhausted = true;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    return t.exhausted;
  }, SPEC('opponent-draws'));
  assert.equal(r, false, String(r));
});

test('K-493 BS41-039 LV2: draws outside the Draw Step on the opposing turn only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.loader;
    G.active = O.key; G.step = 4;                       // opposing Main Step
    const h0 = P.hand.length;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    const outside = P.hand.length - h0;
    G.step = 2;                                         // Draw Step: no
    const h1 = P.hand.length;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    return [outside, P.hand.length - h1];
  }, SPEC('opponent-draws'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-494 BS08-022: a Blade Beast Spirit refreshes in the opposing Main Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, blade = window.SC.blade;
    G.active = G.p.opponent.key; G.step = 4; blade.exhausted = true;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    const inStep = blade.exhausted;
    blade.exhausted = true; G.active = P.key;           // your own Main Step: no
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    return [inStep, blade.exhausted];
  }, SPEC('opponent-draws'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});
