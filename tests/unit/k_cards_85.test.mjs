// Lane K tests, file 85 (v0.208 cycle).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-932 BS03-133 sends two Reserve cores to Life, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const card = BS.CARDS['BS03-133'];
    const before = [P.life, P.reserve.n];
    await BS.FX_ACTIONS.RESERVE_TO_LIFE.run({ p: P, opp: O, src: BS.mkInst('BS03-133'), ctx: {} }, card.magic.actions[0]);
    const moved = [P.life - before[0], before[1] - P.reserve.n];
    const inst = BS.mkInst('BS03-133'); P.reserve.n = 6;
    const u1 = BS.magicUsable(P, inst, 'flash', true);
    P.onceUsed = P.onceUsed || {}; P.onceUsed['magic:' + card.name] = G.turnNo;
    const u2 = BS.magicUsable(P, inst, 'flash', true);
    G.turnNo++;
    const u3 = BS.magicUsable(P, inst, 'flash', true);
    return [card.magic.once, moved, !!u1, !!u2, !!u3]; })()`);
  assert.deepEqual(r, [true, [2, 2], true, false, true]);
});

test('K-933 BS01-135 draws 1 and gives all your Spirits +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-001'), b = BS.mkInst('BS01-001'), o = BS.mkInst('BS01-001'); a.bpMod = b.bpMod = o.bpMod = 0;
    P.spirits = [a, b]; O.spirits = [o]; const h = P.hand.length, d = P.deck.length;
    const m = BS.CARDS['BS01-135'].magic;
    for (const act of m.actions) await BS.FX_ACTIONS[act.do].run({ p: P, opp: O, src: BS.mkInst('BS01-135'), ctx: {} }, act);
    return [P.hand.length - h, d - P.deck.length, a.bpMod, b.bpMod, o.bpMod || 0, m.timing]; })()`);
  assert.deepEqual(r, [1, 1, 1000, 1000, 0, ['MAIN', 'FLASH']]);
});

test('K-934 BS31-109 refreshes only a yellow Spirit, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const red = BS.mkInst('BS01-001'), yel = BS.mkInst('BS02-049'); red.exhausted = yel.exhausted = true; P.spirits = [red, yel];
    const act = BS.CARDS['BS31-109'].magic.actions[0];
    const cands = BS.FX_ACTIONS.REFRESH_SPIRIT.cands({ p: P, opp: O, src: BS.mkInst('BS31-109'), ctx: {} }, act);
    return [BS.CARDS['BS31-109'].magic.once, cands.length, cands[0] === yel]; })()`);
  assert.deepEqual(r, [true, 1, true]);
});

test('K-935 BS44-091 returns every opposing Spirit with 7000 BP or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const small = BS.mkInst('BS01-001'); small.cores = 1; const big = BS.mkInst('BS01-001'); big.cores = 1; big.bpMod = 20000;
    O.spirits = [small, big]; const h = O.hand.length;
    const act = BS.CARDS['BS44-091'].magic.actions[0];
    await BS.FX_ACTIONS.BOUNCE_OPP.run({ p: P, opp: O, src: BS.mkInst('BS44-091'), ctx: {} }, act);
    return [O.spirits.length, O.spirits[0] === big, O.hand.length - h]; })()`);
  assert.deepEqual(r, [1, true, 1]);
});

test('K-936 BS03-087 mills one opposing card per core it held when destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('BS03-087'); s.lostCores = 3; const d = O.deck.length, t = O.trash.length;
    await BS.FX_ACTIONS.MILL_OPP.run({ p: P, opp: O, src: s, ctx: {} }, BS.CARDS['BS03-087'].effects[0].actions[0]);
    return [d - O.deck.length, O.trash.length - t, BS.CARDS['BS03-087'].effects[0].trigger]; })()`);
  assert.deepEqual(r, [3, 3, 'DESTROYED']);
});

test('K-937 BS01-087 each player moves 1 core from a Spirit to the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-001'), o = BS.mkInst('BS01-001'); a.cores = 2; o.cores = 3; P.spirits = [a]; O.spirits = [o];
    await BS.FX_ACTIONS.BOTH_CORES_TO_TRASH.run({ p: P, opp: O, src: BS.mkInst('BS01-087'), ctx: {} }, BS.CARDS['BS01-087'].effects[0].actions[0]);
    return [a.cores, o.cores, BS.CARDS['BS01-087'].effects[0].lv]; })()`);
  assert.deepEqual(r, [1, 2, [1, 2]]);
});

test('K-938 BS03-143 / BS06-102 / BS10-113 / BS04-097 grant turn-long effects to the matching Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.turnNo = 11;
    const find = f => Object.keys(BS.CARDS).find(k => /^BS0/.test(k) && BS.CARDS[k].type === 'Spirit' && f(BS.CARDS[k]));
    const crush = BS.mkInst('BS14-062'), plain = BS.mkInst('BS01-001');
    const fs = BS.mkInst(find(k => (k.families || []).includes('Fighting Spirit'))), wb = BS.mkInst(find(k => (k.families || []).includes('Winged Beast')));
    P.spirits = [crush, plain, fs, wb];
    const run = async id => BS.FX_ACTIONS.GRANT_FX.run({ p: P, opp: O, src: BS.mkInst(id), ctx: {} }, BS.CARDS[id].magic.actions[0]);
    await run('BS03-143'); const a = P.spirits.map(s => (s.grantFx || []).length);
    P.spirits.forEach(s => { s.grantFx = []; });
    await run('BS06-102'); const b = P.spirits.map(s => (s.grantFx || []).length);
    P.spirits.forEach(s => { s.grantFx = []; });
    await run('BS10-113'); const c = P.spirits.map(s => (s.grantFx || []).length);
    P.spirits.forEach(s => { s.grantFx = []; });
    await run('BS04-097'); const d = P.spirits.map(s => (s.grantFx || []).length);
    return [a, b, c, d]; })()`);
  assert.deepEqual(r, [[1, 0, 0, 0], [1, 1, 1, 1], [0, 0, 1, 0], [0, 0, 0, 1]], JSON.stringify(r));
});

test('K-939 BS12-077 Main grants a turn-long attack effect to Parasite / Shell Insect / Shellman Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.turnNo = 11;
    const find = f => Object.keys(BS.CARDS).find(k => /^BS0/.test(k) && BS.CARDS[k].type === 'Spirit' && f(BS.CARDS[k]));
    const ins = BS.mkInst(find(k => (k.families || []).some(x => ['Parasite', 'Shell Insect', 'Shellman'].includes(x)))), plain = BS.mkInst('BS01-001');
    P.spirits = [ins, plain];
    const m = BS.CARDS['BS12-077'].magic;
    await BS.FX_ACTIONS.GRANT_FX.run({ p: P, opp: O, src: BS.mkInst('BS12-077'), ctx: {} }, m.by.MAIN.actions[0]);
    return [P.spirits.map(s => (s.grantFx || []).length), m.timing]; })()`);
  assert.deepEqual(r, [[1, 0], ['MAIN', 'FLASH']], JSON.stringify(r));
});
