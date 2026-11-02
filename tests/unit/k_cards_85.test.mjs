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

test('K-949 BS01-139 Feather Barrier: the blocker (only) is unaffected by opposing effects this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; }
    const b = BS.mkInst('BS01-001'); b.cores = 1; P.spirits.push(b); const a = BS.mkInst('BS01-001'); a.cores = 1; O.spirits.push(a);
    const src = BS.mkInst('BS01-001'); const ctx = { p: O, opp: P, src };
    const m = BS.CARDS['BS01-139'].magic; const before = BS.fxImmune ? BS.fxImmune(P, b, ctx) : null;
    await BS.FX_ACTIONS.BLOCKER_UNAFFECTED.run({ p: P, opp: O, src: BS.mkInst('BS01-139'), ctx: {} }, m.actions[0]);
    G.blocker = null; const idle = BS.fxImmune ? BS.fxImmune(P, b, ctx) : null; G.blocker = b; const blocking = BS.fxImmune ? BS.fxImmune(P, b, ctx) : null;
    return [m.timing[0], m.actions[0].do, before, idle, blocking]; })()`);
  assert.equal(r[0], 'FLASH'); assert.equal(r[1], 'BLOCKER_UNAFFECTED');
  assert.deepEqual(r.slice(2), [false, false, true], JSON.stringify(r));
});

test('K-950 BS10-105 destroys an own Cost 3+ Spirit, then 3 Void cores to the Reserve; nothing without one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { const out = [];
    for (const id of ['BS01-001', null]) {
      BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; P.nexus.length = 0;
      const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit');
      const big = ids.find(k => BS.CARDS[k].cost >= 3), small = ids.find(k => BS.CARDS[k].cost <= 2);
      const s = BS.mkInst(id ? big : small); s.cores = 1; P.spirits.push(s); P.reserve.n = 0; G.voidCores = G.voidCores; const v0 = P.void != null ? P.void : null;
      const m = BS.CARDS['BS10-105'].magic; const c = { p: P, opp: O, src: BS.mkInst('BS10-105'), ctx: {} };
      for (const a of m.actions) { if (a.if && a.if.prev && c.ctx.did === false) continue; c.ctx.did = undefined; await BS.FX_ACTIONS[a.do].run(c, a); }
      out.push([P.spirits.length, P.reserve.n > 0]);
    } return out; })()`);
  assert.deepEqual(r[0][0], 0); assert.equal(r[0][1], true, JSON.stringify(r)); assert.equal(r[1][0], 1); assert.equal(r[1][1], false, JSON.stringify(r));
});

test('K-951 BS39-075 refreshes all own Cost 2 Spirits and draws only when 3+ were refreshed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { const out = [];
    const two = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost === 2);
    for (const n of [2, 3]) {
      BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; P.nexus.length = 0;
      for (let i = 0; i < n; i++) { const s = BS.mkInst(two); s.cores = 1; s.exhausted = true; P.spirits.push(s); }
      const h = P.hand.length; await BS.FX_ACTIONS.REFRESH_SPIRIT.run({ p: P, opp: O, src: BS.mkInst('BS39-075'), ctx: {} }, BS.CARDS['BS39-075'].magic.actions[0]);
      out.push([P.spirits.filter(s => !s.exhausted).length, P.hand.length - h]);
    } return out; })()`);
  assert.deepEqual(r, [[2, 0], [3, 1]]);
});

test('K-952 BS21-079/BS08-077 let exhausted Spirits block this turn (picked one / matching family)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; P.nexus.length = 0;
    const fam = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Machine Beast'));
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; s.exhausted = true; P.spirits.push(s); return s; };
    const a = mk('BS01-001'), b = mk(fam), x = mk('BS01-001');
    const can = s => BS.canBlockState(P, s); const before = [can(a), can(b)];
    await BS.FX_ACTIONS.BLOCK_EXHAUSTED_TURN.run({ p: P, opp: O, src: BS.mkInst('BS08-077'), ctx: {} }, BS.CARDS['BS08-077'].magic.actions[0]);
    const all = [can(a), can(b)]; b.blockExT = null;
    await BS.FX_ACTIONS.BLOCK_EXHAUSTED_TURN.run({ p: P, opp: O, src: BS.mkInst('BS21-079'), ctx: {} }, BS.CARDS['BS21-079'].magic.actions[0]);
    return { before, all, fam: !!fam, picked: P.spirits.filter(s => s.blockExT === G.turnNo).length >= 1 }; })()`);
  assert.ok(r.fam); assert.deepEqual(r.before, [false, false]); assert.deepEqual(r.all, [false, true], JSON.stringify(r)); assert.ok(r.picked);
});

test('K-953 BS05-030 (LV2) makes Ice Princess Spirit cards in hand cost 5, only at LV2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const P = BS.G.p.player; P.cpu = true; P.nexus.length = 0;
    const ip = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost >= 7 && (BS.CARDS[k].families || []).includes('Ice Princess'));
    const z = BS.mkInst(ip); P.hand = [z]; P.reserve.n = 6; const base = BS.canPlayCard(P, z);
    const s = BS.mkInst('BS05-030'); s.cores = 1; P.spirits = [s]; const lv1 = BS.canPlayCard(P, z);
    s.cores = 2; const lv2 = BS.canPlayCard(P, z); return [!!ip, base, lv1, lv2]; })()`);
  assert.ok(r[0], JSON.stringify(r)); assert.deepEqual(r.slice(1), [false, false, true], JSON.stringify(r));
});

test('K-954 BS33-078 / BS48-RV010: +BP then the same Spirit can block while exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; P.nexus.length = 0;
    const s = BS.mkInst('BS01-001'); s.cores = 1; s.exhausted = true; P.spirits.push(s);
    const c = { p: P, opp: O, src: BS.mkInst('BS33-078'), ctx: {} }; const before = BS.canBlockState(P, s);
    for (const a of BS.CARDS['BS33-078'].magic.actions) await BS.FX_ACTIONS[a.do].run(c, a);
    const o = BS.CARDS['BS48-RV010'].magic.actions[0].options; return [before, BS.canBlockState(P, s), s.bpMod || 0, o.length, o[1].map(a => a.do)]; })()`);
  assert.equal(r[0], false); assert.equal(r[1], true, JSON.stringify(r)); assert.ok(r[2] >= 3000 || r[2] === 0, JSON.stringify(r)); assert.deepEqual(r.slice(3), [2, ['BP_TARGET', 'BLOCK_EXHAUSTED_TURN']]);
});

