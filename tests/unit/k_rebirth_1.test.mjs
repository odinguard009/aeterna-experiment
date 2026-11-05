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

test('K-1305 SD57-006: opposing destroy flips the Nexus to the Spirit back face with the Soul Core; Return to Prime flips it back', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key;
    const n = BS.mkInst('SD57-006'); n.cores = 0; n.soul = false; P.nexus = [n]; P.spirits = []; P.reserve.soul = true; P.void = 1; P.count = 0; O.spirits = [];
    G.fxBy = O.key; BS.removeNexus(P, n, 'destroyed'); await BS.flushBursts();
    const a = { id: n.id, nex: P.nexus.length, sp: P.spirits.length, soul: n.soul };
    G.fxBy = O.key; BS.removeSpirit(P, n, 'destroyed', false); await BS.flushBursts();
    const b = { id: n.id, nex: P.nexus.length, sp: P.spirits.length };
    G.fxBy = null; return { a, b }; })()`);
  assert.deepEqual([r.a.id, r.a.nex, r.a.sp, r.a.soul], ['SD57-006B', 0, 1, true], JSON.stringify(r));
  assert.deepEqual([r.b.id, r.b.nex, r.b.sp], ['SD57-006', 1, 0], JSON.stringify(r));
});

test('K-1306 SD57-006B reborn returns an opposing Spirit to the deckbottom and (5 colours) destroys 5 non-Primal Grandwalker Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const s = BS.mkInst('SD57-006B'); s.cores = 1; P.spirits = [s, ...['BS01-021','BS01-062','BS01-096','BS03-071','BS07-010'].map(i => { const x = BS.mkInst(i); x.cores = 1; return x; })]; P.nexus = [];
    const t = BS.mkInst('BS01-001'); t.cores = 2; O.spirits = [t]; O.nexus = Array.from({ length: 6 }, () => BS.mkInst('BS48-X08'));
    const gw = O.nexus.filter(x => BS.CARDS[x.id].families.some(f => f === 'Grandwalker')).length;
    await BS.fireFx(P, 'REBORN', s, {});
    return { gw, spirits: O.spirits.length, nex: O.nexus.length }; })()`);
  assert.deepEqual([r.gw, r.spirits, r.nex], [6, 0, 1], JSON.stringify(r));
});
