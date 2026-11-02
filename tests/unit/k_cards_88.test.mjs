// Lane K cards, batch 88.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-895 BS73-035: attack puts a Void core; at 6+ counters refreshes a cost<=5 Machine Beast once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0; P.reserve.n = 10; P.void = 5;
    const s = BS.mkInst('BS73-035'); s.cores = 1; P.spirits.push(s);
    const mb = BS.mkInst('BS31-038'); mb.cores = 1; mb.exhausted = true; P.spirits.push(mb);
    P.count = 3;
    await BS.fireFx(P, 'ATTACKS', s, { subject: s, attacker: s });
    const lowEx = mb.exhausted, c1 = s.cores;
    P.count = 6;
    await BS.fireFx(P, 'ATTACKS', s, { subject: s, attacker: s });
    return { lowEx, c1, hiEx: mb.exhausted, c2: s.cores };
  });
  const m = JSON.stringify(r);
  assert.equal(r.c1, 2, m); assert.equal(!!r.lowEx, true, m); assert.equal(!!r.hiEx, false, m);
});

test('K-896 BS68-004: draws when a red Devotee/Concluser enters via an effect, once per turn, not on a normal summon', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0; P.reserve.n = 10; P.void = 5;
    const id = Object.keys(BS.CARDS).find(i => { const k = BS.CARDS[i]; return k.type === 'Spirit' && (k.colors || [k.symbol]).includes('red') && (k.families || []).some(f => /devotee|concluser/i.test(f)) && i !== 'BS68-004'; });
    const s = BS.mkInst('BS68-004'); s.cores = 3; P.spirits.push(s);
    const h0 = P.hand.length;
    const a = BS.mkInst(id); a.viaFx = false;
    await BS.fireFx(P, 'ALLY_SUMMONED', s, { subject: a }); const d0 = P.hand.length - h0;
    const b = BS.mkInst(id); b.viaFx = true;
    await BS.fireFx(P, 'ALLY_SUMMONED', s, { subject: b }); const d1 = P.hand.length - h0;
    const c = BS.mkInst(id); c.viaFx = true;
    await BS.fireFx(P, 'ALLY_SUMMONED', s, { subject: c }); const d2 = P.hand.length - h0;
    return { id, d0, d1, d2 };
  });
  const m = JSON.stringify(r);
  assert.equal(r.d0, 0, m); assert.equal(r.d1, 1, m); assert.equal(r.d2, 1, m);
});

test('K-897 BS35-026: opposing non-Green Spirits summoned by an effect enter exhausted; Green ones do not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true; P.spirits.length = 0; O.spirits.length = 0; O.reserve.n = 20;
    const s = BS.mkInst('BS35-026'); s.cores = 1; P.spirits.push(s);
    const ids = Object.keys(BS.CARDS).filter(i => { const k = BS.CARDS[i]; return k.type === 'Spirit' && k.levels[0].cores === 1; });
    const col = i => BS.CARDS[i].colors || [BS.CARDS[i].symbol];
    const red = ids.find(i => col(i).length === 1 && col(i)[0] === 'red'), grn = ids.find(i => col(i).length === 1 && col(i)[0] === 'green');
    const a = BS.mkInst(red), b = BS.mkInst(grn); O.hand.push(a, b);
    await BS.summonFree(O, a); await BS.summonFree(O, b);
    const own = BS.mkInst(red); P.hand.push(own); await BS.summonFree(P, own);
    return { a: !!a.exhausted, b: !!b.exhausted, own: !!own.exhausted };
  });
  const m = JSON.stringify(r);
  assert.equal(r.a, true, m); assert.equal(r.b, false, m); assert.equal(r.own, false, m);
});

test('K-898 BS22-011: when destroyed, destroys an opposing exhausted Brave of cost 12 or less, not a Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; P.spirits.length = 0; O.spirits.length = 0;
    const s = BS.mkInst('BS22-011'); s.cores = 0; s.lostLv = 0; P.trash = [s];
    const sp = BS.mkInst('BS22-011'); sp.cores = 1; sp.exhausted = true;
    const br = BS.mkInst('BS21-064'); br.cores = 1; br.exhausted = true;
    const fresh = BS.mkInst('BS21-064'); fresh.cores = 1;
    O.spirits.push(sp, br, fresh);
    await BS.fireFx(P, 'DESTROYED', s, { subject: s });
    return { sp: O.spirits.includes(sp), br: O.spirits.includes(br), fresh: O.spirits.includes(fresh) };
  });
  const m = JSON.stringify(r);
  assert.equal(r.br, false, m); assert.equal(r.sp, true, m); assert.equal(r.fresh, true, m);
});