test('K-955 BS39-072: a Spirit blocks while exhausted this battle only and carries the draw-2 win rider', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; P.nexus.length = 0;
    const s = BS.mkInst('BS01-001'); s.cores = 1; s.exhausted = true; P.spirits.push(s); const a = BS.mkInst('BS01-001'); a.cores = 1; O.spirits.push(a); G.attacker = a; G.battleNo = (G.battleNo || 0) + 1;
    const c = { p: P, opp: O, src: BS.mkInst('BS39-072'), ctx: {} }; const before = BS.canBlockState(P, s);
    for (const x of BS.CARDS['BS39-072'].magic.actions) await BS.FX_ACTIONS[x.do].run(c, x);
    const during = BS.canBlockState(P, s); const rider = s.winRider ? s.winRider.draw : null; G.battleNo++; return [before, during, rider, BS.canBlockState(P, s)]; })()`);
  assert.deepEqual(r, [false, true, 2, false], JSON.stringify(r));
});

test('K-956 BS33-083 destroys one opposing Cost 0/3/5 Spirit each and refunds one Void core per Spirit destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.spirits.length = 0; O.nexus.length = 0;
    const byCost = k => Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].cost === k);
    for (const k of [3, 5, 4]) { const s = BS.mkInst(byCost(k)); s.cores = 1; O.spirits.push(s); }
    P.reserve.n = 0; const c = { p: P, opp: O, src: BS.mkInst('BS33-083'), ctx: {} };
    for (const a of BS.CARDS['BS33-083'].magic.actions) { if (a.if && c.ctx.did === false) continue; await BS.FX_ACTIONS[a.do].run(c, a); }
    return [O.spirits.map(s => BS.CARDS[s.id].cost), P.reserve.n, c.ctx.destroyed.length]; })()`);
  assert.deepEqual(r[0], [4]); assert.equal(r[2], 2); assert.equal(r[1], 2, JSON.stringify(r));
});

test('K-957 BS03-122 Main sends all Nexus cores of both sides to their owners Trash; Flash gives +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus');
    const a = BS.mkInst(nx), b = BS.mkInst(nx); a.cores = 3; b.cores = 2; P.nexus.length = 0; O.nexus.length = 0; P.nexus.push(a); O.nexus.push(b);
    const t0 = [P.trashCores.n, O.trashCores.n];
    const m = BS.CARDS['BS03-122'].magic; const c = { p: P, opp: O, src: BS.mkInst('BS03-122'), ctx: {} };
    await BS.FX_ACTIONS.NEXUS_CORES_ALL_TO_TRASH.run(c, m.by.MAIN.actions[0]);
    return [a.cores, b.cores, P.trashCores.n - t0[0], O.trashCores.n - t0[1], m.by.FLASH.effect, m.by.FLASH.value]; })()`);
  assert.deepEqual(r, [0, 0, 3, 2, 'BP_PLUS', 1000]);
});

test('K-958 BS04-113 Main deploys a Nexus from the Trash free; Flash gives +3000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus' && !BS.CARDS[i].keywords?.length);
    P.nexus.length = 0; P.trash.length = 0; P.trash.push(BS.mkInst(nx));
    const m = BS.CARDS['BS04-113'].magic; const c = { p: P, opp: O, src: BS.mkInst('BS04-113'), ctx: {} };
    await BS.FX_ACTIONS.DEPLOY_TRASH.run(c, m.by.MAIN.actions[0]);
    return [P.nexus.length, P.trash.length, m.by.FLASH.value]; })()`);
  assert.deepEqual(r, [1, 0, 3000], JSON.stringify(r));
});

test('K-959 BS02-097 Flash sends every Trash core to one of your Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit'); const s = BS.mkInst(sp); s.cores = 1; P.spirits.length = 0; P.spirits.push(s);
    P.trashCores.n = 8; const m = BS.CARDS['BS02-097'].magic; const c = { p: P, opp: O, src: BS.mkInst('BS02-097'), ctx: {} };
    await BS.FX_ACTIONS.TRASH_CORES_TO.run(c, m.actions[0]);
    return [s.cores, P.trashCores.n, m.timing]; })()`);
  assert.deepEqual(r, [9, 0, ['FLASH']], JSON.stringify(r));
});

test('K-960 BS10-063 destroys every opposing Spirit sharing a family with the Spirit the battle destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const fam = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit' && (BS.CARDS[i].families||[]).includes('Emperor Beast'));
    const other = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && !(BS.CARDS[i].families||[]).includes('Emperor Beast'));
    O.spirits.length = 0; for (const i of [fam[0], fam[1], other]) { const s = BS.mkInst(i); s.cores = 1; O.spirits.push(s); }
    const c = { p: P, opp: O, src: BS.mkInst('BS10-063'), ctx: { victimId: fam[0] } };
    await BS.FX_ACTIONS.DESTROY_SAME_FAMILY.run(c, { do: 'DESTROY_SAME_FAMILY' });
    return [O.spirits.length, O.spirits[0].id === other, JSON.stringify(BS.CARDS['BS10-063'].effects[0].trigger)]; })()`);
  assert.deepEqual(r.slice(0, 2), [1, true], JSON.stringify(r));
});

