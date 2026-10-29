// v0.195.0 Lane K: condition viaLegacy and BOUNCE_OPP bpLe/n (Lycao-Culus 26RBS02-046).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { quietBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

async function run(legacyN) {
  const { page } = await quietBoard();
  return page.evaluate(async legacyN => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;   // CPU seat auto-picks targets
    const small = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.levels[0].bp <= 3000 && !(c.effects && c.effects.length)).slice(0, 2);
    const foes = small.map(c => { const s = BS.mkInst(c.id); s.cores = 1; O.spirits.push(s); return s; });
    const src = BS.mkInst('26RBS02-046'); src.cores = 1; src.legacyN = legacyN; P.spirits.push(src);
    const deck0 = O.deck.length, hand0 = O.hand.length;
    await BS.fireFx(P, 'SUMMONED', src, {});
    return { gone: foes.filter(f => !O.spirits.includes(f)).length, deck: O.deck.length - deck0, hand: O.hand.length - hand0 };
  }, legacyN);
}

test('K-01 Lycao-Culus: with Legacy two small Spirits go to the deck bottom, without they go to the hand', async () => {
  const a = await run(1), b = await run(0);
  assert.deepEqual(a, { gone: 2, deck: 2, hand: 0 });
  assert.deepEqual(b, { gone: 2, deck: 0, hand: 2 });
});

test('K-02 Hargris counts other Purgatory Wings Spirits only; Pacugna +2000 attacking, +5000 with a Cost 6/8 Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(() => {
    const G = BS.G, P = G.p.player; G.active = P.key;
    const fam = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && (c.families || []).includes('Purgatory Wings') && c.id !== '26RBS03-003' && !(c.effects && c.effects.length)).slice(0, 2);
    const h = BS.mkInst('26RBS03-003'); h.cores = 1; P.spirits.push(h);
    const alone = BS.bpOf(h); fam.forEach(c => { const s = BS.mkInst(c.id); s.cores = 1; P.spirits.push(s); });
    const withTwo = BS.bpOf(h);
    const pac = BS.mkInst('26RBS03-048'); pac.cores = 1; P.spirits.push(pac); G.attacker = pac;
    const lowCost = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && ![6, 8].includes(c.cost) && c.cost !== BS.CARDS['26RBS03-048'].cost);
    const base = BS.CARDS['26RBS03-048'].levels[0].bp, plain = BS.bpOf(pac) - base;
    const big = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost === 6 && !(c.effects && c.effects.length)); const b = BS.mkInst(big.id); b.cores = 1; P.spirits.push(b);
    return { alone, withTwo, plain, withBig: BS.bpOf(pac) - base };
  });
  assert.equal(r.withTwo - r.alone, 2000);
  assert.equal(r.plain, 2000);
  assert.equal(r.withBig, 5000);
});

test('K-03 Sertarius returns a Windfang from the Trash but never another Sertarius; Savatoma sends to the deck bottom with an exhausted Mineroid', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    const wf = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Windfang') && c.name !== 'Sertarius');
    const twin = BS.mkInst('26RSD01-008'); P.trash.push(twin);
    const src = BS.mkInst('26RSD01-008'); src.cores = 1; P.spirits.push(src);
    await BS.fireFx(P, 'SUMMONED', src, {});
    const onlySelfName = !P.hand.includes(twin);
    const w = BS.mkInst(wf.id); P.trash.push(w);
    await BS.fireFx(P, 'SUMMONED', src, {});
    const got = P.hand.includes(w);
    const mine = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Mineroid') && !(c.effects && c.effects.length));
    const m = BS.mkInst(mine.id); m.cores = 1; m.exhausted = true; P.spirits.push(m);
    const foe = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Spirit' && !(c.effects && c.effects.length)).id); foe.cores = 1; O.spirits.push(foe);
    const sav = BS.mkInst('26RSD04-X02'); sav.cores = 1; P.spirits.push(sav);
    await BS.fireFx(P, 'SUMMONED', sav, {});
    return { onlySelfName, got, deckBottom: O.deck[O.deck.length - 1] === foe, hand: O.hand.includes(foe) };
  });
  assert.deepEqual(r, { onlySelfName: true, got: true, deckBottom: true, hand: false });
});

test('K-04 Spinard destroys two opposing 3000 BP or less Spirits with a Purgatory Wings Spirit, otherwise one', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    const small = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels[0].bp <= 3000 && !(c.effects && c.effects.length));
    const mk = () => { const f = BS.mkInst(small.id); f.cores = 1; O.spirits.push(f); return f; };
    const [a, b, c3] = [mk(), mk(), mk()];
    const src = BS.mkInst('26RSD09-008'); src.cores = 1; P.spirits.push(src);
    await BS.fireFx(P, 'SUMMONED', src, {});
    const one = O.spirits.length;
    const pw = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Purgatory Wings') && !(c.effects && c.effects.length));
    const w = BS.mkInst(pw.id); w.cores = 1; P.spirits.push(w);
    await BS.fireFx(P, 'SUMMONED', src, {});
    return { one, two: O.spirits.length };
  });
  assert.deepEqual(r, { one: 2, two: 0 });
});
