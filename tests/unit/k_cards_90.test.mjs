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
