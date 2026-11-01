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

test('K-940 BS01-112 returns an opposing Nexus at LV1+ and an opposing Spirit at LV2 on the Start Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS01-112'); n.cores = 1; P.nexus = [n];
    const on = BS.mkInst('BS01-112'); on.cores = 0; O.nexus = [on]; const sp = BS.mkInst('BS01-001'); sp.cores = 1; O.spirits = [sp]; O.hand = [];
    await BS.fireFx(P, 'START_STEP', null, {}); const lv1 = [O.nexus.length, O.spirits.length, O.hand.length];
    O.nexus = [BS.mkInst('BS01-112')]; n.cores = 4; O.hand = [];
    await BS.fireFx(P, 'START_STEP', null, {}); const lv2 = [O.nexus.length, O.spirits.length, O.hand.length];
    return [lv1, lv2]; })()`);
  assert.deepEqual(r, [[0, 1, 1], [0, 0, 2]], JSON.stringify(r));
});

test('K-941 BS04-018 returns an opposing Spirit at the opponent\'s Start Step only with enough cards in hand (10 / 8 / 6 by level)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('BS04-018'); P.spirits = [s]; const out = [];
    for (const [cores, hand] of [[1, 9], [1, 10], [3, 7], [3, 8], [4, 5], [4, 6]]) {
      s.cores = cores; P.hand = Array.from({ length: hand }, () => BS.mkInst('BS01-001')); O.spirits = [BS.mkInst('BS01-001')]; O.hand = [];
      await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(O.spirits.length);
    }
    return out; })()`);
  assert.deepEqual(r, [1, 0, 1, 0, 1, 0], JSON.stringify(r));
});

test('K-942 BS09-072 destroys exhausted opposing Spirits without Tribute only while both Red and Purple Spirits are controlled', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const purple = Object.keys(BS.CARDS).find(k => /^BS0/.test(k) && BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).includes('purple'));
    const act = BS.CARDS['BS09-072'].magic.actions[0];
    const mk = () => { const a = BS.mkInst('BS01-001'), t = BS.mkInst('BS07-035'), c = BS.mkInst('BS01-001'); a.exhausted = true; t.exhausted = true; c.exhausted = false; a.cores = t.cores = c.cores = 2; O.spirits = [a, t, c]; };
    const out = [];
    O.reserve.n = 5; P.reserve.n = 5;
    P.spirits = [BS.mkInst('BS01-001')]; mk(); out.push(0);
    await BS.FX_ACTIONS.DESTROY.run({ p: P, opp: O, src: BS.mkInst('BS09-072'), ctx: {} }, act); out.push(O.spirits.length);
    out.push(BS.fxIf ? !!BS.fxIf(P, O, act.if, {}) : null);
    P.spirits = [BS.mkInst('BS01-001'), BS.mkInst(purple)]; mk();
    out.push(BS.fxIf ? !!BS.fxIf(P, O, act.if, {}) : null);
    await BS.FX_ACTIONS.DESTROY.run({ p: P, opp: O, src: BS.mkInst('BS09-072'), ctx: {} }, act); out.push(O.spirits.length, O.spirits.map(s => s.id + (s.exhausted ? 'x' : '')).join());
    return out; })()`);
  assert.deepEqual(r.slice(1, 5), [2, false, true, 2], JSON.stringify(r));
  assert.equal(r[5], 'BS07-035x,BS01-001', JSON.stringify(r));
});

test('K-943 BS17-073 destroys one opposing 4000 BP or less Spirit and marks it so its When Destroyed effects stay silent', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    O.reserve.n = 5; const big = Object.keys(BS.CARDS).find(k => /^BS0/.test(k) && BS.CARDS[k].type === 'Spirit' && !(BS.CARDS[k].effects || []).some(e => e.trigger === 'STATIC') && (BS.CARDS[k].levels[0].bp || 0) >= 7000);
    const lo = BS.mkInst('BS01-001'), hi = BS.mkInst(big); lo.cores = 1; hi.cores = 2; O.spirits = [lo, hi];
    const bps = [BS.bpOf(lo), BS.bpOf(hi)];
    await BS.FX_ACTIONS.DESTROY.run({ p: P, opp: O, src: BS.mkInst('BS17-073'), ctx: {} }, BS.CARDS['BS17-073'].magic.actions[0]);
    return [bps[0] <= 4000, bps[1] > 4000, O.spirits.length, O.spirits[0] === hi, BS.CARDS['BS17-073'].magic.actions[0].noFx === true]; })()`);
  assert.deepEqual(r, [true, true, 1, true, true], JSON.stringify(r));
});

