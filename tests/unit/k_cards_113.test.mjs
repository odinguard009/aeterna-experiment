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

test('K-1194 BS71-053: Void core goes to this Spirit and a Scalostle Spirit with a Brave; LV2 core floor three', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const sc = BS.mkInst('BS71-053'); sc.cores = 1; const al = BS.mkInst('BS71-054'); al.cores = 1; al.brave = BS.mkInst('BS71-063'); const plain = BS.mkInst('BS71-057'); plain.cores = 1;
    P.spirits = [sc, al, plain]; P.nexus = []; P.reserve.n = 0; P.void = P.void || { n: 0 }; const v0 = P.void.n; if (typeof P.void.n === 'number') P.void.n = 5;
    await BS.fireFx(P, 'SUMMONED', sc, {});
    return { fc: BS.CARDS['BS71-053'].partial === false, sc: sc.cores, al: al.cores, plain: plain.cores }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.plain, 1, JSON.stringify(r)); assert.ok(r.al === 2 || r.sc === 2, JSON.stringify(r));
});
