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

test('K-896 BS68-004: draws when a red Devotee/Concluser enters via an effect, once per turn, not on a normal summon', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0; P.reserve.n = 10; P.void = 5;
    const id = Object.keys(BS.CARDS).find(i => { const k = BS.CARDS[i]; return k.type === 'Spirit' && (k.colors || [k.symbol]).includes('red') && (k.families || []).some(f => /devotee|concluser/i.test(f)) && i !== 'BS68-004'; });
    const s = BS.mkInst('BS68-004'); s.cores = 3; P.spirits.push(s);
    const h0 = P.hand.length;
    const a = BS.mkInst(id); a.viaFx = false;
    await BS.fireFx(P, 'ALLY_SUMMONED', s, { subject: a }); const d0 = P.hand.length - h0;
    const b = BS.mkInst(id); b.viaFx = true;
    await BS.fireFx(P, 'ALLY_SUMMONED', s, { subject: b }); const d1 = P.hand.length - h0;
    const c = BS.mkInst(id); c.viaFx = true;
    await BS.fireFx(P, 'ALLY_SUMMONED', s, { subject: c }); const d2 = P.hand.length - h0;
    return { id, d0, d1, d2 };
  });
  const m = JSON.stringify(r);
  assert.equal(r.d0, 0, m); assert.equal(r.d1, 1, m); assert.equal(r.d2, 1, m);
});
