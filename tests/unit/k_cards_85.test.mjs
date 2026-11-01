// Lane K tests, file 85 (v0.208 cycle).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-932 BS03-133 sends two Reserve cores to Life, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const card = BS.CARDS['BS03-133'];
    const before = [P.life, P.reserve.n];
    await BS.FX_ACTIONS.RESERVE_TO_LIFE.run({ p: P, opp: O, src: BS.mkInst('BS03-133'), ctx: {} }, card.magic.actions[0]);
    const moved = [P.life - before[0], before[1] - P.reserve.n];
    const inst = BS.mkInst('BS03-133'); P.reserve.n = 6;
    const u1 = BS.magicUsable(P, inst, 'flash', true);
    P.onceUsed = P.onceUsed || {}; P.onceUsed['magic:' + card.name] = G.turnNo;
    const u2 = BS.magicUsable(P, inst, 'flash', true);
    G.turnNo++;
    const u3 = BS.magicUsable(P, inst, 'flash', true);
    return [card.magic.once, moved, !!u1, !!u2, !!u3]; })()`);
  assert.deepEqual(r, [true, [2, 2], true, false, true]);
});

test('K-933 BS01-135 draws 1 and gives all your Spirits +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-001'), b = BS.mkInst('BS01-001'), o = BS.mkInst('BS01-001'); a.bpMod = b.bpMod = o.bpMod = 0;
    P.spirits = [a, b]; O.spirits = [o]; const h = P.hand.length, d = P.deck.length;
    const m = BS.CARDS['BS01-135'].magic;
    for (const act of m.actions) await BS.FX_ACTIONS[act.do].run({ p: P, opp: O, src: BS.mkInst('BS01-135'), ctx: {} }, act);
    return [P.hand.length - h, d - P.deck.length, a.bpMod, b.bpMod, o.bpMod || 0, m.timing]; })()`);
  assert.deepEqual(r, [1, 1, 1000, 1000, 0, ['MAIN', 'FLASH']]);
});

test('K-934 BS31-109 refreshes only a yellow Spirit, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const red = BS.mkInst('BS01-001'), yel = BS.mkInst('BS02-049'); red.exhausted = yel.exhausted = true; P.spirits = [red, yel];
    const act = BS.CARDS['BS31-109'].magic.actions[0];
    const cands = BS.FX_ACTIONS.REFRESH_SPIRIT.cands({ p: P, opp: O, src: BS.mkInst('BS31-109'), ctx: {} }, act);
    return [BS.CARDS['BS31-109'].magic.once, cands.length, cands[0] === yel]; })()`);
  assert.deepEqual(r, [true, 1, true]);
});

test('K-935 BS44-091 returns every opposing Spirit with 7000 BP or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const small = BS.mkInst('BS01-001'); small.cores = 1; const big = BS.mkInst('BS01-001'); big.cores = 1; big.bpMod = 20000;
    O.spirits = [small, big]; const h = O.hand.length;
    const act = BS.CARDS['BS44-091'].magic.actions[0];
    await BS.FX_ACTIONS.BOUNCE_OPP.run({ p: P, opp: O, src: BS.mkInst('BS44-091'), ctx: {} }, act);
    return [O.spirits.length, O.spirits[0] === big, O.hand.length - h]; })()`);
  assert.deepEqual(r, [1, true, 1]);
});
