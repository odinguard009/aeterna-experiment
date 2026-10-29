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
