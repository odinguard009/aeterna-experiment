// v0.159.0 LOOT {to:'deckBottom'}: "draw N cards, then return M cards from your Hand to the deckbottom".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('LB159-01 Svarris: draw two, return two to the deckbottom (trash untouched)', async () => {
  const r = await ev(`const s = BS.mkInst('26RSD06-006'); s.cores = 1; P.spirits.push(s);
    for (const id of ['BS75-001', 'BS75-004', 'BS75-006', 'BS75-008', 'BS75-011']) P.deck.push(BS.mkInst(id));
    const n0 = P.deck.length; await BS.fireFx(P, 'SUMMONED', s);
    return [P.hand.length, P.deck.length - n0, P.trash.length, P.deck.length];`);
  // draw 2 (hand 2, deck 3), return 2 (hand 0, deck 5), trash 0
  assert.deepEqual(r, [0, 0, 0, 5]);
});
