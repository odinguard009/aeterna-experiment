// Lane K cards, batch 95.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1150 BS19-107 refreshes a Spirit, or (nothing to refresh) gives all your Spirits +3000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const a = BS.mkInst('BS01-001'); a.cores = 1; a.exhausted = true; P.spirits = [a]; P.reserve.n = 20;
    const m = BS.mkInst('BS19-107'); P.hand = [m]; const b0 = BS.bpOf(a);
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    const first = { ex: !!a.exhausted, d: BS.bpOf(a) - b0 };
    const m2 = BS.mkInst('BS19-107'); P.hand = [m2]; const b1 = BS.bpOf(a);
    await BS.castMagic(P, { inst: m2, target: null, plan: null, ctx: 'flash' });
    return { first, second: BS.bpOf(a) - b1, ok: BS.CARDS['BS19-107'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.first, { ex: false, d: 0 }, JSON.stringify(r));
  assert.equal(r.second, 3000, JSON.stringify(r));
});

test('K-1151 SD20-015 returns every opposing Cost 3 or less Spirit, or one non-braved Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; };
    const cheap = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 3).slice(0, 2).map(c => c.id);
    O.spirits = [mk(cheap[0]), mk(cheap[1])]; P.reserve.n = 20; const m = BS.mkInst('SD20-015'); P.hand = [m]; const h0 = O.hand.length;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { left: O.spirits.length, hand: O.hand.length - h0, ok: BS.CARDS['SD20-015'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.left, r.hand], [0, 2], JSON.stringify(r));
});

// run a Magic's action list with the Soul Core paid or not
const runMagic = (id, soul, setup, read) => `(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
  const m = BS.mkInst('${id}'); m.soulPaid = ${soul}; const mk = (id, cores = 2) => { const s = BS.mkInst(id); s.cores = cores; return s; }; ${setup}
  await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['${id}'].magic.actions });
  return { ok: BS.CARDS['${id}'].fxComplete !== false, ...(${read}) }; })()`;
const cheap = `Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 3 && c.cost >= 1).map(c => c.id)`;

test('K-1152 BS31-102 sends one core from an opposing Spirit to the Reserve, one more with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, n] of [[false, 1], [true, 2]]) {
    const r = await page.evaluate(runMagic('BS31-102', soul, `const L = ${cheap}; O.spirits = [mk(L[0], 3), mk(L[1], 3)]; const c0 = O.spirits.reduce((a, s) => a + s.cores, 0);`, `{ lost: c0 - O.spirits.reduce((a, s) => a + s.cores, 0) }`));
    assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.lost, n, JSON.stringify(r));
  }
});

test('K-1153 BS34-077 exhaust an opposing Spirit to refresh a Ninja Gale Spirit; Soul Core puts a Void core in the Reserve', async () => {
  const { page } = await sharedBoard();
  const ng = `Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Ninja Gale')).id`;
  for (const soul of [false, true]) {
    const r = await page.evaluate(runMagic('BS34-077', soul, `const a = mk(${ng}); a.exhausted = true; P.spirits = [a]; O.spirits = [mk(${cheap}[0])]; P.void = P.void || { n: 0 }; const v0 = P.reserve.n;`, `{ opEx: !!O.spirits[0].exhausted, refreshed: !a.exhausted, v: P.reserve.n - v0 }`));
    assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.opEx, true, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r));
  }
});

test('K-1154 BS35-092 exhausts one Spirit or three Cost 4 or less; with the Soul Core both', async () => {
  const { page } = await sharedBoard();
  for (const [soul, n] of [[false, 1], [true, 4]]) {
    const r = await page.evaluate(runMagic('BS35-092', soul, `const L = ${cheap}; O.spirits = [mk(L[0]), mk(L[1]), mk(L[2]), mk(L[3]), mk(L[4])];`, `{ ex: O.spirits.filter(s => s.exhausted).length }`));
    assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.ex, n, JSON.stringify(r));
  }
});

test('K-1155 SD37-013 / BS40-080 / BS31-098 destroy a braved Brave, then the follow-up destroy', async () => {
  const { page } = await sharedBoard();
  const brv = `Object.values(BS.CARDS).find(c => c.type === 'Brave').id`;
  const setup = `const L = ${cheap}; const a = mk(L[0]); a.brave = BS.mkInst(${brv}); O.spirits = [a, mk(L[1]), mk(L[2])];`;
  for (const [id, soul, left] of [['SD37-013', false, 2], ['BS31-098', false, 3], ['BS31-098', true, 2], ['BS40-080', false, null]]) {
    const r = await page.evaluate(runMagic(id, soul, setup, `{ left: O.spirits.length, brave: O.spirits.filter(s => s.brave).length }`));
    assert.equal(r.ok, true, JSON.stringify(r)); if (left == null) assert.ok(r.left < 3 && r.brave === 0, id + ' ' + JSON.stringify(r)); else assert.equal(r.left, left, id + ' ' + JSON.stringify(r));
  }
});

