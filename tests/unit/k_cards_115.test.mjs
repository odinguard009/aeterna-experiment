import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1401 BS71-CX03 Contract Field: a Scalostle Brave summon puts a Void core on the Brave Spirit; LV2 attack locks a Burst card type', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const fam = Object.values(BS.CARDS).find(c => c.type === 'Brave' && (c.families || []).includes('Scalostle'));
    const nx = BS.mkInst('BS71-CX03'); nx.cores = 3; P.nexus = [nx];
    const sp = BS.mkInst('BS01-001'); sp.cores = 2; sp.brave = BS.mkInst(fam.id); P.spirits = [sp]; P.void = 3; P.count = 3;
    const plain = BS.mkInst('BS01-021'); plain.cores = 1; P.spirits.push(plain);
    const bs = BS.mkInst(fam.id); bs.cores = 1; P.spirits.push(bs);
    await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: bs });
    const gained = sp.cores - 2, voidLeft = P.void;
    O.burst = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Magic' && c.burst).id); G.attacker = sp;
    const before = G.noBurstType;
    await BS.fireFx(P, 'ALLY_ATTACKS', nx, { subject: sp, attacker: sp });
    return { gained, voidLeft, plainCores: plain.cores, before: before || null, lock: G.noBurstType && G.noBurstType.type, key: G.noBurstType && G.noBurstType.key === O.key, fam: fam.id }; })()`);
  assert.equal(r.gained >= 1, true, JSON.stringify(r));
  assert.equal(r.plainCores, 1, JSON.stringify(r));
  assert.equal(r.lock, 'Magic', JSON.stringify(r));
  assert.equal(r.key, true, JSON.stringify(r));
});
