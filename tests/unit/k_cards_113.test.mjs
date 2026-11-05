import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1193 BS71-054: returns from the Trash when a Saga Brave is summoned, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const bid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave' && (BS.CARDS[k].families || []).includes('Saga'));
    const nid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave' && !(BS.CARDS[k].families || []).includes('Saga'));
    const sh = BS.mkInst('BS71-054'); P.trash = [sh]; P.hand = [];
    const b2 = BS.mkInst(nid); await BS.fireFx(P, 'ALLY_SUMMONED', b2, { subject: b2 }); const afterNon = P.hand.length;
    const b = BS.mkInst(bid); await BS.fireFx(P, 'ALLY_SUMMONED', b, { subject: b }); const afterSaga = P.hand.length;
    return { fc: BS.CARDS['BS71-054'].partial === false, afterNon, afterSaga, inTrash: P.trash.includes(sh) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.afterNon, 0, JSON.stringify(r)); assert.equal(r.afterSaga, 1, JSON.stringify(r));
});
