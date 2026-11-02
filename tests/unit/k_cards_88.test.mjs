// Lane K cards, batch 88.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-895 BS73-035: attack puts a Void core; at 6+ counters refreshes a cost<=5 Machine Beast once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0; P.reserve.n = 10; P.void = 5;
    const s = BS.mkInst('BS73-035'); s.cores = 1; P.spirits.push(s);
    const mb = BS.mkInst('BS31-038'); mb.cores = 1; mb.exhausted = true; P.spirits.push(mb);
    P.count = 3;
    await BS.fireFx(P, 'ATTACKS', s, { subject: s, attacker: s });
    const lowEx = mb.exhausted, c1 = s.cores;
    P.count = 6;
    await BS.fireFx(P, 'ATTACKS', s, { subject: s, attacker: s });
    return { lowEx, c1, hiEx: mb.exhausted, c2: s.cores };
  });
  const m = JSON.stringify(r);
  assert.equal(r.c1, 2, m); assert.equal(!!r.lowEx, true, m); assert.equal(!!r.hiEx, false, m);
});