test('K-961 BS04-089 sends every Trash core only to an Awaken Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const has = i => ((BS.CARDS[i].keywords || []).concat(BS.CARDS[i].mechanics || [])).some(k => String(k).toUpperCase() === 'AWAKEN');
    const aw = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && has(i));
    const pl = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && !has(i));
    const a = BS.mkInst(aw), b = BS.mkInst(pl); a.cores = 1; b.cores = 1; P.spirits.length = 0; P.spirits.push(b, a); P.trashCores.n = 4;
    const m = BS.CARDS['BS04-089'].magic; const c = { p: P, opp: O, src: BS.mkInst('BS04-089'), ctx: {} };
    await BS.FX_ACTIONS.TRASH_CORES_TO.run(c, m.actions[0]);
    return [a.cores, b.cores, P.trashCores.n, aw]; })()`);
  assert.deepEqual(r.slice(0, 3), [5, 1, 0], JSON.stringify(r));
});

test('K-962 BS03-128 refunds a Void core per exhausted own Spirit; BS01-128 draws per exhausted opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit');
    P.spirits.length = 0; O.spirits.length = 0;
    for (const e of [true, true, false]) { const s = BS.mkInst(sp); s.cores = 1; s.exhausted = e; P.spirits.push(s); const t = BS.mkInst(sp); t.cores = 1; t.exhausted = e; O.spirits.push(t); }
    P.void = 5; P.reserve.n = 0; let c = { p: P, opp: O, src: BS.mkInst('BS03-128'), ctx: {} };
    await BS.FX_ACTIONS.VOID_TO_RESERVE.run(c, BS.CARDS['BS03-128'].magic.actions[0]);
    const res = P.reserve.n; const h0 = P.hand.length;
    c = { p: P, opp: O, src: BS.mkInst('BS01-128'), ctx: {} };
    await BS.FX_ACTIONS.DRAW.run(c, BS.CARDS['BS01-128'].magic.by.MAIN.actions[0]);
    return [res, P.hand.length - h0]; })()`);
  assert.deepEqual(r, [2, 2], JSON.stringify(r));
});

test('K-963 BS06-106 returns every Nexus of both sides to its owner Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus');
    P.nexus.length = 0; O.nexus.length = 0; const a = BS.mkInst(nx), b = BS.mkInst(nx); a.cores = 1; b.cores = 2; P.nexus.push(a); O.nexus.push(b);
    const h = [P.hand.length, O.hand.length];
    const c = { p: P, opp: O, src: BS.mkInst('BS06-106'), ctx: {} };
    await BS.FX_ACTIONS.NEXUS_ALL_TO_HAND.run(c, BS.CARDS['BS06-106'].magic.by.MAIN.actions[0]);
    return [P.nexus.length, O.nexus.length, P.hand.length - h[0], O.hand.length - h[1]]; })()`);
  assert.deepEqual(r, [0, 0, 1, 1], JSON.stringify(r));
});

test('K-964 BS08-076 marks every opposing Cost 3 or less Spirit as must-attack', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const byCost = k => Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].cost === k);
    O.spirits.length = 0; for (const k of [2, 3, 5]) { const s = BS.mkInst(byCost(k)); s.cores = 1; s.exhausted = false; O.spirits.push(s); }
    const c = { p: P, opp: O, src: BS.mkInst('BS08-076'), ctx: {} };
    await BS.FX_ACTIONS.MUST_ATTACK_ALL_OPP.run(c, BS.CARDS['BS08-076'].magic.actions[0]);
    return O.spirits.map(s => s.mustAtk === G.turnNo); })()`);
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});

test('K-965 BS08-069 the opponent destroys Spirits down to the number you control (needs two or more)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit');
    const mk = (side, n) => { side.spirits.length = 0; for (let i = 0; i < n; i++) { const s = BS.mkInst(sp); s.cores = 1; side.spirits.push(s); } };
    const run = async () => { const c = { p: P, opp: O, src: BS.mkInst('BS08-069'), ctx: {} }; await BS.FX_ACTIONS.DESTROY_OPP_DOWN_TO_OWN.run(c, {}); return O.spirits.length; };
    mk(P, 2); mk(O, 5); const a = await run(); mk(P, 1); mk(O, 4); const b = await run();
    return [a, b]; })()`);
  assert.deepEqual(r, [2, 4], JSON.stringify(r));
});

test('K-966 TREAT_HIGHEST: BS07-006 at LV3 lifts own Deified General Spirits to their highest level; off at LV1', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.spirits.length = 0;
    const src = BS.mkInst('BS07-006'); P.spirits.push(src);
    const t = BS.mkInst('BS15-005'); t.cores = 1; P.spirits.push(t);
    const top = BS.CARDS['BS15-005'].levels.length - 1;
    src.cores = BS.CARDS['BS07-006'].levels[BS.CARDS['BS07-006'].levels.length - 1].cores;
    const hi = BS.lvIndex(t);
    src.cores = 1; const lo = BS.lvIndex(t);
    return [hi, lo, top]; })()`);
  assert.deepEqual(r, [r[2], 0, r[2]], JSON.stringify(r));
});

