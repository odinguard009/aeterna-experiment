// Lane K tests, file 83 (v0.208 cycle).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-887 BS01-024 destroys an opposing High Speed Spirit when summoned, not a plain one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-024'); a.cores = 1; P.spirits = [a];
    const plain = BS.mkInst('BS01-001'); plain.cores = 1; O.spirits = [plain];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); const out = [O.spirits.length];
    const hs = BS.mkInst('BS01-053'); hs.cores = 1; O.spirits.push(hs);
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); out.push(O.spirits.length, O.spirits.includes(plain));
    return out; })()`);
  assert.deepEqual(r, [1, 1, true], JSON.stringify(r));
});

test('K-888 BS01-036 exhausts two opposing Spirits when destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-036'); a.cores = 0; a.lostLv = 0; P.spirits = []; P.trash = [a];
    const mk = () => { const x = BS.mkInst('BS01-001'); x.cores = 1; return x; };
    O.spirits = [mk(), mk(), mk()];
    await BS.fireFx(P, 'DESTROYED', a, { subject: a });
    return O.spirits.filter(x => x.exhausted).length; })()`);
  assert.equal(r, 2, JSON.stringify(r));
});

test('K-889 BS01-090 returns an opposing Spirit to the hand when summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-090'); a.cores = 1; P.spirits = [a];
    const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits = [s]; const h0 = O.hand.length;
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    return [O.spirits.length, O.hand.length - h0]; })()`);
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});
