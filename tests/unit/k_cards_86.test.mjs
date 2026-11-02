// Lane K tests, file 86: MIRAGE_SET trigger (During Set / When Set), schema 341, BS58-001.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-860 BS58-001 data: complete, Mirage cost 4, one MIRAGE_SET effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => { const c = BS.CARDS['BS58-001']; return [c.partial || false, c.mirage && c.mirage.cost, (c.effects || []).map(e => e.trigger)]; });
  assert.deepEqual(r, [false, 4, ['MIRAGE_SET']], JSON.stringify(r));
});

test('K-861 MIRAGE_SET: fires only from the set Mirage; destroys an opposing Nexus and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
    const filler = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects && !BS.CARDS[k].token);
    for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst(filler));
    const nx = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && !BS.CARDS[k].effects && !BS.CARDS[k].token);
    O.nexus.push(BS.mkInst(nx));
    const m = BS.mkInst('BS58-001');
    const h0 = P.hand.length, n0 = O.nexus.length;
    await BS.fireFx(P, 'MIRAGE_SET', m, {});              // not the set Mirage: nothing happens
    const idle = [P.hand.length - h0, O.nexus.length - n0];
    m.mirage = true; P.mirage = m;
    await BS.fireFx(P, 'MIRAGE_SET', m, {});
    return [idle, P.hand.length - h0, O.nexus.length - n0];
  });
  assert.deepEqual(r, [[0, 0], 1, -1], JSON.stringify(r));
});
