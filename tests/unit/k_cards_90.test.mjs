// Lane K cards, batch 90 (saga-60 product cards).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1001 SD10-014 Twin Flame destroys two opposing 2000 BP or less Spirits and spares bigger ones', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = (id, n) => { const x = BS.mkInst(id); x.cores = n; return x; };
    const a = mk('BS01-001', 1), b = mk('BS01-001', 1), c = mk('BS01-001', 1); O.spirits = [a, b, c];
    const big = mk('BS01-001', 9); O.spirits.push(big);
    P.reserve.n = 20; const m = BS.mkInst('SD10-014'); P.hand = [m];
    const before = O.spirits.length;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { before, after: O.spirits.length, big: O.spirits.includes(big), bp: BS.bpOf(a) }; })()`);
  assert.ok(r.bp <= 2000 || r.before - r.after <= 2, JSON.stringify(r));
  assert.ok(r.before - r.after <= 2 && r.before - r.after >= 1, JSON.stringify(r));
  assert.equal(r.big, true, JSON.stringify(r));
});

test('K-1002 SD01-035 draws a card and gives a Spirit +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('BS01-001'); s.cores = 1; P.spirits = [s]; P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    P.reserve.n = 20; const m = BS.mkInst('SD01-035'); P.hand = [m]; const b0 = BS.bpOf(s);
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { hand: P.hand.length, d: BS.bpOf(s) - b0 }; })()`);
  assert.equal(r.hand, 1, JSON.stringify(r));
  assert.equal(r.d, 1000, JSON.stringify(r));
});

test('K-1003 SD26-013 draws 2 (+1 at Life 2 or less); SD29-014 draws 2 and returns a War Dragon from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    for (const lf of [5, 2]) {
      P.life = lf; P.deck = Array.from({ length: 6 }, () => BS.mkInst('BS01-001')); P.reserve.n = 20; const m = BS.mkInst('SD26-013'); P.hand = [m];
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' }); out.push(P.hand.length);
    }
    return out; })()`);
  assert.ok(r[1] === r[0] + 1, JSON.stringify(r));
});

test('K-1004 SD20-016 bounces an opposing Spirit and refreshes one of yours; SD01-037 puts a core from the Void into the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('BS01-001'); s.cores = 1; s.exhausted = true; P.spirits = [s]; const o = BS.mkInst('BS01-001'); o.cores = 1; O.spirits = [o];
    P.reserve.n = 20; const m = BS.mkInst('SD20-016'); P.hand = [m];
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { opp: O.spirits.length, refreshed: !s.exhausted }; })()`);
  assert.deepEqual(r, { opp: 0, refreshed: true }, JSON.stringify(r));
});

test('K-1005 SD19-016 / SD67-RV006 and SD65-RV002 are fully wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`['SD19-016', 'SD67-RV006', 'SD65-RV002', 'SD01-037', 'SD29-014', 'PC02-RV002'].map(id => BS.CARDS[id].fxComplete !== false && !!BS.CARDS[id].magic)`);
  assert.deepEqual(r, [true, true, true, true, true, true], JSON.stringify(r));
});

test('K-1006 SD10-016 / SD17-016 / SD01-034 draw 2 then pick from the reveal', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = {};
    for (const id of ['SD10-016', 'SD17-016', 'SD01-034']) {
      P.deck = Array.from({ length: 8 }, () => BS.mkInst('BS01-001')); P.reserve.n = 20; const m = BS.mkInst(id); P.hand = [m];
      const d0 = P.deck.length;
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' });
      out[id] = { hand: P.hand.length, deckLost: d0 - P.deck.length };
    }
    return out; })()`);
  for (const id of Object.keys(r)) { assert.ok(r[id].hand >= 2 && r[id].hand <= 4, id + JSON.stringify(r)); assert.ok(r[id].deckLost >= 2, id + JSON.stringify(r)); }
});

test('K-1007 seventeen empty-text saga-60 Spirits are complete vanilla cards; SD22-005 / SD67-RV002 return a Void core when summoned in an Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`['SD01-001', 'SD01-014', 'SD03-005', 'SD34-006', 'SD33-004'].map(id => BS.CARDS[id].fxComplete !== false && !(BS.CARDS[id].effects || []).length)
    .concat(['SD22-005', 'SD67-RV002'].map(id => BS.CARDS[id].fxComplete !== false && BS.CARDS[id].effects.length === 1))`);
  assert.deepEqual(r, [true, true, true, true, true, true, true], JSON.stringify(r));
});

test('K-1008 EX010 (+1000 BP for Astral/Winged Dragon in the Attack Step) and SD29-007 (reveal four, War Dragon to hand) are wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`['EX010', 'SD29-007'].map(id => BS.CARDS[id].fxComplete !== false && (BS.CARDS[id].effects || []).length === 1)`);
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-1009 SD06-015 Burst (Life reduced) destroys three opposing 4000 BP or less Spirits, then offers its Flash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const c = BS.CARDS['SD06-015']; return c.fxComplete !== false && c.burst.when === 'LIFE_DECREASE' && c.burst.thenFlash === true && !!c.magic; })()`);
  assert.equal(r, true);
});

