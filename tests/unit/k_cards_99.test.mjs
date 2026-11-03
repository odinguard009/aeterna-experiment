import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1046 BS58-014 Vanderas: Summoned draws a card; the White Rush puts a core per two opposing Hand cards on itself, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const v = BS.mkInst('BS58-014'); v.cores = 1; P.spirits = [v]; O.spirits = [];
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    O.hand = [1, 2, 3, 4, 5].map(() => BS.mkInst(any));
    const wk = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].symbols || 0) >= 1 && (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).includes('white'));
    P.nexus = []; const w = BS.mkInst(wk); w.cores = 1; P.spirits.push(w);
    P.reserve.n = 0; P.void = 4; const h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', v, { subject: v }); const c1 = v.cores; await BS.fireFx(P, 'SUMMONED', v, { subject: v });
    return { drew: P.hand.length - h0, partial: BS.CARDS['BS58-014'].partial, c1, c2: v.cores, fx: BS.CARDS['BS58-014'].effects.length }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.fx, 3, JSON.stringify(r)); assert.equal(r.drew, 2, JSON.stringify(r)); assert.equal(r.c1, 3, JSON.stringify(r)); assert.equal(r.c2, 3, JSON.stringify(r));
});
