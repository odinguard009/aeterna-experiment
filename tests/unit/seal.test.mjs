// v0.48.0 Seal (Eternal manual p.49): a Seal effect moves your Soul Core to your Life; while it is there you are Sealed and
// [During Seal] effects work. The Soul Core in Life counts as a Life core; when Life is reduced the player chooses which core leaves
// (engine default: the Soul Core stays while a normal core can go). Seal Manifest (BS76-X02): the Soul Core goes from the Field/Reserve to the Life.
// rules: ETR:seal@f7999858
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const REVOL = 'BS76-X02', ZEUS = 'BS71-CX01', MOLE = 'BS76-001', HOUND = 'BS68-014';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; q.trashCores.n = 0; q.trashCores.soul = false; q.life = 5; q.lifeSoul = false; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('S01 Seal: the Soul Core moves from the Reserve to the Life, Life +1, the player is Sealed', async () => {
  const r = await ev(`P.reserve.soul = true; const a = BS.isSealed(P); const ok = BS.soulToLife(P, 'reserve');
    return [a, ok, P.life, P.lifeSoul, P.reserve.soul, BS.isSealed(P), BS.fxIf(P, O, { sealed: true }), BS.fxIf(P, O, { sealed: false })];`);
  assert.deepEqual(r, [false, true, 6, true, false, true, true, false]);
});
test('S02 a Life reduction takes normal cores first: the Soul Core stays in the Life', async () => {
  const r = await ev(`P.reserve.soul = true; BS.soulToLife(P, 'reserve'); const res = P.reserve.n; BS.lifeTake(P, 2, 'reserve');
    return [P.life, P.lifeSoul, P.reserve.n - res, P.reserve.soul, BS.isSealed(P)];`);
  assert.deepEqual(r, [4, true, 2, false, true]);
});
test('S03 when the last Life cores leave, the Soul Core goes with them and the Seal ends', async () => {
  const r = await ev(`P.life = 1; P.reserve.n = 11; P.reserve.soul = true; BS.soulToLife(P, 'reserve'); const res = P.reserve.n; BS.lifeTake(P, 2, 'reserve');
    return [P.life, P.lifeSoul, P.reserve.n - res, P.reserve.soul, BS.isSealed(P)];`);
  assert.deepEqual(r, [0, false, 1, true, false]);
});
test('S04 a Soul Core leaving the Life to the Trash lands in the Trash', async () => {
  const r = await ev(`P.life = 0; P.reserve.n = 12; P.reserve.soul = true; BS.soulToLife(P, 'reserve'); BS.lifeTake(P, 1, 'trash'); return [P.life, P.trashCores.n, P.trashCores.soul];`);
  assert.deepEqual(r, [0, 0, true]);
});
test('S05 core and Soul Core counts stay consistent while Sealed', async () => {
  assert.equal(await ev(`P.reserve.soul = true; O.reserve.soul = true; BS.soulToLife(P, 'reserve'); P.made = [P.life - 1, P.reserve.n, P.trashCores.n, P.count, P.void].reduce((a, b) => a + b);
    O.made = [O.life, O.reserve.n, O.trashCores.n, O.count, O.void].reduce((a, b) => a + b); P.deckSize = 0; O.deckSize = 0; try { BS.checkInvariants(); return 'ok'; } catch (e) { return e.message; }`), 'ok');
});
const rev = (count = 6, nc = 1) => `const z = nx('${ZEUS}', P, ${nc}); P.count = ${count}; P.reserve.soul = true; const r = hd('${REVOL}');`;
test('S06 Seal Manifest: the Soul Core goes to the Life, one core is paid from "Contractor Zeus", Revol-Tiger X is summoned', async () => {
  const r = await ev(rev() + ` const life = P.life, T = BS.manifestTargets(P, r, 'main'); await BS.doManifest(P, r, T[0], 'main');
    return [T.length, P.spirits.includes(r), P.life - life, P.lifeSoul, P.reserve.soul, z.cores, P.trashCores.n];`);
  assert.deepEqual(r, [1, true, 1, true, false, 0, 1]);
});
test('S07 Seal Manifest needs 6 counters, your turn and a core on the Nexus', async () => {
  const r = await ev(rev(5) + ` const a = BS.manifestTargets(P, r, 'main').length; P.count = 6; G.active = O.key; const b = BS.manifestTargets(P, r, 'main').length;
    G.active = P.key; z.cores = 0; const c = BS.manifestTargets(P, r, 'main').length; z.cores = 1; return [a, b, c, BS.manifestTargets(P, r, 'main').length];`);
  assert.deepEqual(r, [0, 0, 0, 1]);
});
const bomb = sealed => rev() + ` ${sealed ? "await BS.doManifest(P, r, z, 'main');" : 'P.hand = []; P.spirits.push(r); r.cores = 1;'}
  const d1 = BS.mkInst('${MOLE}'), d2 = BS.mkInst('${HOUND}'); P.deck = [d1, d2, BS.mkInst('${HOUND}')]; const ol = O.life, orv = O.reserve.n;
  await BS.fireFx(P, 'ATTACKS', r); return [O.life - ol, O.reserve.n - orv, P.hand.includes(d1), P.hand.includes(d2), P.deck.length];`;
test('S08 [During Seal] Thunder God Bombardment: reveal two, one opposing Life to the Reserve per "Zeus"/"Z"/"GodKing", both to the Hand', async () => {
  assert.deepEqual(await ev(bomb(true)), [-1, 1, true, true, 1]);
});
test('S09 Thunder God Bombardment does nothing while not Sealed', async () => {
  assert.deepEqual(await ev(bomb(false)), [0, 0, false, false, 3]);
});
