// Lane K tests, file 40 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundles 26-27 of v0.202.0 (Eternal): BS03-127, BS03-118, BS21-051, BS09-001.
// Engine pieces: EXHAUST_ALL_OPP {bpLe}, DRAW_TO {n}.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-417 data: the four Eternal cards carry their clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const ivy = BS.CARDS['BS03-127'], fourth = BS.CARDS['BS03-118'], squalo = BS.CARDS['BS21-051'], blue = BS.CARDS['BS27-034'];
    return [ivy.implemented === true, ivy.magic.by.MAIN.actions[0].do, fourth.magic.by.MAIN.actions[0].do,
      squalo.colors, blue.colors, squalo.implemented === true, blue.implemented === true];
  });
  assert.deepEqual(r, [true, 'EXHAUST_ALL_OPP', 'DRAW_TO', ['blue', 'red'], ['yellow', 'red'], true, true], JSON.stringify(r));
});

test('K-418 BS03-127 Main: every 2000 BP or less opposing Spirit is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, small = window.SC.small, big = window.SC.big;
    G.step = 3;                                            // Main Step
    await BS.runActions({ p: P, opp: O, src: P.spirits[0], ctx: {} }, { actions: BS.CARDS['BS03-127'].magic.by.MAIN.actions });
    return [small.exhausted, big.exhausted];
  }, SPEC('ivy-fourth-colors'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-419 BS03-118 Main: draw until four cards in Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    G.step = 3;
    P.hand = [P.hand[0]];                                  // one card in Hand
    await BS.runActions({ p: P, opp: O, src: P.spirits[0], ctx: {} }, { actions: BS.CARDS['BS03-118'].magic.by.MAIN.actions });
    return P.hand.length;
  }, SPEC('ivy-fourth-colors'));
  assert.equal(r, 4, String(r));
});

test('K-420 the two colour-treatment Spirits count as both colours', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const sq = BS.symbolAttrs(BS.CARDS['BS21-051'])[0], bl = BS.symbolAttrs(BS.CARDS['BS27-034'])[0];
    const syms = BS.symbolsOn(P);
    return [sq, bl, syms.blue, syms.red];
  }, SPEC('ivy-fourth-colors'));
  assert.deepEqual(r[0], ['blue', 'red'], JSON.stringify(r));
  assert.deepEqual(r[1], ['yellow', 'red'], JSON.stringify(r));
  assert.ok(r[2] >= 1, JSON.stringify(r));                 // Dark-Squalo counts as blue
  assert.ok(r[3] >= 2, JSON.stringify(r));                 // both Spirits count as red
});