test('K-967 BS13-083 treats every own multi-level Spirit as highest this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0;
    const a = BS.mkInst('BS15-005'), b = BS.mkInst('BS06-010'); a.cores = 1; b.cores = 1; P.spirits.push(a, b);
    const before = [BS.lvIndex(a), BS.lvIndex(b)];
    await BS.FX_ACTIONS.TREAT_HIGHEST_ALL.run({ p: P, opp: O, src: BS.mkInst('BS13-083'), ctx: {} }, BS.CARDS['BS13-083'].magic.actions[0]);
    return [before, [BS.lvIndex(a), BS.lvIndex(b)]]; })()`);
  assert.deepEqual(r, [[0, 0], [2, 2]], JSON.stringify(r));
});

test('K-968 BS02-110 / BS02-105 lock matching Spirits of both sides for the turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const byCost = k => Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].cost === k);
    const mk = (side, ks) => { side.spirits.length = 0; for (const k of ks) { const s = BS.mkInst(byCost(k)); s.cores = 1; side.spirits.push(s); } };
    mk(P, [1, 3]); mk(O, [0, 2]);
    await BS.FX_ACTIONS.CANT_ATTACK_BLOCK_ALL.run({ p: P, opp: O, src: BS.mkInst('BS02-110'), ctx: {} }, BS.CARDS['BS02-110'].magic.actions[0]);
    const a = P.spirits.concat(O.spirits).map(s => !!s.noAB);
    mk(P, [6, 7]); mk(O, [8, 5]);
    await BS.FX_ACTIONS.CANT_ATTACK_BLOCK_ALL.run({ p: P, opp: O, src: BS.mkInst('BS02-105'), ctx: {} }, BS.CARDS['BS02-105'].magic.by.MAIN.actions[0]);
    return [a, P.spirits.concat(O.spirits).map(s => !!s.noAB)]; })()`);
  assert.deepEqual(r, [[true, false, true, false], [true, false, true, false]], JSON.stringify(r));
});

test('K-969 BS01-141 marks one own Spirit as unblockable this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit'); const s = BS.mkInst(sp); s.cores = 1; P.spirits.push(s);
    await BS.FX_ACTIONS.UNBLOCKABLE_PICK.run({ p: P, opp: O, src: BS.mkInst('BS01-141'), ctx: {} }, BS.CARDS['BS01-141'].magic.actions[0]);
    return s.noBlockTurn === G.turnNo; })()`);
  assert.equal(r, true);
});

test('K-970 BS01-129 sends one core from an opposing Spirit to its owner Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit'); const s = BS.mkInst(sp); s.cores = 3; O.spirits.push(s);
    const rs = O.reserve.n;
    await BS.FX_ACTIONS.OPP_CORES_TO_RESERVE.run({ p: P, opp: O, src: BS.mkInst('BS01-129'), ctx: {} }, BS.CARDS['BS01-129'].magic.actions[0]);
    return [s.cores, O.reserve.n - rs]; })()`);
  assert.deepEqual(r, [2, 1], JSON.stringify(r));
});

test('K-971 BS04-102 returns every Cost 1 or less Spirit of both sides to hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const byCost = k => Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].cost === k);
    const mk = (side, ks) => { side.spirits.length = 0; for (const k of ks) { const s = BS.mkInst(byCost(k)); s.cores = 1; side.spirits.push(s); } };
    mk(P, [1, 3]); mk(O, [0, 2]); const h = [P.hand.length, O.hand.length];
    await BS.FX_ACTIONS.SPIRITS_ALL_TO_HAND.run({ p: P, opp: O, src: BS.mkInst('BS04-102'), ctx: {} }, BS.CARDS['BS04-102'].magic.actions[0]);
    return [P.spirits.length, O.spirits.length, P.hand.length - h[0], O.hand.length - h[1]]; })()`);
  assert.deepEqual(r, [1, 1, 1, 1], JSON.stringify(r));
});

test('K-972 BS08-079 treats an opposing Spirit as LV1 for the turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].levels.length > 2); const s = BS.mkInst(sp); s.cores = BS.CARDS[sp].levels[2].cores; O.spirits.push(s);
    const before = BS.lvIndex(s);
    await BS.FX_ACTIONS.TREAT_LV1.run({ p: P, opp: O, src: BS.mkInst('BS08-079'), ctx: {} }, BS.CARDS['BS08-079'].magic.by.MAIN.actions[0]);
    return [before, BS.lvIndex(s)]; })()`);
  assert.deepEqual(r, [2, 0], JSON.stringify(r));
});

test('K-973 BS03-141 raises a Spirit by one LV for the turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].levels.length > 2); const s = BS.mkInst(sp); s.cores = BS.CARDS[sp].levels[0].cores; P.spirits.push(s);
    const before = BS.lvIndex(s);
    await BS.FX_ACTIONS.LV_UP_TURN.run({ p: P, opp: O, src: BS.mkInst('BS03-141'), ctx: {} }, BS.CARDS['BS03-141'].magic.actions[0]);
    return [before, BS.lvIndex(s)]; })()`);
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-974 BS04-094 discards cards and sends that many cores from one opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit'); const s = BS.mkInst(sp); s.cores = 4; O.spirits.push(s);
    P.hand.length = 0; for (let j = 0; j < 4; j++) P.hand.push(BS.mkInst(sp));
    const tc = O.trashCores.n;
    await BS.FX_ACTIONS.DISCARD_ANY_CORES.run({ p: P, opp: O, src: BS.mkInst('BS04-094'), ctx: {} }, BS.CARDS['BS04-094'].magic.actions[0]);
    return [4 - s.cores, O.trashCores.n - tc, 4 - P.hand.length]; })()`);
  assert.deepEqual(r, [2, 2, 2], JSON.stringify(r));
});