test('K-899 BS21-064 (Lv1) and BS45-073 (Lv4, own Main Step only) gain an extra Yellow symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0;
    const b = BS.mkInst('BS21-064'); b.cores = 1; P.spirits.push(b);
    const u = BS.mkInst('BS45-073'); u.cores = 9; P.spirits.push(u);
    const STEPS = ['START', 'CORE', 'DRAW', 'REFRESH', 'MAIN', 'ATTACK', 'END'];
    G.step = STEPS.indexOf('MAIN');
    const inMain = [BS.extraSymbolsOf(P, b).length, BS.extraSymbolsOf(P, u).length];
    G.step = STEPS.indexOf('ATTACK');
    const inAtk = [BS.extraSymbolsOf(P, b).length, BS.extraSymbolsOf(P, u).length];
    return { inMain, inAtk, lv: BS.lvNo ? BS.lvNo(u) : null };
  });
  const m = JSON.stringify(r);
  assert.deepEqual(r.inMain, [1, 1], m); assert.deepEqual(r.inAtk, [1, 0], m);
});

test('K-900 BS35-001 (+15000 on attack) and BS37-025 (+5000 static) apply only During Seal', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0;
    const a = BS.mkInst('BS35-001'); a.cores = 2; P.spirits.push(a);
    const b = BS.mkInst('BS37-025'); b.cores = 2; P.spirits.push(b);
    const out = {};
    for (const sealed of [false, true]) {
      P.lifeSoul = sealed;
      const a0 = BS.bpOf(a); a.bpMod = 0; const base = BS.bpOf(b);
      await BS.fireFx(P, 'ATTACKS', a, { subject: a, attacker: a });
      out['atk' + sealed] = BS.bpOf(a) - a0; out['st' + sealed] = BS.bpOf(b); a.bpMod = 0;
    }
    out.diff = out.sttrue - out.stfalse;
    return out;
  });
  const m = JSON.stringify(r);
  assert.equal(r.atkfalse, 0, m); assert.equal(r.atktrue, 15000, m); assert.equal(r.diff, 5000, m);
});

test('K-901 BS35-002 gains +5000 BP only while a War Dragon Spirit holds a Soul Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0;
    const a = BS.mkInst('BS35-002'); a.cores = 3; P.spirits.push(a);
    const w = BS.mkInst(Object.keys(BS.CARDS).find(id => (BS.CARDS[id].families || []).includes('War Dragon') && BS.CARDS[id].type === 'Spirit' && id !== 'BS35-002')); w.cores = 2; P.spirits.push(w);
    w.soul = false; const off = BS.bpOf(a); w.soul = true; const on = BS.bpOf(a);
    return { d: on - off };
  });
  assert.equal(r.d, 5000, JSON.stringify(r));
});

test('K-902 BS31-108 bounces an Ultimate only when the Magic was cast with its Soul Core paid', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const out = {};
    for (const paid of [false, true]) {
      P.spirits.length = 0; O.spirits.length = 0;
      const u = BS.mkInst(Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Ultimate')); u.cores = 3; O.spirits.push(u);
      const m = BS.mkInst('BS31-108'); m.soulPaid = paid;
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS31-108'].magic.actions });
      out['left' + paid] = O.spirits.length;
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.equal(r.leftfalse, 1, m); assert.equal(r.lefttrue, 0, m);
});

test('K-903 SD29-013 destroys two small Spirits (+ a Nexus with Soul Core); SD29-015 widens to an Ultimate with Soul Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const small = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].levels && BS.CARDS[id].levels[0].bp <= 3000);
    const ult = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Ultimate' && BS.CARDS[id].levels && BS.CARDS[id].levels[0].bp <= 20000);
    const run = async (id, paid) => {
      P.spirits.length = 0; O.spirits.length = 0;
      for (const sid of [small, small, ult]) { const s = BS.mkInst(sid); s.cores = 3; O.spirits.push(s); }
      const m = BS.mkInst(id); m.soulPaid = paid;
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.actions });
      return O.spirits.filter(x => BS.CARDS[x.id].type === 'Ultimate').length;
    };
    return { a: await run('SD29-013', false), c0: await run('SD29-015', false), c1: await run('SD29-015', true) };
  });
  const m = JSON.stringify(r);
  assert.equal(r.a, 1, m); assert.equal(r.c0, 1, m); assert.equal(r.c1, 0, m);
});

test('K-904 BS12-084 destroys the lowest-cost opposing Spirit; BS21-076 leaves one core on two opposing Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const sp = Object.keys(BS.CARDS).filter(id => /^BS0/.test(id) && BS.CARDS[id].type === 'Spirit' && !(BS.CARDS[id].effects || []).length);
    const lo = sp.find(id => BS.CARDS[id].cost === 1), hi = sp.find(id => BS.CARDS[id].cost >= 4);
    const run = async id => { const m = BS.mkInst(id); await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.actions }); };
    O.spirits.length = 0; const a = BS.mkInst(lo), b = BS.mkInst(hi); a.cores = 2; b.cores = 2; O.spirits.push(a, b);
    await run('BS12-084'); const left = O.spirits.map(x => x.id);
    O.spirits.length = 0; const c = BS.mkInst(lo), d = BS.mkInst(hi); c.cores = 4; d.cores = 4; O.spirits.push(c, d);
    await run('BS21-076');
    return { left, lo, hi, cores: [c.cores, d.cores] };
  });
  const m = JSON.stringify(r);
  assert.deepEqual(r.left, [r.hi], m); assert.deepEqual(r.cores, [1, 1], m);
});