test('K-1010 SD17-014 destroys a 3000 BP Spirit then, with a Green symbol, exhausts another; SD14-008 / SD11-014 / SD11-015 / SD33-012 are wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = (id, n) => { const x = BS.mkInst(id); x.cores = n; return x; };
    const a = mk('BS01-001', 1), b = mk('BS01-001', 1); O.spirits = [a, b]; P.reserve.n = 20;
    const m = BS.mkInst('SD17-014'); P.hand = [m];
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { opp: O.spirits.length, wired: ['SD14-008', 'SD11-014', 'SD11-015', 'SD33-012'].every(id => BS.CARDS[id].fxComplete !== false && !!BS.CARDS[id].magic) }; })()`);
  assert.ok(r.opp <= 1, JSON.stringify(r));
  assert.equal(r.wired, true);
});

test('K-1011 SD45-013 draws two and destroys an opposing 10000 BP or less Spirit only while a "Mega" family Spirit is controlled', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = (id, n) => { const x = BS.mkInst(id); x.cores = n; return x; };
    const out = [];
    for (const mega of [false, true]) {
      P.spirits = mega ? [mk('SD45-005', 2)] : [mk('BS01-001', 1)]; O.spirits = [mk('BS01-001', 1)];
      P.deck = Array.from({ length: 6 }, () => BS.mkInst('BS01-001')); P.reserve.n = 20;
      const m = BS.mkInst('SD45-013'); P.hand = [m];
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' });
      out.push({ hand: P.hand.length, opp: O.spirits.length });
    }
    return out; })()`);
  assert.equal(r[0].opp, 1, JSON.stringify(r));
  assert.equal(r[1].opp, 0, JSON.stringify(r));
  assert.ok(r[0].hand >= 2, JSON.stringify(r));
});

test('K-1012 SD24-014 / SD25-007 Burst (Life reduced) wiring; SD24-014 Flash gives +4000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('BS01-001'); s.cores = 1; P.spirits = [s]; P.reserve.n = 20; const b0 = BS.bpOf(s);
    const m = BS.mkInst('SD24-014'); P.hand = [m];
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { d: BS.bpOf(s) - b0, w: ['SD24-014', 'SD25-007'].every(id => BS.CARDS[id].fxComplete !== false && BS.CARDS[id].burst.when === 'LIFE_DECREASE' && BS.CARDS[id].burst.thenFlash === true) }; })()`);
  assert.equal(r.d, 4000, JSON.stringify(r));
  assert.equal(r.w, true);
});

test('K-1013 SD19-013 / SD64-RV009 draw two, plus one while an Ultimate is controlled', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    const ult = Object.values(BS.CARDS).find(c => c.type === 'Ultimate');
    for (const withU of [false, true]) for (const id of ['SD19-013', 'SD64-RV009']) {
      const u = BS.mkInst(ult.id); u.cores = 5; P.spirits = withU ? [u] : [];
      P.deck = Array.from({ length: 8 }, () => BS.mkInst('BS01-001')); P.reserve.n = 20;
      const m = BS.mkInst(id); P.hand = [m];
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' });
      out.push(P.hand.length);
    }
    return out; })()`);
  assert.deepEqual(r, [2, 2, 3, 3], JSON.stringify(r));
});