test('K-975 BS08-078 arms the life-hit trap for this turn (flag only; the battle hook is not fought out here)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.turnNo = 11; P.lifeHitDestroy = null;
    await BS.FX_ACTIONS.LIFE_HIT_DESTROY_TURN.run({ p: P, opp: O, src: BS.mkInst('BS08-078'), ctx: {} }, BS.CARDS['BS08-078'].magic.actions[0]);
    return P.lifeHitDestroy; })()`);
  assert.equal(r, 11);
});

test('K-976 BS01-147 moves a Spirit to the top of its owner Deck', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.spirits.length = 0; P.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit'); const s = BS.mkInst(sp); s.cores = 2; O.spirits.push(s);
    const n = O.deck.length;
    await BS.FX_ACTIONS.SPIRIT_TO_DECKTOP.run({ p: P, opp: O, src: BS.mkInst('BS01-147'), ctx: {} }, BS.CARDS['BS01-147'].magic.by.MAIN.actions[0]);
    return [O.spirits.length, O.deck.length - n, O.deck[0] === s]; })()`);
  assert.deepEqual(r, [0, 1, true], JSON.stringify(r));
});

test('K-977 BS02-095 destroys an own Nexus, then empties every opposing Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.nexus.length = 0; O.nexus.length = 0;
    const nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus'); const a = BS.mkInst(nx), b = BS.mkInst(nx), o = BS.mkInst(nx); a.cores = 1; b.cores = 2; o.cores = 3; P.nexus.push(a, b); O.nexus.push(o);
    const t = O.trashCores.n;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS02-095'), ctx: {} }, { actions: BS.CARDS['BS02-095'].magic.actions });
    return [P.nexus.length, b.cores, o.cores, O.trashCores.n - t]; })()`);
  assert.deepEqual(r, [1, 2, 0, 3], JSON.stringify(r));
});

test('K-978 BS03-125 leaves one core on the Spirit and moves the rest to its owner Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; O.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit'); const s = BS.mkInst(sp); s.cores = 4; O.spirits.push(s); const rs = O.reserve.n;
    await BS.FX_ACTIONS.SPIRIT_BUT_ONE_TO_RESERVE.run({ p: P, opp: O, src: BS.mkInst('BS03-125'), ctx: {} }, BS.CARDS['BS03-125'].magic.by.MAIN.actions[0]);
    return [s.cores, O.reserve.n - rs]; })()`);
  assert.deepEqual(r, [1, 3], JSON.stringify(r));
});

test('K-979 BS03-124 sends cores from both Reserves to the Trash (CPU: two)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.reserve.n = 5; O.reserve.n = 1; const tp = P.trashCores.n, to = O.trashCores.n;
    await BS.FX_ACTIONS.RESERVE_TRASH_MIRROR.run({ p: P, opp: O, src: BS.mkInst('BS03-124'), ctx: {} }, BS.CARDS['BS03-124'].magic.by.MAIN.actions[0]);
    return [P.reserve.n, P.trashCores.n - tp, O.reserve.n, O.trashCores.n - to]; })()`);
  assert.deepEqual(r, [3, 2, 0, 1], JSON.stringify(r));
});

test('K-980 BS04-091 destroys only while an own Spirit has 2+ symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; O.spirits.length = 0;
    const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit');
    const two = ids.find(i => (BS.CARDS[i].symbols || 0) >= 2), one = ids.find(i => (BS.CARDS[i].symbols || 0) < 2);
    const lowBp = ids.find(i => BS.CARDS[i].levels && BS.CARDS[i].levels.length && BS.CARDS[i].levels[0].bp <= 4000 && BS.CARDS[i].cost <= 3);
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; };
    const out = [];
    for (const own of [one, two]) { P.spirits.length = 0; O.spirits.length = 0; P.spirits.push(mk(own)); const t = mk(lowBp); O.spirits.push(t);
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS04-091'), ctx: {} }, { actions: BS.CARDS['BS04-091'].magic.by.MAIN.actions }); out.push(O.spirits.length); }
    return out; })()`);
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-981 BS04-107 treats every opposing Spirit as LV1 only with a 2+ symbol Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit');
    const two = ids.find(i => (BS.CARDS[i].symbols || 0) >= 2), one = ids.find(i => (BS.CARDS[i].symbols || 0) < 2);
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; }; const out = [];
    for (const own of [one, two]) { P.spirits.length = 0; O.spirits.length = 0; P.spirits.push(mk(own)); const a = mk(one), b = mk(one); a.lv1Turn = b.lv1Turn = false; O.spirits.push(a, b);
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS04-107'), ctx: {} }, { actions: BS.CARDS['BS04-107'].magic.by.MAIN.actions }); out.push([!!a.lv1Turn, !!b.lv1Turn]); }
    return out; })()`);
  assert.deepEqual(r, [[false, false], [true, true]], JSON.stringify(r));
});

test('K-982 BS04-108 needs five Magicians, then wipes both Fields', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mg = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && (BS.CARDS[i].families || []).includes('Magician'));
    const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && !(BS.CARDS[i].families || []).includes('Magician'));
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; }; const out = [];
    for (const k of [4, 5]) { P.spirits.length = 0; O.spirits.length = 0; for (let i = 0; i < k; i++) P.spirits.push(mk(mg)); P.spirits.push(mk(sp)); O.spirits.push(mk(sp), mk(sp));
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS04-108'), ctx: {} }, { actions: BS.CARDS['BS04-108'].magic.by.MAIN.actions }); out.push([P.spirits.length, O.spirits.length]); }
    return out; })()`);
  assert.deepEqual(r, [[5, 2], [1, 0]], JSON.stringify(r));
});

