// Lane K cards, batch 94 (selfSoul conditions: "If (Soul Core) is on this Spirit").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

// runs the first effect of `id` with the given trigger; soul = whether the source holds the Soul Core
const run = (id, trig, soul, setup, read) => `(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.step = 4; G.active = P.key;
  const m = BS.mkInst('${id}'); m.soul = ${soul}; ${setup}
  const fx = BS.CARDS['${id}'].effects.find(e => e.trigger === '${trig}');
  await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: fx.actions });
  return { impl: BS.CARDS['${id}'].implemented === true, ...(${read}) }; })()`;
const foe = (bp, id = 'BS01-001') => `{ const s = BS.mkInst('${id}'); s.cores = 1; O.spirits.push(s); }`;

test('K-1125 SD33-002 draws only with the Soul Core on it', async () => {
  const { page } = await sharedBoard();
  for (const [soul, d] of [[true, 1], [false, 0]]) {
    const r = await page.evaluate(run('SD33-002', 'ATTACKS', soul, `const h0 = P.hand.length;`, `{ d: P.hand.length - h0 }`));
    assert.equal(r.impl, true, JSON.stringify(r)); assert.equal(r.d, d, JSON.stringify(r));
  }
});

test('K-1126 SD33-003 destroys a 3000 BP Spirit, or draws instead with the Soul Core', async () => {
  const { page } = await sharedBoard();
  let r = await page.evaluate(run('SD33-003', 'ATTACKS', false, `${foe(0)} const h0 = P.hand.length;`, `{ sp: O.spirits.length, d: P.hand.length - h0 }`));
  assert.deepEqual([r.impl, r.sp, r.d], [true, 0, 0], JSON.stringify(r));
  r = await page.evaluate(run('SD33-003', 'ATTACKS', true, `${foe(0)} const h0 = P.hand.length;`, `{ sp: O.spirits.length, d: P.hand.length - h0 }`));
  assert.deepEqual([r.sp, r.d], [1, 1], JSON.stringify(r));
});

test('K-1127 SD29-009 destroys a Nexus, plus a Spirit only with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, sp] of [[false, 1], [true, 0]]) {
    const r = await page.evaluate(run('SD29-009', 'ATTACKS', soul, `${foe(0)} O.nexus = [BS.mkInst('BS01-100')];`, `{ nx: O.nexus.length, sp: O.spirits.length }`));
    assert.deepEqual([r.impl, r.nx, r.sp], [true, 0, sp], JSON.stringify(r));
  }
});

test('K-1128 SD31-002 exhausts one opposing Spirit, two with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, n] of [[false, 1], [true, 2]]) {
    const r = await page.evaluate(run('SD31-002', 'DESTROYED', soul, `${foe(0)} ${foe(0)}`, `{ ex: O.spirits.filter(s => s.exhausted).length }`));
    assert.deepEqual([r.impl, r.ex], [true, n], JSON.stringify(r));
  }
});

test('K-1129 BS31-006 destroys a Spirit, a Nexus too with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, nx] of [[false, 1], [true, 0]]) {
    const r = await page.evaluate(run('BS31-006', 'ATTACKS', soul, `${foe(0)} O.nexus = [BS.mkInst('BS01-100')];`, `{ nx: O.nexus.length, sp: O.spirits.length }`));
    assert.deepEqual([r.impl, r.sp, r.nx], [true, 0, nx], JSON.stringify(r));
  }
});

test('K-1130 BS31-002 destroys a 6000 BP or less Spirit only with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, sp] of [[false, 1], [true, 0]]) {
    const r = await page.evaluate(run('BS31-002', 'DESTROYED', soul, foe(0), `{ sp: O.spirits.length }`));
    assert.deepEqual([r.impl, r.sp], [true, sp], JSON.stringify(r));
  }
});