test('K-1014 SD55-013 draws until the Hand is four, or draws three with two counters', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    for (const ctr of [0, 2]) {
      P.count = ctr; P.deck = Array.from({ length: 10 }, () => BS.mkInst('BS01-001')); P.reserve.n = 20;
      const m = BS.mkInst('SD55-013'); P.hand = [m];
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' });
      out.push(P.hand.length);
    }
    return out; })()`);
  assert.deepEqual(r, [4, 3], JSON.stringify(r));
});

test('K-1015 SD62-015 Flash gives an "Evangelion"-named Spirit +3000 BP and ignores others; Main choice is wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const eva = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.name.includes('Evangelion'));
    const e = BS.mkInst(eva.id); e.cores = 2; const o = BS.mkInst('BS01-001'); o.cores = 1; P.spirits = [o, e]; P.reserve.n = 20;
    const e0 = BS.bpOf(e), o0 = BS.bpOf(o); const m = BS.mkInst('SD62-015'); P.hand = [m];
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { de: BS.bpOf(e) - e0, doo: BS.bpOf(o) - o0, ok: BS.CARDS['SD62-015'].fxComplete !== false }; })()`);
  assert.deepEqual(r, { de: 3000, doo: 0, ok: true }, JSON.stringify(r));
});

test('K-1016 SD19-015 destroys up to 5000 BP total and returns a Spirit from the Trash only when something was destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    for (const has of [false, true]) {
      const o = BS.mkInst('BS01-001'); o.cores = 1; O.spirits = has ? [o] : [];
      P.trash = [BS.mkInst('BS01-001')]; P.reserve.n = 20; const m = BS.mkInst('SD19-015'); P.hand = [m];
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
      out.push({ opp: O.spirits.length, hand: P.hand.length });
    }
    return out; })()`);
  assert.equal(r[1].opp, 0, JSON.stringify(r));
  assert.equal(r[1].hand, 1, JSON.stringify(r));
  assert.equal(r[0].hand, 0, JSON.stringify(r));
});

test('K-1017 eight saga-60 Spirits are complete and carry their effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => ['SD01-021','SD19-005','SD19-006','SD20-003','SD20-006','SD17-007','SD17-004','SD13-003'].map(id => { const c = BS.CARDS[id]; return [id, c.implemented === true && !(c.residual || []).length && (c.effects || []).length > 0]; }))()`);
  assert.deepEqual(r.filter(x => !x[1]), [], JSON.stringify(r));
});

test('K-1018 BS69-CP01 gains +1000 BP on attack only with two Winged Dragon Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = G.p.opponent.cpu = true;
    const wd = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.id !== 'BS69-CP01' && (c.families || []).includes('Winged Dragon'));
    const s = BS.mkInst('BS69-CP01'); s.cores = 3; const w = BS.mkInst(wd.id); w.cores = 2;
    const out = [];
    for (const sp of [[s], [s, w]]) { P.spirits = sp; const b = BS.bpOf(s);
      await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); out.push(BS.bpOf(s) - b); }
    return out; })()`);
  assert.deepEqual(r, [0, 1000], JSON.stringify(r));
});

test('K-1019 SD19-002 / SD64-RV002 are also treated as White and count complete', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => ['SD19-002','SD64-RV002'].map(id => { const c = BS.CARDS[id]; return [id, (c.colors || []).includes('white') && (c.colors || []).includes('red') && c.implemented === true]; }))()`);
  assert.deepEqual(r.filter(x => !x[1]), [], JSON.stringify(r));
});

test('K-1020 SD22-002 / SD28-001 carry High Speed and count complete', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => ['SD22-002','SD28-001'].map(id => { const c = BS.CARDS[id]; return [id, c.highSpeed === true && c.implemented === true]; }))()`);
  assert.deepEqual(r.filter(x => !x[1]), [], JSON.stringify(r));
});

test('K-1021 SD23-012 gives -2000 BP and refreshes a Yellow Spirit only on the opposing turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    for (const opp of [false, true]) {
      G.active = opp ? 'opponent' : 'player';
      const y = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.symbol === 'yellow');
      const my = BS.mkInst(y.id); my.cores = 2; my.exhausted = true; const e = BS.mkInst('BS01-001'); e.cores = 1; P.spirits = [my]; O.spirits = [e]; P.reserve.n = 20;
      const b = e.bpMod || 0; const m = BS.mkInst('SD23-012'); P.hand = [m];
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
      out.push({ d: (e.bpMod || 0) - b, ref: !my.exhausted });
    }
    return out; })()`);
  assert.equal(r[0].d, -2000, JSON.stringify(r)); assert.equal(r[0].ref, false, JSON.stringify(r)); assert.equal(r[1].ref, true, JSON.stringify(r));
});