test('K-944 BS02-106 refreshes every exhausted Cost 2 Spirit of both players and leaves other costs exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const c2 = Object.keys(BS.CARDS).find(k => /^BS0/.test(k) && BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost === 2), c4 = Object.keys(BS.CARDS).find(k => /^BS0/.test(k) && BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost === 4);
    const mk = id => { const s = BS.mkInst(id); s.cores = 2; s.exhausted = true; return s; };
    P.spirits = [mk(c2), mk(c4)]; O.spirits = [mk(c2), mk(c4)];
    await BS.FX_ACTIONS.REFRESH_SPIRIT.run({ p: P, opp: O, src: BS.mkInst('BS02-106'), ctx: {} }, BS.CARDS['BS02-106'].magic.actions[0]);
    return [P.spirits.map(s => s.exhausted), O.spirits.map(s => s.exhausted)]; })()`);
  assert.deepEqual(r, [[false, true], [false, true]]);
});

test('K-945 BS10-104 offers exhaust one opposing Spirit or exhaust three opposing Cost 4 or less Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => BS.CARDS['BS10-104'].magic.actions[0].options.map(o => o.map(x => [x.do, x.n, x.costLe || null])))()`);
  assert.deepEqual(r, [[['EXHAUST_OPP', 1, null]], [['EXHAUST_OPP', 3, 4]]]);
});

test('K-946 BS19-097 and BS06-093 give the attacker +1000 and keyword-gated extra BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.reserve.n = 5;
    const hk = (k, w) => [].concat(BS.CARDS[k].keywords || [], BS.CARDS[k].mechanics || []).some(x => String(x).toUpperCase() === w.toUpperCase()) || (BS.CARDS[k].desc || BS.CARDS[k].text || '').includes(w + ' (');
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit');
    const ch = ids.find(k => hk(k, 'Charge')), rg = ids.find(k => hk(k, 'Rage')), pl = ids.find(k => !hk(k, 'Charge') && !hk(k, 'Rage'));
    const out = [];
    for (const [card, id] of [['BS19-097', ch], ['BS19-097', pl], ['BS06-093', rg], ['BS06-093', pl]]) {
      const s = BS.mkInst(id); s.cores = 2; P.spirits = [s]; G.attacker = s; s.bpMod = 0;
      for (const a of BS.CARDS[card].magic.actions) await BS.FX_ACTIONS.BP_PLUS.run({ p: P, opp: O, src: BS.mkInst(card), ctx: {} }, a);
      out.push(s.bpMod);
    }
    return out; })()`);
  assert.deepEqual(r, [4000, 1000, 3000, 1000]);
});

test('K-947 BS12-074 reveals three, adds every matching family Spirit/Brave and trashes the rest', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.reserve.n = 5;
    const fam = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && [].concat(BS.CARDS[k].families || BS.CARDS[k].family || []).includes('Galaxian')), oth = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !String(JSON.stringify(BS.CARDS[k].families || BS.CARDS[k].family || '')).match(/Galaxian|Astral/));
    P.hand = []; P.trash = []; P.deck = [BS.mkInst(fam), BS.mkInst(oth), BS.mkInst(fam), BS.mkInst(oth)];
    const m = BS.CARDS['BS12-074'].magic.by.MAIN.actions[0];
    await BS.FX_ACTIONS.REVEAL_PICK.run({ p: P, opp: O, src: BS.mkInst('BS12-074'), ctx: {} }, m);
    return [P.hand.length, P.trash.length, P.deck.length, !!fam]; })()`);
  assert.deepEqual(r, [2, 1, 1, true]);
});

test('K-948 BS26-079 stops Life loss from attacking Brave Spirits only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { const out = [];
    for (const braved of [true, false]) {
      BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.coreShield = O.coreShield = null;
      for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; }
      const a = BS.mkInst('26RBS01-001'); a.cores = 2; a.exhausted = false; if (braved) a.brave = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave')); O.spirits.push(a);
      await BS.FX_ACTIONS.LIFE_CORE_SHIELD.run({ p: P, opp: O, src: BS.mkInst('BS26-079'), ctx: {} }, BS.CARDS['BS26-079'].magic.actions[0]);
      G.active = O.key; G.step = 5; const l = P.life; await BS.doBattle(O.key, a); out.push(l - P.life);
    } return out; })()`);
  assert.deepEqual(r, [0, 1]);
});
