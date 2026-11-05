import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const setup = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;`;

test('K-1703 BS73-026 SheeSheep Symbiotic: complete, flips when a Fungal Bed is destroyed only while Contractor Yum-Kaax is controlled', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const run = async withYk => {
      BS.testSetup(); const P = BS.G.p.player; P.cpu = true; BS.G.active = P.key; BS.G.fxBy = BS.G.p.opponent.key;
      const s = BS.mkInst('BS73-026'); s.cores = 3; P.spirits = [s];
      const bed = BS.mkInst('BS73-T001'); bed.token = true; P.nexus = [bed];
      if (withYk) { const y = BS.mkInst('BS73-CX01'); y.cores = 1; P.nexus.push(y); }
      P.void = 3; P.count = 0;
      BS.removeNexus(P, bed, 'destroyed'); await BS.fireFx(P, 'ALLY_NEXUS_DESTROYED', s, { subject: bed });
      return s.id;
    };
    return { with: await run(true), without: await run(false), fc: BS.CARDS['BS73-026'].partial === false, back: !!BS.CARDS['BS73-026B'] }; })()`);
  const j = JSON.stringify(r);
  assert.equal(r.fc, true, j); assert.equal(r.back, true, j);
  assert.equal(r.with, 'BS73-026B', j); assert.equal(r.without, 'BS73-026', j);
});

test('K-1704 BS73-026 Rebirth on leave: an opposing effect that would remove it flips it instead, only with Contractor Yum-Kaax', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const run = withYk => {
      BS.testSetup(); const P = BS.G.p.player; P.cpu = true; BS.G.active = P.key; BS.G.fxBy = BS.G.p.opponent.key;
      const s = BS.mkInst('BS73-026'); s.cores = 3; P.spirits = [s]; P.nexus = [];
      if (withYk) { const y = BS.mkInst('BS73-CX01'); y.cores = 1; P.nexus.push(y); }
      return BS.rebirthLeave(P, s) ? s.id : 'left';
    };
    return { with: run(true), without: run(false) }; })()`);
  const j = JSON.stringify(r);
  assert.equal(r.with, 'BS73-026B', j); assert.equal(r.without, 'left', j);
});

test('K-1705 BS73-067 Temple: complete, OPP_END_STEP sends a Bed Token only with Yum-Kaax and under five Beds; bedsGe', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const run = async (withYk, beds) => {
      BS.testSetup(); const P = BS.G.p.player; P.cpu = true; BS.G.active = BS.G.p.opponent.key;
      const t = BS.mkInst('BS73-067'); P.nexus = [t]; P.tokens = { 'BS73-T001': 9 }; P.void = 5;
      for (let i = 0; i < beds; i++) { const b = BS.mkInst('BS73-T001'); b.token = true; P.nexus.push(b); }
      if (withYk) { const y = BS.mkInst('BS73-CX01'); y.cores = 1; P.nexus.push(y); }
      const n0 = P.nexus.length;
      await BS.fireFx(P, 'OPP_END_STEP', null, {});
      return P.nexus.length - n0;
    };
    return { yk: await run(true, 0), no: await run(false, 0), full: await run(true, 5), fc: BS.CARDS['BS73-067'].partial === false, fc2: BS.CARDS['BS73-028'].partial === false, b: !!BS.CARDS['BS73-067B'] && !!BS.CARDS['BS73-028B'] }; })()`);
  const j = JSON.stringify(r);
  assert.ok(r.fc && r.fc2 && r.b, j);
  assert.equal(r.yk, 1, j); assert.equal(r.no, 0, j); assert.equal(r.full, 0, j);
});

test('K-1706 BS73-067B Oninarada: +10000 BP with three Beds at LV2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const bp = beds => { BS.testSetup(); const P = BS.G.p.player; P.cpu = true; BS.G.active = P.key;
      const s = BS.mkInst('BS73-067B'); s.cores = 2; P.spirits = [s]; P.nexus = [];
      for (let i = 0; i < beds; i++) { const b = BS.mkInst('BS73-T001'); b.token = true; P.nexus.push(b); }
      return BS.bpOf(s); };
    return { three: bp(3), two: bp(2) }; })()`);
  const j = JSON.stringify(r);
  assert.equal(r.three - r.two, 10000 , j);
});
