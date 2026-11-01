// Lane K tests, file 81. Schema v277: OWN_CORES_TO_TRASH, OPP_SELF_CORES_TO_TRASH. Cards: BS09-070, BS08-072.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-839 OWN_CORES_TO_TRASH then OPP_SELF_CORES_TO_TRASH move cores from Spirits to the Trash (BS09-070)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const a = BS.mkInst('BS01-001'); a.cores = 2; P.spirits = [a]; const b = BS.mkInst('BS01-001'); b.cores = 2; O.spirits = [b];
    const acts = BS.CARDS['BS09-070'].magic.by.FLASH.actions; const c = { p: P, opp: O, src: BS.mkInst('BS09-070'), ctx: {} };
    const t0 = P.trashCores.n, o0 = O.trashCores.n;
    await BS.FX_ACTIONS.OWN_CORES_TO_TRASH.run(c, acts[0]); c.ctx.prev = c.ctx.did !== false;
    await BS.FX_ACTIONS.OPP_SELF_CORES_TO_TRASH.run(c, acts[1]);
    return [a.cores, b.cores, P.trashCores.n - t0, O.trashCores.n - o0, BS.FX_ACTIONS.OWN_CORES_TO_TRASH.chk(acts[0])]; })()`);
  assert.deepEqual(r, [1, 1, 1, 1, true], JSON.stringify(r));
});

test('K-840 BS02-031 deploys a white or green Nexus from the Trash free, not a red one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const nx = Object.values(BS.CARDS).filter(c => c.type === 'Nexus'); const ok = nx.find(c => (c.colors || [c.symbol]).some(x => x === 'white' || x === 'green')); const bad = nx.find(c => !(c.colors || [c.symbol]).some(x => x === 'white' || x === 'green'));
    const e = BS.CARDS['BS02-031'].effects[0]; const c = { p: P, opp: O, src: BS.mkInst('BS02-031'), ctx: {} };
    const L1 = bad ? BS.FX_ACTIONS.DEPLOY_TRASH.cands((P.trash = [BS.mkInst(bad.id)], c), e.actions[0]).length : 0;
    P.trash = [BS.mkInst(ok.id)]; const L2 = BS.FX_ACTIONS.DEPLOY_TRASH.cands(c, e.actions[0]).length;
    return [e.optional, L1, L2]; })()`);
  assert.deepEqual(r, [true, 0, 1], JSON.stringify(r));
});

test('K-841 OWN_CORE_TO_VOID moves a Trash core to the Void first, then a Reserve core (BS01-007)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const a = BS.CARDS['BS01-007'].effects[0].actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS01-007'), ctx: {} };
    P.trashCores.n = 1; P.reserve.n = 3; const v0 = P.void;
    await BS.FX_ACTIONS.OWN_CORE_TO_VOID.run(c, a); const s1 = [P.trashCores.n, P.reserve.n, P.void - v0];
    await BS.FX_ACTIONS.OWN_CORE_TO_VOID.run(c, a); return [s1, P.trashCores.n, P.reserve.n, P.void - v0, BS.FX_ACTIONS.OWN_CORE_TO_VOID.chk(a)]; })()`);
  assert.deepEqual(r, [[0, 3, 1], 0, 2, 2, true], JSON.stringify(r));
});

test('K-842 BS02-035: destroying it with 3 cores gains 3 more Reserve cores from the Void', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS02-035'); s.cores = 3; P.spirits = [s]; const r0 = P.reserve.n;
    BS.removeSpirit(P, s, 'destroyed', true); const lost = s.lostCores; const r1 = P.reserve.n;
    const a = BS.CARDS['BS02-035'].effects[0].actions[0]; await BS.FX_ACTIONS.VOID_TO_RESERVE_LOST.run({ p: P, opp: O, src: s, ctx: {} }, a);
    return [lost, r1 - r0, P.reserve.n - r1]; })()`);
  assert.deepEqual(r, [3, 3, 3], JSON.stringify(r));
});

test('K-843 BS01-137 gives +1000 BP per exhausted opposing Spirit to a chosen Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const a = BS.mkInst('BS01-001'); a.cores = 1; P.spirits = [a]; const o1 = BS.mkInst('BS01-001'), o2 = BS.mkInst('BS01-001'), o3 = BS.mkInst('BS01-001'); [o1, o2, o3].forEach(x => x.cores = 1); o1.exhausted = o2.exhausted = true; O.spirits = [o1, o2, o3];
    const m = BS.CARDS['BS01-137'].magic; const b0 = BS.bpOf(a); const act = m.by.MAIN.actions[0];
    await BS.FX_ACTIONS.BP_PLUS.run({ p: P, opp: O, src: BS.mkInst('BS01-137'), ctx: {} }, act);
    return [JSON.stringify(m.timing), BS.bpOf(a) - b0]; })()`);
  assert.deepEqual(r, ['["MAIN","FLASH"]', 2000], JSON.stringify(r));
});

test('K-844 BOTH_DESTROY_NEXUS destroys one Nexus each, and nothing when the opponent has none (BS02-088)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const nx = Object.values(BS.CARDS).find(c => c.type === 'Nexus').id; const mk = () => { const n = BS.mkInst(nx); n.cores = 0; return n; };
    const a = BS.CARDS['BS02-088'].magic.by.MAIN.actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS02-088'), ctx: {} };
    P.nexus = [mk(), mk()]; O.nexus = []; await BS.FX_ACTIONS.BOTH_DESTROY_NEXUS.run(c, a); const none = [P.nexus.length, O.nexus.length, c.ctx.did];
    O.nexus = [mk()]; await BS.FX_ACTIONS.BOTH_DESTROY_NEXUS.run(c, a); return [none, P.nexus.length, O.nexus.length, c.ctx.did]; })()`);
  assert.deepEqual(r, [[2, 0, false], 1, 0, true], JSON.stringify(r));
});