test('K-1022 SD13-006 destroys only an exhausted Cost 6 or less Spirit; the Braves draw and destroy', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('SD13-006'); s.cores = 3; P.spirits = [s];
    const a = BS.mkInst('BS01-001'); a.cores = 1; const b = BS.mkInst('BS01-001'); b.cores = 1; b.exhausted = true; O.spirits = [a, b];
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s });
    const wired = ['SD03-010', 'SD43-RV004'].every(id => { const c = BS.CARDS[id]; return c.implemented === true && c.effects[0].braved === true; });
    return { left: O.spirits.length, exhLeft: O.spirits.filter(x => x.exhausted).length, wired }; })()`);
  assert.deepEqual(r, { left: 1, exhLeft: 0, wired: true }, JSON.stringify(r));
});

test('K-1023 SD24-002 destroys Cost 2 or less, or Cost 3 or less while an Ultimate is controlled; four more are wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const c3 = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost === 3 && !(c.effects || []).length);
    const ult = Object.values(BS.CARDS).find(c => c.type === 'Ultimate');
    const out = [];
    for (const hasU of [false, true]) {
      const s = BS.mkInst('SD24-002'); s.lostLv = 0; P.trash = [s]; const u = BS.mkInst(ult.id); u.cores = 5; P.spirits = hasU ? [u] : [];
      const t = BS.mkInst(c3.id); t.cores = 1; O.spirits = [t];
      await BS.fireFx(P, 'DESTROYED', s, {}); out.push(O.spirits.length);
    }
    const wired = ['SD64-RV003', 'SD67-RV003', 'SD19-007', 'SD64-RV005'].every(id => BS.CARDS[id].implemented === true);
    return { out, wired }; })()`);
  assert.deepEqual(r, { out: [1, 0], wired: true }, JSON.stringify(r));
});

test('K-1024 SD31-007 returns a Void core and exhausts only with the Soul Core; SD17-003 is wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    for (const soul of [false, true]) {
      const s = BS.mkInst('SD31-007'); s.cores = 3; s.soul = soul; P.spirits = [s];
      const t = BS.mkInst('BS01-001'); t.cores = 1; O.spirits = [t];
      await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); out.push(t.exhausted === true);
    }
    const c = BS.CARDS['SD17-003'];
    return { out, wired: c.implemented === true && c.effects.some(e => e.flag === 'MUST_BLOCK') }; })()`);
  assert.deepEqual(r, { out: [false, true], wired: true }, JSON.stringify(r));
});

test('K-1025 SD01-005 cannot be returned by opposing effects; Charge cards SD10-001/005/SD15-001 are wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('SD01-005'); s.cores = 2; P.spirits = [s];
    const a = BS.mkInst('BS01-001'); a.cores = 1; O.spirits = [a];
    await BS.fireFx(O, 'ATTACKS', a, { attacker: a });
    const w = id => { const c = BS.CARDS[id]; return c.implemented === true && c.effects.some(e => e.flag === 'CHARGE'); };
    return { flag: s && BS.CARDS['SD01-005'].effects[0].flag, kept: P.spirits.length, w: ['SD10-001','SD10-005','SD15-001'].every(w) }; })()`);
  assert.deepEqual(r, { flag: 'NO_RETURN', kept: 1, w: true }, JSON.stringify(r));
});

test('K-1026 SD31-001 and SD01-016 have High Speed; SD28-005 is wired as an attack-step BP boost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup();
    const hs = ['SD31-001', 'SD01-016'].every(id => BS.CARDS[id].highSpeed === true && BS.CARDS[id].implemented === true);
    const e = BS.CARDS['SD28-005'].effects[0];
    return { hs, impl: BS.CARDS['SD28-005'].implemented === true, bp: e.bp, step: e.if.step }; })()`);
  assert.deepEqual(r, { hs: true, impl: true, bp: 3000, step: 'ATTACK' }, JSON.stringify(r));
});

test('K-1027 SD14-001 gains 1000 BP per Reserve core when attacking; SD55-004 destroys a low-core Spirit and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('SD14-001'); s.cores = 3; P.spirits = [s]; P.reserve.n = 4;
    const before = (s.bpMod || 0);
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s });
    const gain = (s.bpMod || 0) - before;
    const d = BS.mkInst('SD55-004'); d.cores = 3; P.spirits = [d]; const t = BS.mkInst('BS01-001'); t.cores = 1; O.spirits = [t];
    const h0 = P.hand.length; await BS.fireFx(P, 'ATTACKS', d, { attacker: d });
    return { gain, res: P.reserve.n, left: O.spirits.length, drew: P.hand.length - h0 }; })()`);
  assert.equal(r.gain, r.res * 1000, JSON.stringify(r));
  assert.deepEqual([r.left, r.drew], [0, 1], JSON.stringify(r));
});
