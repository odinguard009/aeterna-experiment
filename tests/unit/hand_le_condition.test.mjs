// v0.166.0 condition handLe: "If your Hand is five or less" (the owner's Hand size when the action resolves).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('HL166-01 Faltex: the LV2 attack draws only while the Hand is five cards or fewer', async () => {
  const run = hand => ev(`const s = BS.mkInst('26RSD09-004'); s.cores = 3; P.spirits.push(s);
    for (let i = 0; i < ${hand}; i++) P.hand.push(BS.mkInst('BS75-001')); for (let i = 0; i < 3; i++) P.deck.push(BS.mkInst('BS75-004'));
    await BS.fireFx(P, 'ATTACKS', s); return P.hand.length;`);
  assert.equal(await run(5), 6);      // five cards: draws one
  assert.equal(await run(4), 5);
  assert.equal(await run(6), 6);      // six cards: no draw
});
