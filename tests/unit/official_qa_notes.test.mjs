// R8 follow-up (v0.194.0): engine checks of the Mirage notes in docs/mechanics/official-qa.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { quietBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const MIRAGE = 'BS76-002';

test('Q76-01 setting a Mirage pays its cost, lands in the Mirage slot (not the Burst), and a second Mirage the same turn is refused', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async id => {
    const G = BS.G, P = G.p.player; G.active = P.key; BS.SETTINGS.speed = 'instant';
    const a = BS.mkInst(id), b = BS.mkInst(id); P.hand.push(a, b); P.reserve.n = 5;
    const cost = BS.CARDS[id].mirage.cost, n0 = P.reserve.n;
    const ok1 = await BS.applyIntent(P.key, { type: 'mirage', uid: a.uid });
    const paid = n0 - P.reserve.n;
    const ok2 = await BS.applyIntent(P.key, { type: 'mirage', uid: b.uid });
    return { cost, ok1, paid, slot: P.mirage && P.mirage.uid === a.uid, burst: !!P.burst, ok2, stillInHand: P.hand.includes(b) };
  }, MIRAGE);
  assert.equal(r.ok1, true);
  assert.equal(r.paid, r.cost, 'the Mirage cost leaves the Reserve');
  assert.ok(r.slot && !r.burst);
  assert.equal(r.ok2, false); assert.ok(r.stillInHand);
});

test('Q76-02 with too few cores the Mirage is refused and stays in the Hand', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async id => {
    const G = BS.G, P = G.p.player; G.active = P.key; BS.SETTINGS.speed = 'instant';
    const a = BS.mkInst(id); P.hand.push(a); P.reserve.n = 0; P.reserve.soul = false;
    return { ok: await BS.applyIntent(P.key, { type: 'mirage', uid: a.uid }), set: !!P.mirage };
  }, MIRAGE);
  assert.equal(r.ok, false); assert.equal(r.set, false);
});
