// Lane K tests, file 84 (v0.208 cycle).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-907 BS02-108 puts every Magic card from the Hand onto the Removed Zone and draws one per card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    P.reserve.n = 20; const m = BS.mkInst('BS02-108'); P.hand = [m, BS.mkInst('BS01-148'), BS.mkInst('BS01-148'), BS.mkInst('BS01-001')];
    P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')]; P.removed = [];
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' }); return [P.removed.filter(x => x.id === 'BS01-148').length, P.hand.length]; })()`);
  assert.deepEqual(r, [2, 3], JSON.stringify(r));
});
