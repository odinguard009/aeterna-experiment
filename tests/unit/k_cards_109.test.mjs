import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1107 BS69-033 Guneus: Burst after an opposing Summoned effect summons it and heavy exhausts two; a set copy also activates when cards go to the opposing Removed Zone; Summoned bounces an exhausted Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost <= 3 && k !== 'BS69-033');
    const b = BS.mkInst('BS69-033'); P.burst = b; P.spirits = [];
    const t1 = BS.mkInst(any), t2 = BS.mkInst(any); t1.cores = t2.cores = 2; O.spirits = [t1, t2];
    await BS.maybeBurst(P, 'OPP_REMOVED', {});
    return { summoned: P.spirits.includes(b), heavy: [t1, t2].filter(t => t.heavy).length, left: O.spirits.length, also: BS.CARDS['BS69-033'].burst.also.when, partial: BS.CARDS['BS69-033'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.also, 'OPP_REMOVED', JSON.stringify(r));
  assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.heavy, 1, JSON.stringify(r)); assert.equal(r.left, 1, JSON.stringify(r));   // both heavy exhausted, then the Summoned effect returns one exhausted Spirit to the deck bottom
});
