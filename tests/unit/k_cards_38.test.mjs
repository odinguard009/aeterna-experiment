// Lane K tests, file 38 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 24 of v0.202.0: 26RBS03-081 (Hexcraft Research Institute).
// Engine piece: action REVEAL_BRANCH {add, destroySelfIfCostIn}.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-409 data: the Hexcraft Research Institute carries both printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RBS03-081'];
    return [c.implemented === true, c.effects.map(e => e.trigger).join(',')];
  });
  assert.deepEqual(r, [true, 'ALLY_DIED,OWN_LIFE_HIT'], JSON.stringify(r));
});

test('K-410 26RBS03-081 LV1-2: a revealed Cost 2/4/6/8 Yellow Spirit goes to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.institute, topaz = window.SC.topaz;
    G.step = 5; G.active = G.p.opponent.key;
    const h0 = P.hand.length, n0 = P.nexus.length;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: topaz, byOpp: true });
    return [P.hand.map(x => x.id), n0 - P.nexus.length];
  }, SPEC('hexcraft-081'));
  assert.deepEqual(r[0], ['BS03-051'], JSON.stringify(r));
  assert.equal(r[1], 0, JSON.stringify(r));
});

test('K-411 26RBS03-081 LV1-2: a revealed Cost 1/3/5/7 card destroys this Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.institute, topaz = window.SC.topaz;
    G.step = 5; G.active = G.p.opponent.key;
    P.deck.unshift(BS.mkInst('BS02-059'));               // a Cost 3 card on top
    const n0 = P.nexus.length;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: topaz, byOpp: true });
    return [n0 - P.nexus.length, P.nexus.includes(t)];
  }, SPEC('hexcraft-081'));
  assert.deepEqual(r, [1, false], JSON.stringify(r));
});

test('K-412 26RBS03-081 LV2: when your Life is reduced, one of your Cost 2/4/6/8 Spirits refreshes', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.institute, small = window.SC.yellow2;
    G.step = 5; G.active = G.p.opponent.key;
    small.exhausted = true;
    await BS.fireFx(P, 'OWN_LIFE_HIT', t, { subject: t });
    return small.exhausted;
  }, SPEC('hexcraft-081'));
  assert.equal(r, false, String(r));
});
