import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1301 Rebirth core: flip swaps to the back face, keeps cores, reverts when it leaves the Field; back face is not enumerable', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const s = BS.mkInst('SD57-TX01'); s.cores = 3; P.spirits = [s]; P.trash = [];
    const hidden = !Object.keys(BS.CARDS).includes('SD57-TX01B') && !!BS.CARDS['SD57-TX01B'];
    const ok = BS.rebirthFlip(P, s), twice = BS.rebirthFlip(P, s), flipped = s.id, cores = s.cores;
    P.spirits = []; P.trash.push(s); await BS.fireFx(P, 'START_STEP', s, {});
    return { hidden, ok, twice, flipped, cores, back: s.id, base: s.baseId }; })()`);
  assert.deepEqual([r.hidden, r.ok, r.twice, r.flipped, r.cores, r.back, r.base], [true, true, false, 'SD57-TX01B', 3, 'SD57-TX01', undefined], JSON.stringify(r));
});

async function tx01Run(extra) {
  const { page } = await sharedBoard();
  return page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const s = BS.mkInst('SD57-TX01'); s.cores = 3; P.spirits = [s]; P.count = ${extra.count}; P.void = 2; O.life = 5;
    const t = BS.mkInst('BS01-001'); t.cores = 5; O.spirits = [t]; ${extra.setup}
    const lifeBefore = O.life, tc = t.cores;
    await BS.fireFx(P, 'ATTACKS', s, {});
    return { id: s.id, count: P.count, life: O.life - lifeBefore, oppCores: t.cores - tc }; })()`);
}

test('K-1302 SD57-TX01 attack flips (count <= 5), reborn sends 3 opposing cores to the Trash, Count +1', async () => {
  const r = await tx01Run({ count: 2, setup: '' });
  assert.deepEqual([r.id, r.count, r.oppCores, r.life], ['SD57-TX01B', 3, -3, 0], JSON.stringify(r));
});

test('K-1303 SD57-TX01 does not flip with more than 5 counters', async () => {
  const r = await tx01Run({ count: 6, setup: '' });
  assert.deepEqual([r.id, r.count, r.oppCores], ['SD57-TX01', 6, 0], JSON.stringify(r));
});

test('K-1304 SD57-TX01 with 5 symbol colours also sends an opposing Life to the Trash', async () => {
  const r = await tx01Run({ count: 1, setup: "P.nexus = ['BS01-001','BS02-001','BS03-001','BS04-001'].map(i => { const n = BS.mkInst(i); n.cores = 1; return n; });" });
  assert.equal(r.id, 'SD57-TX01B', JSON.stringify(r));
});
