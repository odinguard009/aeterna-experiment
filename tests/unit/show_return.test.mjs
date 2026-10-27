// v0.165.0 SHOW_RETURN: "Show up to N <X> cards from your Hand to the opponent. Return them to the deckbottom. For each card returned, draw a card."
// (drawEach), "If two cards are returned, draw three cards." (drawIf), and "If returned, ..." following it (ctx.did).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('SR165-01 Skilled Fox-style effect: two matching cards returned, one drawn per card; other cards stay', async () => {
  const r = await ev(`const s = BS.mkInst('26RCB01-030'); s.cores = 1; P.spirits.push(s);
    for (const id of ['26RCB01-025', '26RCB01-026', '26RCB01-029', 'BS75-001']) P.hand.push(BS.mkInst(id));
    for (const id of ['BS75-004', 'BS75-006', 'BS75-008']) P.deck.push(BS.mkInst(id));
    await BS.fireFx(P, 'SUMMONED', s);
    return [P.hand.length, P.deck.length, P.hand.some(h => h.id === 'BS75-001'), P.deck.filter(d => d.id.startsWith('26RCB01')).length];`);
  // hand 4 -> return 2 (hand 2, deck 5) -> draw 2 (hand 4, deck 3); BS75-001 never moves, and the deck holds the RYUKI cards it drew the other way round
  assert.deepEqual(r.slice(0, 3), [4, 3, true]);
  assert.equal(r[3], 2, 'the two returned cards are the ones left on the deck: the draw takes the original top cards');
});

test('SR165-02 drawIf: only two returned cards draw three; one returned draws nothing', async () => {
  const run = n => ev(`const T = 'Thunder Dragon'; const a = { do: 'SHOW_RETURN', max: 2, match: { family: [T] }, drawIf: { n: 2, draw: 3 } };
    const src = BS.mkInst('26RSD05-013'); for (let i = 0; i < ${n}; i++) P.hand.push(BS.mkInst('26RSD05-002'));
    for (let i = 0; i < 5; i++) P.deck.push(BS.mkInst('BS75-004'));
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: [a] }); return [P.hand.length, P.deck.length];`);
  assert.deepEqual(await run(2), [3, 4]);      // 2 returned (deck 7), 3 drawn (hand 3, deck 4)
  assert.deepEqual(await run(1), [0, 6]);      // 1 returned, no draw
});

test('SR165-03 no matching card in hand: nothing happens and "If returned" does not follow', async () => {
  const r = await ev(`const s = BS.mkInst('26RCB01-020'); s.cores = 1; P.spirits.push(s);
    P.hand.push(BS.mkInst('BS75-001')); const t = BS.mkInst('BS75-004'); t.cores = 1; t.exhausted = true; O.spirits.push(t);
    await BS.fireFx(P, 'SUMMONED', s); return [P.hand.length, O.spirits.length];`);
  assert.deepEqual(r, [1, 1]);
});

test('SR165-04 "If returned": the follow-up destroy runs only when a card was returned', async () => {
  const run = hand => ev(`const s = BS.mkInst('26RCB01-020'); s.cores = 1; P.spirits.push(s);
    for (const id of ${JSON.stringify(hand)}) P.hand.push(BS.mkInst(id));
    const t = BS.mkInst('BS75-004'); t.cores = 1; t.exhausted = true; O.spirits.push(t);
    await BS.fireFx(P, 'SUMMONED', s); return [P.hand.length, O.spirits.length];`);
  assert.deepEqual(await run(['26RSD07-010']), [0, 0]);
  assert.deepEqual(await run(['BS75-001']), [1, 1]);
});
