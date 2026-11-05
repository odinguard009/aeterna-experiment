import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1149 BS34-071 The World of Owari: God-Sechs Spirits count as highest level in your Attack Step; at LV2 only the highest-BP opposing Spirit can block them', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels.length > 1);
    const gs = BS.mkInst('BS34-016'); gs.cores = 1; P.spirits = [gs];
    const nx = BS.mkInst('BS34-071'); nx.cores = 0; P.nexus = [nx];
    const lv1 = BS.lvIndex(gs);
    nx.cores = 3; const lvNx = BS.lvIndex(gs);
    const weak = BS.mkInst(any), strong = BS.mkInst(any); strong.cores = 5; O.spirits = [weak, strong];
    const can = O.spirits.filter(s => !BS.unblockableLow(P, gs, s)).length;
    G.step = 4; const lvOff = BS.lvIndex(gs);
    return { lv1, lvNx, can, lvOff, partial: BS.CARDS['BS34-071'].partial, strongBp: BS.bpOf(strong), weakBp: BS.bpOf(weak) }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r));
  assert.equal(r.lv1, 2, JSON.stringify(r)); assert.equal(r.lvNx, 2, JSON.stringify(r)); assert.equal(r.lvOff, 0, JSON.stringify(r));
  assert.equal(r.can, 1, JSON.stringify(r));
});
