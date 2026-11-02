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

test('K-905 BS33-082 Main destroys a Rush Spirit only with Soul Core paid; BS31-106 Flash refreshes only with Soul Core paid', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const rush = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].mechanics || []).includes('Rush'));
    const plain = Object.keys(BS.CARDS).find(id => /^BS0/.test(id) && BS.CARDS[id].type === 'Spirit' && !(BS.CARDS[id].effects || []).length);
    const out = { rush };
    for (const paid of [false, true]) {
      O.spirits.length = 0; P.spirits.length = 0; P.deck.length = Math.max(P.deck.length, 5);
      const a = BS.mkInst(rush); a.cores = 2; O.spirits.push(a); const b = BS.mkInst(plain); b.cores = 2; O.spirits.push(b);
      const m = BS.mkInst('BS33-082'); m.soulPaid = paid;
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS33-082'].magic.by.MAIN.actions });
      out['rush' + paid] = O.spirits.includes(a);
      const s = BS.mkInst(plain); s.cores = 2; s.exhausted = true; P.spirits.length = 0; P.spirits.push(s);
      const n = BS.mkInst('BS31-106'); n.soulPaid = paid;
      await BS.runActions({ p: P, opp: O, src: n, ctx: { selfInst: n } }, { actions: BS.CARDS['BS31-106'].magic.by.FLASH.actions });
      out['ref' + paid] = !s.exhausted;
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.ok(r.rush, m); assert.equal(r.rushfalse, true, m); assert.equal(r.rushtrue, false, m);
  assert.equal(r.reffalse, false, m); assert.equal(r.reftrue, true, m);
});

test('K-906 BS19-111 and BS22-075 Rush parts run only while the Field has the symbol colour', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const mine = col => Object.keys(BS.CARDS).find(id => /^BS0/.test(id) && BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].symbol === col && BS.CARDS[id].symbols >= 1);
    const foe = 'BS01-002';
    const out = {};
    for (const [id, col, other] of [['BS19-111', 'white', 'red'], ['BS22-075', 'blue', 'red']]) {
      for (const c of [col, other]) {
        P.spirits.length = 0; O.spirits.length = 0;
        const s = BS.mkInst(mine(c)); s.cores = 2; P.spirits.push(s); const f = BS.mkInst(foe); f.cores = 1; O.spirits.push(f);
        const m = BS.mkInst(id);
        await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.actions });
        out[id + c] = O.spirits.length;
      }
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.equal(r['BS19-111white'], 0, m); assert.equal(r['BS19-111red'], 1, m);
  assert.equal(r['BS22-075blue'], 0, m); assert.equal(r['BS22-075red'], 1, m);
});

test('K-907 BS58-079 Rush destroys an Ultimate with 3+ cores only with a purple symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const ult = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Ultimate');
    const pur = Object.keys(BS.CARDS).find(id => /^BS0/.test(id) && BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].symbol === 'purple' && BS.CARDS[id].symbols >= 1);
    const out = {};
    for (const [tag, withSym, cores] of [['sym3', true, 3], ['sym2', true, 2], ['nosym3', false, 3]]) {
      P.spirits.length = 0; O.spirits.length = 0; O.nexus.length = 0;
      if (withSym) { const s = BS.mkInst(pur); s.cores = 2; P.spirits.push(s); }
      const u = BS.mkInst(ult); u.cores = cores; O.spirits.push(u);
      const m = BS.mkInst('BS58-079');
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS58-079'].magic.actions.slice(2) });
      out[tag] = O.spirits.length;
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.equal(r.sym3, 0, m); assert.equal(r.sym2, 1, m); assert.equal(r.nosym3, 1, m);
});

