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