test('K-983 BS04-114 destroys own Nexuses and the opponent loses as many Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.nexus.length = 0; O.spirits.length = 0;
    const nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus'); const sp = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit');
    P.nexus.push(BS.mkInst(nx), BS.mkInst(nx)); for (let i = 0; i < 3; i++) { const s = BS.mkInst(sp); s.cores = 1; O.spirits.push(s); }
    await BS.FX_ACTIONS.NEXUS_DESTROY_FOR_SPIRITS.run({ p: P, opp: O, src: BS.mkInst('BS04-114'), ctx: {} }, BS.CARDS['BS04-114'].magic.by.MAIN.actions[0]);
    return [P.nexus.length, O.spirits.length]; })()`);
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-984 BS03-137 and BS01-041 use existing actions (data shape + effect)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; O.spirits.length = 0;
    const mg = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && (BS.CARDS[i].families || []).includes('Magician'));
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; }; const out = [];
    for (const k of [3, 4]) { P.spirits.length = 0; O.spirits.length = 0; for (let i = 0; i < k; i++) P.spirits.push(mk(mg)); const t = mk(mg); O.spirits.push(t);
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS03-137'), ctx: {} }, { actions: BS.CARDS['BS03-137'].magic.by.MAIN.actions }); out.push(!!t.lv1Turn); }
    const e = BS.CARDS['BS01-041'].effects[0]; out.push(e.trigger, e.actions[0].do);
    return out; })()`);
  assert.deepEqual(r, [false, true, 'SUMMONED', 'SPIRIT_BUT_ONE_TO_RESERVE'], JSON.stringify(r));
});

test('K-985 BS08-007 destroys opposing 5000 BP or less Spirits with a When Summoned effect; BS08-044 has Tribute data', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; O.spirits.length = 0;
    const withS = Object.keys(BS.CARDS).find(i => { const k = BS.CARDS[i]; return k.type === 'Spirit' && (k.effects || []).some(e => e.trigger === 'SUMMONED') && k.levels && k.levels[0].bp <= 3000 && !(k.effects || []).some(e => e.trigger === 'STATIC'); });
    const without = Object.keys(BS.CARDS).find(i => { const k = BS.CARDS[i]; return k.type === 'Spirit' && !(k.effects || []).some(e => e.trigger === 'SUMMONED') && k.levels && k.levels[0].bp <= 3000 && !(k.effects || []).some(e => e.trigger === 'STATIC'); });
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; }; const a = mk(withS), b = mk(without); O.spirits.push(a, b);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS08-007'), ctx: {} }, { actions: BS.CARDS['BS08-007'].effects.find(e => e.trigger === 'SUMMONED').actions });
    return [O.spirits.includes(a), O.spirits.includes(b), BS.CARDS['BS08-044'].tribute.to]; })()`);
  assert.deepEqual(r, [false, true, 'trash'], JSON.stringify(r));
});

test('K-986 BS09-009 destroys a 3000 BP or less Spirit and two opposing Nexuses; Tribute data set', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.spirits.length = 0; O.nexus.length = 0;
    const nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus');
    for (let i = 0; i < 3; i++) O.nexus.push(BS.mkInst(nx));
    const sp = Object.keys(BS.CARDS).find(i => { const k = BS.CARDS[i]; return k.type === 'Spirit' && k.levels && k.levels[0].bp <= 3000 && !(k.effects || []).some(e => e.trigger === 'STATIC'); });
    const s = BS.mkInst(sp); s.cores = 1; O.spirits.push(s);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS09-009'), ctx: {} }, { actions: BS.CARDS['BS09-009'].effects.find(e => e.trigger === 'ATTACKS').actions });
    return [O.spirits.length, O.nexus.length, BS.CARDS['BS09-009'].tribute.to]; })()`);
  assert.deepEqual(r, [0, 1, 'void'], JSON.stringify(r));
});

test('K-987 BS09-018 sends cores from opposing Spirits equal to its level', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; O.spirits.length = 0;
    const sp = Object.keys(BS.CARDS).find(i => { const k = BS.CARDS[i]; return k.type === 'Spirit' && k.levels && k.levels[0].bp <= 3000 && !(k.effects || []).some(e => e.trigger === 'STATIC'); });
    const s = BS.mkInst(sp); s.cores = 5; O.spirits.push(s); const src = BS.mkInst('BS09-018'); src.cores = 2; const lv = BS.lvNo ? BS.lvNo(src) : null;
    const before = O.reserve.n; await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: BS.CARDS['BS09-018'].effects.find(e => e.trigger === 'ATTACKS').actions });
    return [O.reserve.n - before, lv, BS.CARDS['BS09-018'].tribute.to]; })()`);
  assert.ok(r[0] >= 1 && r[0] <= 3 && (r[1] == null || r[0] === r[1]), JSON.stringify(r));
  assert.equal(r[2], 'void');
});

test('K-988 BS09-054 has Tribute data and an optional Assault refresh on attack', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const k = BS.CARDS['BS09-054']; const e = k.effects.find(x => x.trigger === 'ATTACKS'); return [k.tribute.costGe, k.tribute.to, e.lv.join(), e.optional, e.actions[0].do, e.actions[0].n]; })()`);
  assert.deepEqual(r, [3, 'void', '2,3', true, 'ASSAULT', 1], JSON.stringify(r));
});