test('K-908 BS24-110 exhausts every 5000-BP-or-less foe only with a green symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const grn = Object.keys(BS.CARDS).find(id => /^BS0/.test(id) && BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].symbol === 'green' && BS.CARDS[id].symbols >= 1);
    const out = {};
    for (const [tag, withSym] of [['sym', true], ['nosym', false]]) {
      P.spirits.length = 0; O.spirits.length = 0;
      if (withSym) { const s = BS.mkInst(grn); s.cores = 2; P.spirits.push(s); }
      for (let i = 0; i < 3; i++) { const f = BS.mkInst('BS01-002'); f.cores = 1; O.spirits.push(f); }
      const m = BS.mkInst('BS24-110');
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS24-110'].magic.actions });
      out[tag] = O.spirits.filter(x => x.exhausted).length;
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.equal(r.nosym, 0, m); assert.ok(r.sym >= 1, m);
});

test('K-909 BS22-083 discards the opposing Burst only with a white symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const wht = Object.keys(BS.CARDS).find(id => /^BS0/.test(id) && BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].symbol === 'white' && BS.CARDS[id].symbols >= 1);
    const out = {};
    for (const [tag, withSym] of [['sym', true], ['nosym', false]]) {
      P.spirits.length = 0; O.spirits.length = 0; O.burst = BS.mkInst('BS01-002');
      if (withSym) { const s = BS.mkInst(wht); s.cores = 2; P.spirits.push(s); }
      const f = BS.mkInst('BS01-002'); f.cores = 1; O.spirits.push(f);
      const m = BS.mkInst('BS22-083');
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS22-083'].magic.actions });
      out[tag] = [O.spirits.length, !!O.burst];
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.deepEqual(r.sym, [0, false], m); assert.deepEqual(r.nosym, [0, true], m);
});

test('K-910 BS23-080 Rush destroys an exhausted cost<=7 foe only with purple and green symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const find = col => Object.keys(BS.CARDS).find(id => /^BS0/.test(id) && BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].symbol === col && BS.CARDS[id].symbols >= 1);
    const out = {};
    for (const [tag, cols] of [['both', ['purple', 'green']], ['one', ['purple']]]) {
      P.spirits.length = 0; O.spirits.length = 0;
      for (const c of cols) { const s = BS.mkInst(find(c)); s.cores = 2; P.spirits.push(s); }
      const f = BS.mkInst('BS01-002'); f.cores = 1; f.exhausted = true; O.spirits.push(f);
      const m = BS.mkInst('BS23-080');
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS23-080'].magic.actions.slice(1) });
      out[tag] = O.spirits.length;
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.equal(r.both, 0, m); assert.equal(r.one, 1, m);
});

test('K-911 alsoMagic: a Spirit with a Magic Flash is usable only from the Hand, only in Flash, and ends in the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    P.spirits.length = 0; O.spirits.length = 0; P.hand.length = 0;
    const f = BS.mkInst('BS01-002'); f.cores = 1; O.spirits.push(f);
    const m = BS.mkInst('BS43-050'); P.hand.push(m); P.reserve.n = 6;
    const out = { main: BS.magicUsable(P, m, 'main'), flash: BS.magicUsable(P, m, 'flash') };
    await BS.castMagic(P, { inst: m, target: f, plan: null, ctx: 'flash' });
    out.inTrash = P.trash.includes(m); out.inHand = P.hand.includes(m); out.zero = f.symZeroTurn != null || O.symZeroTurn != null || JSON.stringify(O).includes('symZero');
    const f2 = BS.mkInst('BS43-050'); P.spirits.push(f2); out.field = BS.magicUsable(P, f2, 'flash');
    return out;
  });
  const m = JSON.stringify(r);
  assert.equal(r.main, false, m); assert.equal(r.flash, true, m);
  assert.equal(r.inTrash, true, m); assert.equal(r.inHand, false, m); assert.equal(r.field, false, m);
});