test('K-1156 BS11-081 draws a card and gives Brilliance/Holy Life Spirits +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const kw = k => Object.values(BS.CARDS).find(c => c.type === 'Spirit' && BS.cardHasKeyword(c, k)).id;
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; };
    const a = mk(kw('Brilliance')), b = mk(kw('Holy Life')), z = mk('BS01-001'); P.spirits = [a, b, z]; const m = BS.mkInst('BS11-081'); const h0 = P.hand.length, base = [a, b, z].map(s => BS.bpOf(s));
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS11-081'].magic.actions });
    return { d: P.hand.length - h0, bp: [a, b, z].map((s, i) => BS.bpOf(s) - base[i]), ok: BS.CARDS['BS11-081'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.d, 1, JSON.stringify(r)); assert.deepEqual(r.bp, [1000, 1000, 0], JSON.stringify(r));
});

test('K-1157 BS08-075 gives Dark/Black-named Spirits +2000 BP per exhausted Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const dk = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && /^(Dark|Black)/.test(c.name)).id;
    const mk = (id, ex) => { const s = BS.mkInst(id); s.cores = 1; s.exhausted = ex; return s; };
    const a = mk(dk, true), b = mk('BS01-001', true), c = mk('BS01-001', false); P.spirits = [a, b, c]; const m = BS.mkInst('BS08-075'); const base = [a, c].map(s => BS.bpOf(s));
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS08-075'].magic.actions });
    return { bp: [a, c].map((s, i) => BS.bpOf(s) - base[i]), ok: BS.CARDS['BS08-075'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.bp, [4000, 0], JSON.stringify(r));
});

test('K-1158 BS01-142 / BS09-076 / BS06-103 refresh all exhausted Spirits; the non-exempt ones cannot attack this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.turnNo = 5;
    const find = f => Object.values(BS.CARDS).find(c => c.type === 'Spirit' && f(c)).id;
    const tri = find(c => BS.cardHasKeyword(c, 'Tribute')), mw = find(c => (c.families || []).includes('Mounted Warrior')), pl = find(c => !BS.cardHasKeyword(c, 'Tribute') && !(c.families || []).includes('Mounted Warrior'));
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; s.exhausted = true; return s; }; const out = {};
    for (const [id, ex] of [['BS01-142', null], ['BS09-076', tri], ['BS06-103', mw]]) {
      const a = mk(pl), b = mk(ex || pl); P.spirits = [a, b]; const m = BS.mkInst(id);
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.actions });
      out[id] = { refreshed: [a, b].map(s => !s.exhausted), noAtk: [a, b].map(s => s.noAtkTurn === G.turnNo), ok: BS.CARDS[id].fxComplete !== false }; }
    return out; })()`);
  for (const id of ['BS01-142', 'BS09-076', 'BS06-103']) assert.equal(r[id].ok, true, JSON.stringify(r));
  assert.deepEqual(r['BS01-142'].noAtk, [true, true], JSON.stringify(r));
  for (const id of ['BS09-076', 'BS06-103']) { assert.deepEqual(r[id].refreshed, [true, true], JSON.stringify(r)); assert.deepEqual(r[id].noAtk, [true, false], id + JSON.stringify(r)); }
});

test('K-1159 BS06-112 treats only your Fighting Spirit family Spirits as their highest LV', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const fs = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels.length > 1 && (c.families || []).includes('Fighting Spirit')).id;
    const ot = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels.length > 1 && !(c.families || []).includes('Fighting Spirit')).id;
    const a = BS.mkInst(fs), b = BS.mkInst(ot); a.cores = b.cores = 1; P.spirits = [a, b]; const m = BS.mkInst('BS06-112');
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS06-112'].magic.actions });
    return { a: !!a.lvHighTurn, b: !!b.lvHighTurn, ok: BS.CARDS['BS06-112'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual([r.a, r.b], [true, false], JSON.stringify(r));
});

test('K-1160 BS31-112 draws three and discards two, or one with a WisdomKing/Douji Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const wk = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && /WisdomKing/.test(c.name)).id; const out = [];
    for (const sp of [[], [wk]]) { P.spirits = sp.map(id => { const s = BS.mkInst(id); s.cores = 1; return s; }); const h0 = P.hand.length; const m = BS.mkInst('BS31-112');
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS31-112'].magic.by.MAIN.actions }); out.push(P.hand.length - h0); }
    return { out, ok: BS.CARDS['BS31-112'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.out, [1, 2], JSON.stringify(r));
});
