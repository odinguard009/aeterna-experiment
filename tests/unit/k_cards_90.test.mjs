// Lane K cards, batch 90 (saga-60 product cards).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1001 SD10-014 Twin Flame destroys two opposing 2000 BP or less Spirits and spares bigger ones', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = (id, n) => { const x = BS.mkInst(id); x.cores = n; return x; };
    const a = mk('BS01-001', 1), b = mk('BS01-001', 1), c = mk('BS01-001', 1); O.spirits = [a, b, c];
    const big = mk('BS01-001', 9); O.spirits.push(big);
    P.reserve.n = 20; const m = BS.mkInst('SD10-014'); P.hand = [m];
    const before = O.spirits.length;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { before, after: O.spirits.length, big: O.spirits.includes(big), bp: BS.bpOf(a) }; })()`);
  assert.ok(r.bp <= 2000 || r.before - r.after <= 2, JSON.stringify(r));
  assert.ok(r.before - r.after <= 2 && r.before - r.after >= 1, JSON.stringify(r));
  assert.equal(r.big, true, JSON.stringify(r));
});

test('K-1002 SD01-035 draws a card and gives a Spirit +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('BS01-001'); s.cores = 1; P.spirits = [s]; P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    P.reserve.n = 20; const m = BS.mkInst('SD01-035'); P.hand = [m]; const b0 = BS.bpOf(s);
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { hand: P.hand.length, d: BS.bpOf(s) - b0 }; })()`);
  assert.equal(r.hand, 1, JSON.stringify(r));
  assert.equal(r.d, 1000, JSON.stringify(r));
});