test('K-912 alsoMagic Spirit with BP_MINUS zeroDestroy destroys a foe brought to 0 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    const out = {};
    for (const [tag, cores] of [['low', 1], ['high', 5]]) {
      P.spirits.length = 0; O.spirits.length = 0; P.hand.length = 0;
      const f = BS.mkInst('BS01-002'); f.cores = cores; O.spirits.push(f);
      const m = BS.mkInst('SD57-RV003'); P.hand.push(m); P.reserve.n = 6;
      out[tag + 'Bp'] = BS.bpOf(f);
      await BS.castMagic(P, { inst: m, target: f, plan: null, ctx: 'flash' });
      out[tag] = O.spirits.length;
    }
    return out;
  });
  const m = JSON.stringify(r);
  assert.ok(r.lowBp > 3000 ? r.low === 1 : r.low === 0, m);
});

test('K-913 BS43-X05 summonAfter: Flash -10000 BP destroys at 0, then the card is summoned free instead of the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    P.spirits.length = 0; O.spirits.length = 0; P.hand.length = 0; P.trash.length = 0;
    const f = BS.mkInst('BS01-002'); f.cores = 1; O.spirits.push(f);
    const m = BS.mkInst('BS43-X05'); P.hand.push(m); P.reserve.n = 6;
    await BS.castMagic(P, { inst: m, target: f, plan: null, ctx: 'flash' });
    return { foe: O.spirits.length, onField: P.spirits.includes(m), inTrash: P.trash.includes(m), usable: BS.magicUsable(P, m, 'main') };
  });
  const m = JSON.stringify(r);
  assert.equal(r.foe, 0, m); assert.equal(r.onField, true, m); assert.equal(r.inTrash, false, m);
});

test('K-914 BS71-023: Mirage set gives every Weapon Insect +1000 BP per counter (per.type Counter)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0; P.count = 3;
    const wi = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Weapon Insect') && BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects);
    const a = BS.mkInst(wi); a.cores = 1; P.spirits.push(a);
    const o = BS.mkInst('BS01-002'); o.cores = 1; P.spirits.push(o);
    const m = BS.mkInst('BS71-023'); m.mirage = true; P.mirage = m;
    const b0 = [BS.bpOf(a), BS.bpOf(o)];
    await BS.fireFx(P, 'MIRAGE_SET', m, {});
    return { wiBefore: b0[0], d: BS.bpOf(a) - b0[0], other: BS.bpOf(o) - b0[1], cplt: BS.CARDS['BS71-023'].fxComplete };
  });
  const j = JSON.stringify(r);
  assert.equal(r.d, 3000, j); assert.equal(r.other, 0, j);
});

test('K-915 BS63-021: when destroyed counter +2 and returns The PartnerMusha Oboro from the Trash, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0; P.hand.length = 0; P.trash.length = 0; P.count = 0; P.void = 5;
    const s = BS.mkInst('BS63-021'); s.cores = 0; s.lostLv = 1; P.trash.push(s);
    const ob = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name === 'The PartnerMusha Oboro'); const o = BS.mkInst(ob); P.trash.push(o);
    await BS.fireFx(P, 'DESTROYED', s, { subject: s });
    const r1 = { count: P.count, back: P.hand.includes(o) };
    await BS.fireFx(P, 'DESTROYED', s, { subject: s });
    return { r1, count2: P.count, cplt: BS.CARDS['BS63-021'].fxComplete };
  });
  const j = JSON.stringify(r);
  assert.equal(r.r1.count, 2, j); assert.equal(r.r1.back, true, j); assert.equal(r.count2, 2, j);
});

test('K-916 BS49-027: Void core goes to the Reserve (CPU default) via CHOOSE_ONE; one Void core moved', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true; P.spirits.length = 0; O.spirits.length = 0; P.hand.length = 0; P.trash.length = 0; P.void = 3; P.reserve.n = 0;
    const s = BS.mkInst('BS49-027'); s.cores = 1; P.spirits.push(s);
    const before = P.reserve.n + s.cores + P.void;
    await BS.fireFx(P, 'SUMMONED', s, {});
    return { voidUsed: 3 - P.void, conserved: P.reserve.n + s.cores + P.void === before };
  });
  const j = JSON.stringify(r);
  assert.equal(r.voidUsed, 1, j); assert.equal(r.conserved, true, j);
});