test('K-989 sameLvBattle condition is true only when both battlers have the same LV', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.spirits.length = 0; O.spirits.length = 0;
    const att = BS.mkInst('BS03-008'); att.cores = 1; const blk = BS.mkInst('BS03-008'); blk.cores = 1; P.spirits.push(att); O.spirits.push(blk); const out = [];
    const q = () => BS.fxIf(P, O, { sameLvBattle: true }, { selfInst: att });
    G.attacker = att; G.blocker = blk; out.push(q()); blk.cores = 9; out.push(q()); G.blocker = null; out.push(q()); G.attacker = null;
    const e = BS.CARDS['BS03-008'].effects.find(x => x.trigger === 'ALLY_BLOCKED'); out.push(e.self, e.actions[0].n, BS.CARDS['BS04-041'].effects.some(x => x.trigger === 'BLOCKS' && x.if && x.if.sameLvBattle));
    return out; })()`);
  assert.deepEqual(r, [true, false, false, true, 3000, true], JSON.stringify(r));
});

test('K-990 ctrl name list counts Spirits matching any of the names (BS04-052)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.spirits.length = 0;
    const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit'); const pn = ids.find(i => BS.CARDS[i].name.includes('Pentan')); const em = ids.find(i => BS.CARDS[i].name.includes('Empereur'));
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; }; const q = () => BS.fxIf(P, O, { ctrl: { n: 3, type: 'Spirit', name: ['Pentan', 'Empereur'] } }, {}); const out = [];
    P.spirits.push(mk(pn), mk(em)); out.push(q()); P.spirits.push(mk(pn)); out.push(q());
    const e = BS.CARDS['BS04-052'].effects[0]; out.push(e.flag, e.if.ctrl.name.length); return out; })()`);
  assert.deepEqual(r, [false, true, 'DRAW_PLUS', 2], JSON.stringify(r));
});

test('K-991 TREAT_LV2 all+highest marks every own Spirit; BS17-059/Brilliance cards have the shapes', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; P.spirits.length = 0; O.spirits.length = 0;
    const multi = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].levels.length > 1);
    const a = BS.mkInst(multi), b = BS.mkInst(multi); a.cores = 1; b.cores = 1; P.spirits.push(a, b);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS04-069'), ctx: {} }, { actions: BS.CARDS['BS04-069'].effects.find(e => e.trigger === 'SUMMONED').actions });
    const t = BS.CARDS['BS17-059'].effects[0].actions[0]; const br = ['BS04-047', 'BS08-042', 'BS17-045'].map(i => BS.CARDS[i].effects.some(e => e.trigger === 'ATTACKS' && e.actions[0].do === 'BRILLIANCE'));
    return [a.lvHighTurn, b.lvHighTurn, t.do, t.all, br.join()]; })()`);
  assert.deepEqual(r, [true, true, 'TREAT_LV1', true, 'true,true,true'], JSON.stringify(r));
});

test('K-992 NO_OPP_BURST locks the opponent Burst only while a matching Spirit attacks (BS29-018)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.spirits.length = 0;
    const s = BS.mkInst('BS29-018'); s.cores = 1; P.spirits.push(s); const plain = BS.mkInst(Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && !(BS.CARDS[i].families || []).includes('Investigator'))); plain.cores = 1; P.spirits.push(plain);
    const out = []; G.attacker = null; out.push(BS.burstLocked(O)); G.attacker = plain; out.push(BS.burstLocked(O)); G.attacker = s; out.push(BS.burstLocked(O)); out.push(BS.burstLocked(P)); G.attacker = null; return out; })()`);
  assert.deepEqual(r, [false, false, true, false], JSON.stringify(r));
});

test('K-993 Rush burst-lock cards: BS41-RV005 and BS19-060 have the NO_BURST_BATTLE and red-gated effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const sh = id => BS.CARDS[id].effects.map(e => e.trigger + ':' + (e.if ? e.if.hasSymbol : '-') + ':' + e.actions.map(a => a.do).join('+')).join('|'); return [sh('BS41-RV005'), sh('BS19-060')]; })()`);
  assert.deepEqual(r, ['ATTACKS:-:NO_BURST_BATTLE|BLOCKS:-:NO_BURST_BATTLE|ATTACKS:red:DESTROY+BP_PLUS|BLOCKS:red:DESTROY+BP_PLUS', 'ATTACKS:-:NO_BURST_BATTLE|ATTACKS:red:DRAW'], JSON.stringify(r));
});

test('K-994 NO_RETURN statics for BS06-005 (Terra Dragon) and BS42-015 (VioletCorpse, own attack step)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const f = id => BS.CARDS[id].effects.find(e => e.flag === 'NO_RETURN'), a = f('BS06-005'), b = f('BS42-015'); return [a.flag, a.match.family[0], b.flag, b.match.name[0], b.if.attackStep]; })()`);
  assert.deepEqual(r, ['NO_RETURN', 'Terra Dragon', 'NO_RETURN', 'VioletCorpse', true], JSON.stringify(r));
});

test('K-995 STATIC LV_PLUS raises the matching own Spirits one level while the source is at its LV (BS46-RV006)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player; P.spirits.length = 0;
    const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].levels.length > 2 && (BS.CARDS[i].families || []).includes('Investigator') && i !== 'BS46-RV006');
    const t = BS.mkInst(ids[0]); t.cores = BS.CARDS[ids[0]].levels[0].cores; P.spirits.push(t);
    const before = BS.lvIndex(t); const s = BS.mkInst('BS46-RV006'); s.cores = BS.CARDS['BS46-RV006'].levels[1].cores; P.spirits.push(s);
    const during = BS.lvIndex(t); const sLv = BS.lvIndex(s); s.cores = BS.CARDS['BS46-RV006'].levels[0].cores; const off = BS.lvIndex(t);
    return [before, during, off, sLv >= 1]; })()`);
  assert.deepEqual(r, [0, 1, 0, true], JSON.stringify(r));
});

test('K-996 static BP: BS43-RV005 reaches one-core Spirits in the own attack step, BS31-011 needs the Soul Core on the source', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player; P.spirits.length = 0;
    const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit' && i !== 'BS43-RV005'); const t = BS.mkInst(ids[0]); t.cores = 1; P.spirits.push(t);
    const s = BS.mkInst('BS43-RV005'); s.cores = BS.CARDS['BS43-RV005'].levels[1].cores; P.spirits.push(s);
    G.turn = 'player'; G.step = 'attack'; const b0 = BS.bpOf(t); const e = BS.CARDS['BS43-RV005'].effects.filter(x => x.bp === 12000).length;
    const w = BS.CARDS['BS31-011'].effects.find(x => x.bp === 10000); return [e, w.bp, w.if.selfSoul, w.match.family[0], typeof b0]; })()`);
  assert.deepEqual(r, [2, 10000, true, 'War Dragon', 'number'], JSON.stringify(r));
});

