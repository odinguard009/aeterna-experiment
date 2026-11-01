// Lane K tests, file 80 (rule 1b). Schemas v259-v260: MILL_OPP.perOppHand, RESERVE_TO_SPIRIT. Cards: BS04-111, BS01-078, BS01-115.
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

test('K-809 BS01-078 moves one core from the Trash to the Reserve when it attacks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.trashCores.n = 2; const r0 = P.reserve.n;
    const e = BS.CARDS['BS01-078'].effects[0]; const c = { p: P, opp: O, src: BS.mkInst('BS01-078'), ctx: {} };
    await BS.FX_ACTIONS.TRASH_CORES_TO.run(c, e.actions[0]); return [e.trigger, P.trashCores.n, P.reserve.n - r0]; })()`);
  assert.deepEqual(r, ['ATTACKS', 1, 1], JSON.stringify(r));
});

test('K-810 RESERVE_TO_SPIRIT: up to 3 Reserve cores go to a Spirit, then BS01-115 draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.spirits = [];
    const i = BS.mkInst('BS01-001'); i.cores = 1; P.spirits.push(i); P.reserve.n = 2; P.hand = []; P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    const acts = BS.CARDS['BS01-115'].magic.by.FLASH.actions; const c = { p: P, opp: O, src: BS.mkInst('BS01-115'), ctx: {} };
    await BS.FX_ACTIONS.RESERVE_TO_SPIRIT.run(c, acts[0]); await BS.FX_ACTIONS.DRAW.run(c, acts[1]); return [i.cores, P.reserve.n, P.hand.length, acts.length]; })()`);
  assert.deepEqual(r, [3, 0, 1, 2], JSON.stringify(r));
});
