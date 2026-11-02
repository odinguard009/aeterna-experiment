// Lane K cards, batch 93 (Burst halves of Magic cards authored into card.burst).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

const run = (id, setup, read) => `(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.step = 4; G.active = P.key;
  const m = BS.mkInst('${id}'); const b = BS.CARDS['${id}'].burst; ${setup}
  await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: b.actions });
  return { ok: BS.CARDS['${id}'].implemented === true && b.thenFlash === true, ...(${read}) }; })()`;

test('K-1107 BS24-101 Burst: all but one core leave an opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(run('BS24-101', `const s = BS.mkInst('BS01-001'); s.cores = 4; O.spirits.push(s); const r0 = O.reserve.n;`, `{ cores: O.spirits[0].cores, res: O.reserve.n - r0 }`));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.cores, 1, JSON.stringify(r)); assert.equal(r.res, 3, JSON.stringify(r));
});

test('K-1108 BS14-094 Burst: two opposing Nexuses are destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(run('BS14-094', `O.nexus = [BS.mkInst('BS01-100'), BS.mkInst('BS01-100'), BS.mkInst('BS01-100')];`, `{ n: O.nexus.length }`));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.n, 1, JSON.stringify(r));
});

test('K-1109 BS16-078 Burst: only with Life 2 or less, summon a Green Spirit from the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { const b = BS.CARDS['BS16-078'].burst; return { lifeLe: b.if && b.if.lifeLe, then: b.thenFlash === true, impl: BS.CARDS['BS16-078'].implemented === true, a: b.actions[0].do }; })()`);
  assert.deepEqual(r, { lifeLe: 2, then: true, impl: true, a: 'SUMMON_HAND' });
});

test('K-1110 BS25-079 Burst: all your White Spirits refresh, others stay exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(run('BS25-079', `const w = BS.mkInst('BS01-074'); const o = BS.mkInst('BS01-001'); w.cores = o.cores = 1; w.exhausted = o.exhausted = true; P.spirits.push(w, o); globalThis.__w = [w, o];`, `{ ex: __w.map(x => x.exhausted) }`));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.ex, [false, true], JSON.stringify(r));
});

test('K-1111 BS34-072 Burst: destroys an opposing 5000 BP or less Spirit and an opposing Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(run('BS34-072', `const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits.push(s); O.nexus = [BS.mkInst('BS01-100')];`, `{ sp: O.spirits.length, nx: O.nexus.length, main: b.thenMain === true }`));
  assert.equal(r.sp, 0, JSON.stringify(r)); assert.equal(r.nx, 0, JSON.stringify(r)); assert.equal(r.main, true);
});

test('K-1112 SD01-039 / BS60-CP03 Flash: Life can only be reduced by one per attack this turn (LIFE_CAP_ALL)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const m = BS.mkInst('SD01-039'); const a = BS.CARDS['SD01-039'].magic.actions, b = BS.CARDS['BS60-CP03'].magic.actions;
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: a });
    return { cap: P.lifeCapAll === G.turnNo, same: JSON.stringify(a) === JSON.stringify(b), impl: BS.CARDS['SD01-039'].implemented === true && BS.CARDS['BS60-CP03'].implemented === true }; })()`);
  assert.deepEqual(r, { cap: true, same: true, impl: true });
});

test('K-1113 BS12-038 / BS53-RV005 (When Summoned): one opposing Spirit per matching Spirit can\'t block this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const a = BS.mkInst('BS12-038'), b = BS.mkInst('BS12-038'); a.cores = b.cores = 1; P.spirits.push(a, b);
    for (let i = 0; i < 3; i++) { const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits.push(s); }
    const fx = BS.CARDS['BS12-038'].effects.find(e => e.trigger === 'SUMMONED');
    await BS.runActions({ p: P, opp: O, src: a, ctx: { selfInst: a } }, { actions: fx.actions });
    return { two: O.spirits.filter(s => s.noAB).length, impl: BS.CARDS['BS12-038'].implemented === true && BS.CARDS['BS53-RV005'].implemented === true }; })()`);
  assert.deepEqual(r, { two: 2, impl: true });
});

test('K-1114 BS24-025 (When Summoned): Rush Yellow gates the can\'t-block target', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const m = BS.mkInst('BS24-025'); m.cores = 1; P.spirits.push(m); const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits.push(s);
    const fx = BS.CARDS['BS24-025'].effects.find(e => e.trigger === 'SUMMONED');
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: fx.actions });
    return { noAB: !!s.noAB, impl: BS.CARDS['BS24-025'].implemented === true }; })()`);
  assert.equal(r.impl, true, JSON.stringify(r));
});

const runFx = (id, trig, setup, read) => `(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.step = 4; G.active = P.key;
  const m = BS.mkInst('${id}'); const e = BS.CARDS['${id}'].effects.find(x => x.trigger === '${trig}'); ${setup}
  await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: e.actions });
  return { impl: BS.CARDS['${id}'].implemented === true, ...(${read}) }; })()`;

test('K-1115 BS21-022 When Attacks: exhausts a non-braved opposing Spirit only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(runFx('BS21-022', 'ATTACKS', `const a = BS.mkInst('BS01-001'), b = BS.mkInst('BS01-001'); a.cores = b.cores = 1; a.brave = BS.mkInst('BS53-064'); O.spirits.push(a, b);`, `{ ex: O.spirits.map(s => !!s.exhausted) }`));
  assert.equal(r.impl, true, JSON.stringify(r)); assert.deepEqual(r.ex, [false, true], JSON.stringify(r));
});

test('K-1116 BS20-015 When Attacks: destroys only an exhausted braved opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(runFx('BS20-015', 'ATTACKS', `const a = BS.mkInst('BS01-001'), b = BS.mkInst('BS01-001'); a.cores = b.cores = 1; a.exhausted = b.exhausted = true; b.brave = BS.mkInst('BS53-064'); O.spirits.push(a, b);`, `{ n: O.spirits.length, brave: O.spirits.map(s => !!s.brave) }`));
  assert.equal(r.impl, true, JSON.stringify(r)); assert.equal(r.n, 1, JSON.stringify(r)); assert.deepEqual(r.brave, [false], JSON.stringify(r));
});