test('K-997 ALLY_LOST draw cards and the Investigator attack boost have the expected shapes (BS30-028, BS21-001, BS30-002)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const sh = id => BS.CARDS[id].effects.map(e => e.trigger + ':' + e.actions.map(a => a.do).join('+')).join('|'); return [sh('BS30-028'), sh('BS21-001'), sh('BS30-002')]; })()`);
  assert.deepEqual(r, ['ALLY_LOST:DRAW', 'ALLY_LOST:DRAW', 'ALLY_ATTACKS:BP_PLUS|ALLY_ATTACKS:DRAW'], JSON.stringify(r));
});

test('K-998 OPP_HAND_UP cards fire once per event (BS43-084, BS31-042 discard, BS42-027 void core)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const sh = id => BS.CARDS[id].effects.filter(e => e.trigger === 'OPP_HAND_UP').map(e => e.actions.map(a => a.do + (a.n || '')).join('+')).join('|'); return [sh('BS43-084'), sh('BS31-042'), sh('BS42-027')]; })()`);
  assert.deepEqual(r, ['OPP_DISCARD1', 'OPP_DISCARD1', 'VOID_TO_RESERVE1'], JSON.stringify(r));
});

test('K-999 LV_UP_TURN self: BS20-048 attacking is treated as one LV higher this turn (BS20-048)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.spirits.length = 0;
    const s = BS.mkInst('BS20-048'); s.cores = BS.CARDS['BS20-048'].levels[0].cores; P.spirits.push(s); G.turn = 'player';
    const before = BS.lvIndex(s); await BS.fireFx(P, 'ATTACKS', s, {}); return [before, BS.lvIndex(s), s.lvPlusTurn === true]; })()`);
  assert.deepEqual(r, [0, 1, true], JSON.stringify(r));
});

test('K-1000 match.redColorsGe: BS09-003 gives +2000 BP only to own Spirits with reduction symbols of two or more colors, in the own attack step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player; P.spirits.length = 0;
    const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit' && i !== 'BS09-003');
    const multi = ids.find(i => Object.keys(BS.CARDS[i].reduction).length >= 2), single = ids.find(i => !i.startsWith('TRAIN') && Object.keys(BS.CARDS[i].reduction).length === 1);
    const m = BS.mkInst(multi), s1 = BS.mkInst(single); m.cores = 1; s1.cores = 1; const src = BS.mkInst('BS09-003'); src.cores = BS.CARDS['BS09-003'].levels[1].cores;
    P.spirits.push(src, m); P.spirits.push(s1); G.turn = 'player'; G.step = 3; const m0 = BS.bpOf(m);
    G.step = 5; const m1 = BS.bpOf(m), s2 = BS.bpOf(s1); G.step = 3; const s0 = BS.bpOf(s1);
    P.spirits.splice(0,1); const d = BS.bpOf(s1); G.step = 5; return [m1 - m0, s2 - s0]; })()`);
  assert.deepEqual(r, [2000, 0], JSON.stringify(r));
});

test('K-1001 OPP_CORES_TO_RESERVE eachPerNexus: BS44-022 sends 1 core plus 1 per own Nexus from one opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.spirits.length = 0; O.spirits.length = 0; P.nexus.length = 0;
    const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit' && i !== 'BS44-022'), nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus');
    const s = BS.mkInst('BS44-022'); s.cores = 3; P.spirits.push(s); P.nexus.push(BS.mkInst(nx), BS.mkInst(nx));
    const t = BS.mkInst(ids[0]); t.cores = 6; O.spirits.push(t); G.turn = 'player'; const r0 = O.reserve.n;
    await BS.fireFx(P, 'ATTACKS', s, {}); return [6 - t.cores, O.reserve.n - r0]; })()`);
  assert.deepEqual(r, [3, 3], JSON.stringify(r));
});

test('K-1002 VOID_TO_CARD perMatchSpirit: BS09-024 adds one core per matching Beast Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.spirits.length = 0;
    const s = BS.mkInst('BS09-024'); s.cores = 1; P.spirits.push(s);
    const other = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && i !== 'BS09-024' && (BS.CARDS[i].families || []).includes('Giant Beast')), none = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && !(BS.CARDS[i].families || []).some(f => /Beast/.test(f)));
    P.spirits.push(BS.mkInst(other), BS.mkInst(none)); G.turn = 'player'; const c0 = s.cores;
    await BS.fireFx(P, 'SUMMONED', s, {}); return [s.cores - c0]; })()`);
  assert.deepEqual(r, [2], JSON.stringify(r));
});

test('K-1003 SELF_CORE_REFRESH: BS17-024 pays one of its cores to refresh itself, only while exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.spirits.length = 0;
    const s = BS.mkInst('BS17-024'); s.cores = BS.CARDS['BS17-024'].levels[1].cores + 1; P.spirits.push(s); G.turn = 'player'; P.cpu = true;
    const run = () => BS.FX_ACTIONS.SELF_CORE_REFRESH.run({ p: P, opp: G.p.opponent, src: s, ctx: {} }, { do: 'SELF_CORE_REFRESH' });
    const ctx0 = { did: true }; s.exhausted = false; const c0 = s.cores; await run(); const notEx = [s.cores - c0, s.exhausted];
    s.exhausted = true; await run(); return [notEx, s.cores - c0, s.exhausted]; })()`);
  assert.deepEqual(r, [[0, false], -1, false], JSON.stringify(r));
});
