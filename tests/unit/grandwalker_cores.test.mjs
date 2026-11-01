// v0.42.1 Grandwalker Nexus cores (Eternal manual pp. 22, 26, 42): they cannot pay costs, cannot be moved by the player (nor moved onto a Grandwalker Nexus)
// and are not counted as cores on the Field. Effects still put cores on / take them off (addCore / direct changes in actions). Quiet boards.
// rules: ETR:main.moving-cores@c47b46af, ETR:cost.paying@06d788b2, ETR:gw.nexus@8bea6dad
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const GW = 'BS74-CX03', NEX = 'BS75-068', T3 = 'BS75-006', T0 = 'BS75-001';   // a Grandwalker Nexus (white Mitra), a plain Nexus (yellow Temple), cost-3 and cost-0 red Spirits
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; }, dk = (id, q = P) => { const i = BS.mkInst(id); q.deck.push(i); return i; };
  const ids = L => L.map(x => x.id);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('G01 isGW: a Grandwalker Nexus yes, a plain Nexus and a Spirit no', async () => {
  assert.deepEqual(await ev(`return [BS.isGW(nx('${GW}')), BS.isGW(nx('${NEX}')), BS.isGW(sp('${T3}'))];`), [true, false, false]);
});
test('G02 cores on a Grandwalker Nexus are not counted as available cores (coresAvailable)', async () => {
  const r = await ev(`P.reserve.n = 2; const a = BS.coresAvailable(P); nx('${GW}', P, 4); return [a, BS.coresAvailable(P)];`);
  assert.deepEqual(r, [2, 2]);
});
test('G03 cores on a plain Nexus still count', async () => {
  const r = await ev(`P.reserve.n = 2; nx('${NEX}', P, 3); return BS.coresAvailable(P);`);
  assert.equal(r, 5);
});
test('G04 takeCores never takes a core of a Grandwalker Nexus (Reserve empty, only the Nexus has cores)', async () => {
  const r = await ev(`P.reserve.n = 0; const n = nx('${GW}', P, 5); const got = BS.takeCores(P, 3, null); return [got.n, n.cores];`);
  assert.deepEqual(r, [0, 5]);
});
test('G05 takeCores takes from a plain Nexus but leaves the Grandwalker Nexus alone', async () => {
  const r = await ev(`P.reserve.n = 0; const a = nx('${GW}', P, 5), b = nx('${NEX}', P, 2); const got = BS.takeCores(P, 3, null); return [got.n, a.cores, b.cores];`);
  assert.deepEqual(r, [2, 5, 0]);
});
test('G06 a card that costs more than Reserve + normal cores cannot be played although the Grandwalker Nexus holds cores (canPlayCard)', async () => {
  const r = await ev(`P.reserve.n = 2; nx('${GW}', P, 6); const c = hd('${T3}', P); return BS.canPlayCard(P, c);`);
  assert.equal(r, false);
});
test('G07 the same card is playable when the cores are in the Reserve instead', async () => {
  const r = await ev(`P.reserve.n = 8; nx('${GW}', P, 6); const c = hd('${T3}', P); return BS.canPlayCard(P, c);`);
  assert.equal(r, true);
});
test('G08 the CPU does not count Grandwalker cores either (cpuCanPlay)', async () => {
  const r = await ev(`P.reserve.n = 2; nx('${GW}', P, 6); const c = hd('${T3}', P); return BS.cpuCanPlay(P, c);`);
  assert.equal(r, false);
});
test('G09 moveCore refuses a Grandwalker Nexus as source and as target', async () => {
  const r = await ev(`const a = nx('${GW}', P, 3), s = sp('${T3}', P, 3), b = nx('${NEX}', P, 1); return [BS.moveCore(P, a, s), BS.moveCore(P, s, a), BS.moveCore(P, b, s), a.cores, s.cores, b.cores];`);
  assert.deepEqual(r, [false, false, true, 3, 4, 0]);
});
test('G10 swapSoul refuses a Grandwalker Nexus on either side', async () => {
  const r = await ev(`const a = nx('${GW}', P, 3), s = sp('${T3}', P, 3); s.soul = true; const x = BS.swapSoul(P, s, a); a.soul = true; s.soul = false; const y = BS.swapSoul(P, a, s); return [x, y];`);
  assert.deepEqual(r, [false, false]);
});
test('G11 effects can still put cores on a Grandwalker Nexus (addCore from the Reserve, as Neo-Core Charge style effects do)', async () => {
  const r = await ev(`P.reserve.n = 3; const a = nx('${GW}', P, 0); BS.addCore(P, a); return [a.cores, P.reserve.n];`);
  assert.deepEqual(r, [1, 2]);
});
test('G12 a Spirit summoned for free does not draw its starting cores from a Grandwalker Nexus', async () => {
  const r = await ev(`P.reserve.n = 0; const a = nx('${GW}', P, 5); const got = BS.takeCores(P, 1, null); return [got.n, a.cores];`);
  assert.deepEqual(r, [0, 5]);
});
test('G13 paying with plan-less payCost uses only the Reserve when the Grandwalker Nexus holds the rest', async () => {
  const r = await ev(`P.reserve.n = 2; const a = nx('${GW}', P, 5); BS.payCost(P, 2, null); return [P.reserve.n, a.cores];`);
  assert.deepEqual(r, [0, 5]);
});
test('G14 a Spirit with spare cores is still a payment source', async () => {
  const r = await ev(`P.reserve.n = 0; const s = sp('${T3}', P, 3); const got = BS.takeCores(P, 2, null); return [got.n, s.cores];`);
  assert.deepEqual(r, [2, 1]);
});
test('G15 the Soul Core on a Grandwalker Nexus keeps its old behaviour (not covered by pp. 22/26)', async () => {
  const r = await ev(`P.reserve.n = 0; const a = nx('${GW}', P, 0); a.soul = true; return BS.coresAvailable(P);`);
  assert.equal(r, 1);
});
