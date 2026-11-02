// Meal cards (Drifting Spirit): reveal two, summon one within the cost limit, trash the rest.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-870 Meal cards carry a REVEAL_DEPLOY with the printed cost limit', async () => {
  const { page } = await sharedBoard();
  const BSC = await page.evaluate(() => Object.fromEntries(['BS35-045','BS35-047','BS35-050','BS36-044','BS38-035'].map(id => [id, { ok: BS.CARDS[id].implemented !== false, a: BS.CARDS[id].effects[0].actions[0] }])));
  const lim = { 'BS35-045': 2, 'BS35-047': 4, 'BS35-050': 6, 'BS36-044': 5 };
  for (const [id, n] of Object.entries(lim)) {
    const a = BSC[id].a;
    assert.equal(BSC[id].ok, true, id);
    assert.equal(a.do, 'REVEAL_DEPLOY'); assert.equal(a.match.costLe, n, id);
  }
  assert.deepEqual(BSC['BS38-035'].a.match.costIn, [2, 4, 6]);
});

test('K-871 Meal: reveal two, summon only the Spirit within the cost limit, trash the rest', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true;
    const ds = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Drifting Spirit') && !BS.CARDS[k].token);
    const lo = ds.find(k => BS.CARDS[k].cost === 2), hi = ds.find(k => BS.CARDS[k].cost >= 6);
    const m = BS.mkInst('BS35-045'); P.hand.push(m); P.reserve.n = 20;
    P.deck.length = 0; for (let i = 0; i < 3; i++) P.deck.push(BS.mkInst(ds.find(k => BS.CARDS[k].cost === 1) || lo));
    P.deck.unshift(BS.mkInst(hi)); P.deck.unshift(BS.mkInst(lo));
    const top = P.deck.slice(0, 2).map(x => x.id), d0 = P.deck.length;
    await BS.summonFree(P, m);
    return { top, lo, hi, field: BS.fieldList(P).map(f => f.id), dd: d0 - P.deck.length, trash: P.trash.map(x => x.id) };
  });
  assert.ok(r.field.includes(r.lo), JSON.stringify(r));
  assert.ok(!r.field.includes(r.hi), JSON.stringify(r));
  assert.ok(r.trash.includes(r.hi) && r.dd === 2, JSON.stringify(r));
});
