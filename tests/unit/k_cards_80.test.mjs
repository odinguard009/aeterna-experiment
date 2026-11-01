// Lane K tests, file 80 (rule 1b). Schema v259: MILL_OPP.perOppHand. Cards: BS04-111.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-808 MILL_OPP perOppHand: one opposing deck-top card goes to the Trash per card in the opposing Hand (BS04-111)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')]; O.deck = Array.from({ length: 6 }, () => BS.mkInst('BS01-001')); const t0 = O.trash.length;
    const act = BS.CARDS['BS04-111'].magic.by.MAIN.actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS04-111'), ctx: {} };
    await BS.FX_ACTIONS.MILL_OPP.run(c, act); return [O.deck.length, O.trash.length - t0, BS.FX_ACTIONS.MILL_OPP.chk(act)]; })()`);
  assert.deepEqual(r, [3, 3, true], JSON.stringify(r));
});
