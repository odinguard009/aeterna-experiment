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

// Q4497-Q4499 (BS23-020 Yoroibatta, Rush White/Blue): each colour effect needs that symbol AND a High Speed summon.
async function rush(syms) {
  const { page } = await quietBoard();
  return page.evaluate(async syms => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; BS.SETTINGS.speed = 'instant';
    const one = col => Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.symbol === col && c.symbols === 1 && !(c.effects && c.effects.length) && c.id !== 'BS23-020');
    for (const col of syms) { const s = BS.mkInst(one(col).id); s.cores = 1; s.summonedTurn = 0; P.spirits.push(s); }
    const foe = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost <= 4 && !(c.effects && c.effects.length)).id); foe.cores = 1; O.spirits.push(foe);
    const me = BS.mkInst('BS23-020'); P.hand.push(me); P.reserve.n = 6;
    await BS.applyIntent(P.key, { type: 'summon', uid: me.uid });
    return { bounced: !O.spirits.includes(foe), bp: BS.bpOf ? BS.bpOf(me) : null, base: BS.CARDS['BS23-020'].levels[0].bp };
  }, syms);
}
test('Q4497 Rush: white only bounces, blue only gives +3000, both do both, none does nothing (High Speed summon)', async () => {
  const w = await rush(['white']), b = await rush(['blue']), wb = await rush(['white', 'blue']), n = await rush([]);
  assert.equal(w.bounced, true); assert.equal(w.bp, w.base);
  assert.equal(b.bounced, false); assert.equal(b.bp, b.base + 3000);
  assert.equal(wb.bounced, true); assert.equal(wb.bp, wb.base + 3000);
  assert.equal(n.bounced, false); assert.equal(n.bp, n.base);
});
