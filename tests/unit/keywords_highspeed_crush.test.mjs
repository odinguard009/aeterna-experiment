// v0.49.0 keyword effects as engine data (session D, part 1): High Speed, Crush, Holy Life.
// High Speed (card text): "This card in Hand can be summoned by paying the cost with cores in the Reserve. In this case, cores to be put
// on this Spirit must also be from the Reserve." It is a Flash effect, so it is used in the Flash Timings of a battle.
// Crush: "Discard a number of cards equal to this Spirit's level from opposing decktop." Holy Life: "When this Spirit's attack reduces
// the opposing Life, put a core from the Void to your Life." (ALLY_LIFE_HIT self + VOID_TO_LIFE).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const STICH = 'BS69-024', GAUDY = 'BS68-024', FROPPER = 'BS68-059', GOLEM = 'BS68-061', KAMI = 'BS68-048', COATI = 'BS69-052', HOUND = 'BS68-014';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 0; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; q.trashCores.n = 0; q.trashCores.soul = false; q.life = 5; q.lifeSoul = false; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('K01 the High Speed cards carry highSpeed and BS69-024 no longer lists it as residual', async () => {
  const r = await ev(`return [BS.CARDS['${STICH}'].highSpeed, BS.CARDS['${GAUDY}'].highSpeed, (BS.CARDS['${STICH}'].residual || []).some(x => /High Speed/.test(x))];`);
  assert.deepEqual(r, [true, true, false]);
});
test('K02 High Speed needs cost + Lv1 cores in the Reserve; cores on Spirits do not count', async () => {
  const r = await ev(`const s = hd('${STICH}'); sp('${HOUND}', P, 6); const c = BS.effCost(P, BS.CARDS['${STICH}']); const a = BS.highSpeedOK(P, s);
    P.reserve.n = c; const b = BS.highSpeedOK(P, s); P.reserve.n = c + 1; const d = BS.highSpeedOK(P, s); return [c >= 1, a, b, d];`);
  assert.deepEqual(r, [true, false, false, true]);
});
test('K03 a High Speed summon pays and places only Reserve cores; field cores stay put', async () => {
  const r = await ev(`const s = hd('${STICH}'); const f = sp('${HOUND}', P, 4); const c = BS.effCost(P, BS.CARDS['${STICH}']); P.reserve.n = c + 1;
    const ok = await BS.highSpeedSummon(P, s); return [ok, P.spirits.includes(s), s.cores, f.cores, P.reserve.n, P.trashCores.n === c, P.hand.includes(s)];`);
  assert.deepEqual(r, [true, true, 1, 4, 0, true, false]);
});
test('K04 the Soul Core in the Reserve can pay for High Speed', async () => {
  const r = await ev(`const s = hd('${GAUDY}'); const c = BS.effCost(P, BS.CARDS['${GAUDY}']); P.reserve.n = c; P.reserve.soul = true;
    const ok = BS.highSpeedOK(P, s) && await BS.highSpeedSummon(P, s); return [ok, P.spirits.includes(s), s.cores + (s.soul ? 1 : 0), P.reserve.n, P.reserve.soul];`);
  assert.deepEqual(r, [true, true, 1, 0, false]);
});
test('K05 the CPU defender summons a High Speed Spirit before the block when it can win the block', async () => {
  const r = await ev(`G.active = O.key; const att = sp('${HOUND}', O, 1); att.exhausted = true; const s = hd('${STICH}'); P.reserve.n = 6;
    const ch = BS.cpuFlashChoice(P, O.key, att, null); return [!!ch && ch.hs === s];`);
  assert.deepEqual(r, [true]);
});
test('K06 no High Speed when it is not a Flash Timing source (empty Reserve)', async () => {
  const r = await ev(`G.active = O.key; const att = sp('${HOUND}', O, 1); hd('${STICH}'); sp('${HOUND}', P, 6); return [BS.highSpeedSources(P).length];`);
  assert.deepEqual(r, [0]);
});
test('K07 Crush discards opposing decktop cards equal to the Spirit level', async () => {
  const r = await ev(`const s = sp('${GOLEM}', P, 3); O.deck = [1,2,3,4].map(() => BS.mkInst('${HOUND}')); const lv = BS.lvIndex(s) + 1;
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); return [lv, O.deck.length, O.trash.length];`);
  assert.deepEqual(r, [2, 2, 2]);
});
test('K08 Crush with an empty opposing Deck does nothing and does not end the game', async () => {
  const r = await ev(`const s = sp('${FROPPER}', P, 1); O.deck = []; await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); return [O.trash.length, !!G.over];`);
  assert.deepEqual(r, [0, false]);
});
test('K09 Holy Life: a Life hit by this attacker puts a Void core on your Life; another attacker does not', async () => {
  const r = await ev(`const k = sp('${KAMI}', P, 1), h = sp('${HOUND}', P, 1); P.void = 3; const l0 = P.life;
    await BS.fireFxMulti([{ owner: P, trigger: 'ALLY_LIFE_HIT', src: null, ctx: { attacker: h } }]); const a = P.life - l0;
    await BS.fireFxMulti([{ owner: P, trigger: 'ALLY_LIFE_HIT', src: null, ctx: { attacker: k } }]); return [a, P.life - l0];`);
  assert.deepEqual(r, [0, 1]);
});
test('K10 Holy Life on [LV1][LV2][LV3] of Coati Chisel works at LV1', async () => {
  const r = await ev(`const k = sp('${COATI}', P, 1); P.void = 3; const l0 = P.life;
    await BS.fireFxMulti([{ owner: P, trigger: 'ALLY_LIFE_HIT', src: null, ctx: { attacker: k } }]); return [P.life - l0];`);
  assert.deepEqual(r, [1]);
});
