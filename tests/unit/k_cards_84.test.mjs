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

test('K-908 BS10-111 makes both players discard their Hand and draw four', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    P.reserve.n = 20; const m = BS.mkInst('BS10-111'); P.hand = [m, BS.mkInst('BS01-001')]; O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    const dk = () => Array.from({ length: 8 }, () => BS.mkInst('BS01-001')); P.deck = dk(); O.deck = dk(); const t0 = P.trash.length, t1 = O.trash.length;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' }); return [P.hand.length, O.hand.length, P.trash.length - t0 >= 1, O.trash.length - t1]; })()`);
  assert.deepEqual(r, [4, 4, true, 3], JSON.stringify(r));
});

test('K-909 BS33-035 bounces an opposing Spirit; with the Soul Core it also adds every revealed Ultimate', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = id => { const x = BS.mkInst(id); x.cores = 1; return x; };
    const out = [];
    for (const soul of [false, true]) {
      const t = mk('BS33-035'); P.spirits = [t]; O.spirits = [mk('BS01-001')]; O.hand = []; P.hand = [];
      const ult = BS.mkInst('BS24-062'); P.deck = [ult, BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
      t.soulPaid = soul; await BS.fireFx(P, 'SUMMONED', t, { subject: t });
      out.push([O.hand.length, P.hand.filter(x => x.id === 'BS24-062').length]);
    }
    return out; })()`);
  assert.deepEqual(r, [[1, 0], [1, 1]], JSON.stringify(r));
});
