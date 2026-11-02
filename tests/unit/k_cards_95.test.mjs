// Lane K cards, batch 95.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1150 BS19-107 refreshes a Spirit, or (nothing to refresh) gives all your Spirits +3000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const a = BS.mkInst('BS01-001'); a.cores = 1; a.exhausted = true; P.spirits = [a]; P.reserve.n = 20;
    const m = BS.mkInst('BS19-107'); P.hand = [m]; const b0 = BS.bpOf(a);
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    const first = { ex: !!a.exhausted, d: BS.bpOf(a) - b0 };
    const m2 = BS.mkInst('BS19-107'); P.hand = [m2]; const b1 = BS.bpOf(a);
    await BS.castMagic(P, { inst: m2, target: null, plan: null, ctx: 'flash' });
    return { first, second: BS.bpOf(a) - b1, ok: BS.CARDS['BS19-107'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.first, { ex: false, d: 0 }, JSON.stringify(r));
  assert.equal(r.second, 3000, JSON.stringify(r));
});
