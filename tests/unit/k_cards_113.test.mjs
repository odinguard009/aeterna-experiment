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

test('K-1195 BS71-057: Brave LV2 core to Nuadha and once-per-turn refresh when this Spirit destroys by effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const m = BS.mkInst('BS71-057'); m.cores = 3; m.brave = BS.mkInst('BS71-063'); m.exhausted = true; const nx = BS.mkInst('BS71-CX03'); nx.cores = 2; P.spirits = [m]; P.nexus = [nx]; P.void = P.void || { n: 0 }; if (typeof P.void.n === 'number') P.void.n = 9;
    const mk = () => { const t = BS.mkInst('BS71-053'); t.cores = 1; return t; };
    await BS.fireFx(P, 'OPP_DESTROYED_FX', null, { bp: 3000, fxSrc: m }); const c1 = nx.cores, ex1 = m.exhausted;
    await BS.fireFx(P, 'OPP_DESTROYED_FX', null, { bp: 3000, fxSrc: {} });
    return { fc: BS.CARDS['BS71-057'].partial === false, c1, ex1, c2: nx.cores }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.ex1, false, JSON.stringify(r)); assert.ok(r.c1 > 2, JSON.stringify(r)); assert.equal(r.c2, r.c1, JSON.stringify(r));
});

test('K-1196 BS72-074: End Step LV2 draws two with Contractor Nuadha then discards down to three; Hand protected at five or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const nid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name.toLowerCase().includes('contractor nuadha'));
    const bn = BS.mkInst('BS72-074'); bn.cores = 2; P.nexus = [bn]; P.spirits = [];
    const filler = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit');
    P.deck = Array.from({ length: 10 }, () => BS.mkInst(filler)); P.hand = [BS.mkInst(filler), BS.mkInst(filler), BS.mkInst(filler)];
    await BS.fireFx(P, 'END_STEP', bn, {}); const noNuadha = P.hand.length;
    const sp = BS.mkInst(nid); sp.cores = 1; P.spirits = [sp];
    await BS.fireFx(P, 'END_STEP', bn, {});
    return { fc: BS.CARDS['BS72-074'].partial === false, noNuadha, after: P.hand.length, trash: P.trash.length }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.noNuadha, 3, JSON.stringify(r)); assert.equal(r.after, 3, JSON.stringify(r)); assert.equal(r.trash, 2, JSON.stringify(r));
});

test('K-1197 BS71-063: braved Spirit refreshes by exhausting a Nexus with six or more counters, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const sp = BS.mkInst('BS71-054'); sp.cores = 1; sp.exhausted = true; sp.brave = BS.mkInst('BS71-063'); const nx = BS.mkInst('BS72-074'); nx.cores = 2; P.spirits = [sp]; P.nexus = [nx];
    P.count = 5; await BS.fireFx(P, 'ATTACKS', sp, {}); const low = { ex: sp.exhausted, nx: nx.exhausted };
    P.count = 6; await BS.fireFx(P, 'ATTACKS', sp, {});
    return { fc: BS.CARDS['BS71-063'].partial === false, low, ex: sp.exhausted, nx: nx.exhausted }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.deepEqual(r.low, { ex: true, nx: false }, JSON.stringify(r)); assert.equal(r.ex, false, JSON.stringify(r)); assert.equal(r.nx, true, JSON.stringify(r));
});
