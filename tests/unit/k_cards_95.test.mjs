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
