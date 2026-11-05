import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1211 BS72-X07: LV2 attack makes the opponent discard Hand + Removed down to three; four or fewer is untouched', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit').slice(0, 12);
    const x = BS.mkInst('BS72-X07'); x.cores = 3; P.spirits = [x];
    const run = async (h, rm) => { O.hand = ids.slice(0, h).map(i => BS.mkInst(i)); O.removed = ids.slice(6, 6 + rm).map(i => BS.mkInst(i)); O.trash = [];
      await BS.fireFx(P, 'ATTACKS', x, {}); return { tot: O.hand.length + O.removed.length, trash: O.trash.length }; };
    const four = await run(2, 2), five = await run(3, 3);
    return { fc: BS.CARDS['BS72-X07'].partial === false, four, five }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.deepEqual(r.four, { tot: 4, trash: 0 }, JSON.stringify(r)); assert.deepEqual(r.five, { tot: 3, trash: 3 }, JSON.stringify(r));
});

test('K-1212 BS72-051: Main LV2 exhausts a Contractor Nuadha Nexus and braves a Scalostle Brave from the Trash (cost <= counters)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const bid = 'BS71-063';
    const sp = BS.mkInst('BS72-051'); sp.cores = 3; const nx = BS.mkInst('BS71-CX03'); nx.cores = 2; P.spirits = [sp]; P.nexus = [nx];
    const b = BS.mkInst(bid); P.trash = [b]; P.hand = []; P.count = 0;
    await BS.fireFx(P, 'ACTIVATE', sp, {}); const lowCount = { brave: !!sp.brave, ex: nx.exhausted };
    P.count = 5; await BS.fireFx(P, 'ACTIVATE', sp, {});
    return { fc: BS.CARDS['BS72-051'].partial === false, bid, lowCount, brave: sp.brave && sp.brave.uid === b.uid, ex: nx.exhausted, trash: P.trash.length }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.deepEqual(r.lowCount, { brave: false, ex: false }, JSON.stringify(r)); assert.equal(r.brave, true, JSON.stringify(r)); assert.equal(r.ex, true, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r));
});
