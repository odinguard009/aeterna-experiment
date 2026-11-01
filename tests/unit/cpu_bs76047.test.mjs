// BS76-047 (The ThunderDragon Togevajdra): the CPU must play it even when it is the only card in its Hand
// (noted by the player-view pass in v0.45.0).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });

const PRE = `BS.testSetup(); BS.setSimProfiles({}); BS.SETTINGS.cpuProfile = 'balanced';
  const G = BS.G, O = G.p.opponent; O.nexus = []; O.spirits = []; O.burst = null; O.mirage = null;`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('T01 BS76-047 as the only Hand card: cpuCanPlay and cpuPlayScore accept it', async () => {
  const r = await ev(`O.hand = [BS.mkInst('BS76-047')]; O.reserve.n = 6;
    return { can: BS.cpuCanPlay ? BS.cpuCanPlay(O, O.hand[0]) : null, sc: BS.cpuPlayScore(O, O.hand[0]), cost: BS.effCost(O, BS.CARDS['BS76-047']) };`);
  assert.equal(r.can, true, JSON.stringify(r));
  assert.ok(r.sc > 0, JSON.stringify(r));
});
test('T02 BS76-047 as the only Hand card: cpuMain summons it', async () => {
  const r = await ev(`O.hand = [BS.mkInst('BS76-047')]; O.reserve.n = 6;
    await BS.cpuMain(O);
    return { spirits: O.spirits.map(s => s.id), hand: O.hand.map(h => h.id) };`);
  assert.deepEqual(r.spirits, ['BS76-047'], JSON.stringify(r));
  assert.deepEqual(r.hand, [], JSON.stringify(r));
});
test('T03 BS76-047 with another card in Hand is still played', async () => {
  const r = await ev(`O.hand = [BS.mkInst('BS76-047'), BS.mkInst('BS76-001')]; O.reserve.n = 7;
    await BS.cpuMain(O);
    return O.spirits.map(s => s.id).sort();`);
  assert.ok(r.includes('BS76-047'), JSON.stringify(r));
});

for (const prof of ['balanced', 'aggressive', 'defensive']) {
  test(`T04 ${prof} profile plays BS76-047 as the only Hand card`, async () => {
    const r = await ev(`BS.SETTINGS.cpuProfile = '${prof}'; O.hand = [BS.mkInst('BS76-047')]; O.reserve.n = 5; await BS.cpuMain(O); BS.SETTINGS.cpuProfile = 'balanced'; return O.spirits.map(s => s.id);`);
    assert.deepEqual(r, ['BS76-047']);
  });
}
for (const [n, can] of [[3, false], [4, true], [5, true], [8, true]]) {
  test(`T05 reserve ${n}: cpuCanPlay is ${can}`, async () => {
    const r = await ev(`O.hand = [BS.mkInst('BS76-047')]; O.reserve.n = ${n}; return BS.cpuCanPlay(O, O.hand[0]);`);
    assert.equal(r, can);
  });
}
test('T06 reserve 3: cpuMain leaves the card in Hand (cannot pay)', async () => {
  const r = await ev(`O.hand = [BS.mkInst('BS76-047')]; O.reserve.n = 3; await BS.cpuMain(O); return { s: O.spirits.length, h: O.hand.length };`);
  assert.deepEqual(r, { s: 0, h: 1 });
});
test('T07 a full cpuTurn with only BS76-047 in Hand summons it', async () => {
  const r = await ev(`O.hand = [BS.mkInst('BS76-047')]; O.reserve.n = 5; await BS.cpuTurn(O); return O.spirits.map(s => s.id);`);
  assert.deepEqual(r, ['BS76-047']);
});
test('T08 BS76-047 stays summonable when its own deck is nearly empty', async () => {
  const r = await ev(`O.hand = [BS.mkInst('BS76-047')]; O.deck = O.deck.slice(0, 3); O.reserve.n = 5; await BS.cpuTurn(O); return O.spirits.map(s => s.id);`);
  assert.deepEqual(r, ['BS76-047']);
});
test('T09 BS76-047 card data: cost 4, one symbol, Lv1 3000 BP', async () => {
  const r = await ev(`const c = BS.CARDS['BS76-047']; return [c.cost, c.symbols, c.levels[0].bp, c.reduction.yellow];`);
  assert.deepEqual(r, [4, 1, 3000, 2]);
});
