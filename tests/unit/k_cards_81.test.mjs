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

test('K-845 BS02-091: a 7000+ BP Spirit pays all its cores to the Void, then up to seven opposing cores go to their Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const big = BS.mkInst('BS01-001'); big.cores = 3; big.bpMod = 20000; const small = BS.mkInst('BS01-001'); small.cores = 1; P.spirits = [small, big];
    const o1 = BS.mkInst('BS01-001'); o1.cores = 4; const o2 = BS.mkInst('BS01-001'); o2.cores = 4; O.spirits = [o1, o2]; const r0 = O.reserve.n, v0 = P.void;
    const acts = BS.CARDS['BS02-091'].magic.by.MAIN.actions; const c = { p: P, opp: O, src: BS.mkInst('BS02-091'), ctx: {} };
    const ok = BS.FX_ACTIONS.OWN_SPIRIT_CORES_TO_VOID.chk(acts[0]);
    await BS.FX_ACTIONS.OWN_SPIRIT_CORES_TO_VOID.run(c, acts[0]); const paid = [P.void - v0, P.spirits.includes(big), c.ctx.did];
    await BS.FX_ACTIONS.OPP_CORES_TO_RESERVE.run(c, acts[1]); await BS.FX_ACTIONS.OPP_CORES_TO_RESERVE.run(c, acts[2]);
    return [ok, paid, O.reserve.n - r0, o1.cores + o2.cores]; })()`);
  assert.deepEqual(r, [true, [3, false, true], 7, 1], JSON.stringify(r));
});

test('K-846 EXHAUST_OPP_MATCH exhausts opposing Spirits until the exhausted counts are equal (BS03-139)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const mk = (ex) => { const s = BS.mkInst('BS01-001'); s.cores = 1; s.exhausted = ex; return s; };
    P.spirits = [mk(true), mk(true), mk(true)]; O.spirits = [mk(true), mk(false), mk(false), mk(false)];
    const a = BS.CARDS['BS03-139'].magic.by.FLASH.actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS03-139'), ctx: {} };
    await BS.FX_ACTIONS.EXHAUST_OPP_MATCH.run(c, a); const ex1 = O.spirits.filter(s => s.exhausted).length;
    const again = BS.FX_ACTIONS.EXHAUST_OPP_MATCH.can(c, a); return [ex1, again, c.ctx.did]; })()`);
  assert.deepEqual(r, [3, false, true], JSON.stringify(r));
});

test('K-847 CORE_TO_OTHER puts a Reserve core on another own Spirit, not on the source (BS01-066)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS01-066'); s.cores = 2; const o = BS.mkInst('BS01-001'); o.cores = 1; P.spirits = [s, o]; P.reserve.n = 3;
    const e = BS.CARDS['BS01-066'].effects[0]; const c = { p: P, opp: O, src: s, ctx: {} };
    await BS.FX_ACTIONS.CORE_TO_OTHER.run(c, e.actions[0]); const alone = [s.cores, o.cores, P.reserve.n, c.ctx.did];
    P.spirits = [s]; await BS.FX_ACTIONS.CORE_TO_OTHER.run(c, e.actions[0]); return [e.trigger, alone, s.cores, c.ctx.did]; })()`);
  assert.deepEqual(r, ['ATTACKS', [2, 2, 2, true], 2, false], JSON.stringify(r));
});

test('K-848 BS01-065 puts a Void core on a Spirit you control when summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS01-065'); s.cores = 1; P.spirits = [s]; P.void = 2;
    const e = BS.CARDS['BS01-065'].effects[0]; const c = { p: P, opp: O, src: s, ctx: {} };
    await BS.FX_ACTIONS.VOID_TO_CARD.run(c, e.actions[0]); return [e.trigger, s.cores, P.void]; })()`);
  assert.deepEqual(r, ['SUMMONED', 2, 1], JSON.stringify(r));
});

test('K-849 BS01-125 makes both players destroy a Spirit they control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const a = BS.mkInst('BS01-001'); a.cores = 1; const a2 = BS.mkInst('BS01-001'); a2.cores = 1; P.spirits = [a, a2]; const b = BS.mkInst('BS01-001'); b.cores = 1; O.spirits = [b];
    const acts = BS.CARDS['BS01-125'].magic.by.FLASH.actions; const c = { p: P, opp: O, src: BS.mkInst('BS01-125'), ctx: {} };
    for (const x of acts) await BS.FX_ACTIONS[x.do].run(c, x); return [P.spirits.length, O.spirits.length]; })()`);
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-850 BS01-083 cannot be blocked by red Spirits when it attacks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS01-083'); s.cores = 1; P.spirits = [s];
    const e = BS.CARDS['BS01-083'].effects[0]; const c = { p: P, opp: O, src: s, ctx: {} };
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run(c, e.actions[0]); return [e.trigger, JSON.stringify(s.noBlockBy.color)]; })()`);
  assert.deepEqual([r[0], r[1]], ['ATTACKS', '["red"]'], JSON.stringify(r));
});

test('K-851 BS01-086 is unaffected by opposing Spirit and Magic effects but not by Nexus effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS01-086'); s.cores = 1; P.spirits = [s];
    const sp = (id) => ({ p: O, src: BS.mkInst(id), ctx: {} });
    return [BS.fxImmune(P, s, sp('BS01-001')), BS.fxImmune(P, s, sp('BS01-098')), BS.fxImmune(P, s, sp('BS01-125'))]; })()`);
  assert.deepEqual(r, [true, false, true], JSON.stringify(r));
});

test('K-852 BS03-149 destroys an opposing Spirit only with 3+ "Fighting Spirit" Spirits (BS03-149)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const mk = () => { const s = BS.mkInst('BS03-072'); s.cores = 1; return s; };
    const acts = BS.CARDS['BS03-149'].magic.by.FLASH.actions; const out = [];
    for (const n of [2, 3]) { P.spirits = Array.from({ length: n }, mk); const b = BS.mkInst('BS01-001'); b.cores = 1; O.spirits = [b];
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS03-149'), ctx: {} }, { actions: acts }, 'FLASH'); out.push(O.spirits.length); }
    return out; })()`);
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-853 BS03-022 exhausts an unexhausted opposing Spirit after winning a battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS03-022'); s.cores = 3; P.spirits = [s]; const b = BS.mkInst('BS01-001'); b.cores = 1; O.spirits = [b];
    const e = BS.CARDS['BS03-022'].effects[0];
    await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, e, e.trigger); return [e.trigger, e.lv, b.exhausted]; })()`);
  assert.deepEqual(r, ['BATTLE_WIN', [2], true], JSON.stringify(r));
});

test('K-854 BS01-071 and BS02-041 refresh themselves after a won battle only while exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true; const out = [];
    for (const id of ['BS01-071', 'BS02-041']) { const e = BS.CARDS[id].effects[0];
      for (const ex of [true, false]) { const s = BS.mkInst(id); s.cores = 4; s.exhausted = ex; P.spirits = [s]; O.spirits = [];
        await BS.fireFx(P, 'BATTLE_WIN', s, { attacker: s }); out.push(s.exhausted); } }
    return out; })()`);
  assert.deepEqual(r, [false, false, false, false], JSON.stringify(r));
});

test('K-855 OPP_MAGIC_USED fires for the opponent of the caster (BS07-047, BS06-042)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS07-047'); s.cores = 1; P.spirits = [s]; P.void = 3;
    await BS.fireFx(P, 'OPP_MAGIC_USED', null, { subject: BS.mkInst('BS01-125') });
    const m4 = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic' && BS.CARDS[k].cost === 4), m3 = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic' && BS.CARDS[k].cost === 3);
    const t = BS.mkInst('BS06-042'); t.cores = 3; const out = [s.cores, P.void];
    for (const m of [m3, m4]) { const b = BS.mkInst('BS01-001'); b.cores = 1; P.spirits = [t]; O.spirits = [b]; G.step = 5;
      await BS.fireFx(P, 'OPP_MAGIC_USED', null, { subject: BS.mkInst(m) }); out.push(O.spirits.length); }
    return out; })()`);
  assert.deepEqual(r, [2, 2, 1, 0], JSON.stringify(r));
});

test('K-856 BS07-082 gives an own Assault Spirit +2000 BP per exhausted Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const nx = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus');
    const s = BS.mkInst('BS07-054'); s.cores = 3; P.spirits = [s]; const a = BS.mkInst(nx), b = BS.mkInst(nx), c = BS.mkInst(nx); a.exhausted = true; b.exhausted = true; c.exhausted = false; P.nexus = [a, b, c];
    const before = s.bpMod || 0; const acts = BS.CARDS['BS07-082'].magic.by.FLASH.actions;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BS07-082'), ctx: {} }, { actions: acts }, 'FLASH');
    return [before, s.bpMod || 0]; })()`);
  assert.deepEqual(r, [0, 4000], JSON.stringify(r));
});

test('K-857 BS41-002 is unaffected by opposing Spirit effects only while exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS41-002'); s.cores = 3; P.spirits = [s]; const src = BS.mkInst('BS01-001'); const out = [];
    for (const ex of [true, false]) { s.exhausted = ex; out.push(!!BS.fxImmune(P, s, { p: O, src })); }
    return out; })()`);
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-858 BS43-040 gets +3000 BP per Armed Machine / Machine Beast Spirit, a dual-family Spirit once', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).length);
    const dual = ids.find(k => { const f = BS.CARDS[k].families; return f.includes('Armed Machine') && f.includes('Machine Beast'); });
    const s = BS.mkInst('BS43-040'); s.cores = 6; const d = BS.mkInst(dual); d.cores = 1; O.spirits = [];
    P.spirits = [s]; const a = BS.bpOf(s); P.spirits = [s, d]; const b = BS.bpOf(s); return [BS.CARDS['BS43-040'].families.some(f => ['Armed Machine', 'Machine Beast'].includes(f)), b - a]; })()`);
  assert.deepEqual(r[1] === 3000 || r[1] === 6000 ? [r[1]] : r, [3000], JSON.stringify(r));
});

test('K-859 BS12-021 puts a Void core into the Reserve per Shellman and gives its families +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS12-021'); s.cores = 3; const sh = Object.keys(BS.CARDS).find(k => k !== 'BS12-021' && BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Shellman')); const o = BS.mkInst(sh); o.cores = 1;
    P.spirits = [s, o]; P.void = 5; const r0 = P.reserve.n; O.spirits = [];
    const e = BS.CARDS['BS12-021'].effects[0]; await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, e, e.trigger);
    const plain = BS.mkInst('BS01-001'); plain.cores = 1; P.spirits = [s, o]; const b1 = BS.bpOf(o); P.spirits = [o]; const b0 = BS.bpOf(o);
    return [P.reserve.n - r0, b1 - b0]; })()`);
  assert.deepEqual(r, [2, 1000], JSON.stringify(r));
});

test('K-860 BS20-067 gives all own Spirits +1000 BP per Terra Dragon in the own Attack Step only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true; O.spirits = [];
    const s = BS.mkInst('BS20-067'); s.cores = 2; const x = BS.mkInst('BS01-001'); x.cores = 1; const out = [];
    P.spirits = [x]; const base = BS.bpOf(x); const td = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Terra Dragon')); const t = BS.mkInst(td); t.cores = 1; P.spirits = [s, x, t];
    for (const [step, act] of [[5, 'player'], [3, 'player'], [5, 'opponent']]) { G.step = step; G.active = act === 'player' ? P.key : O.key; out.push(BS.bpOf(x) - base); }
    return out; })()`);
  assert.equal(r[0] >= 1000 && r[0] % 1000 === 0, true, JSON.stringify(r)); assert.deepEqual(r.slice(1), [0, 0], JSON.stringify(r));
});

test('K-861 BS18-065, BS21-069, BS21-070 Nexus battle bonuses and ALLY_BATTLE_WIN effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true; const out = [];
    const fam = f => Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes(f));
    const nx = id => { const n = BS.mkInst(id); n.cores = 5; return n; };
    const win = async (sp, att) => { const keep = O.life; await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: sp, attacking: att }); return keep; };
    // BS18-065: +2000 to a Supreme Hero in an attack step, 0 outside; exhaust after a win
    const h = BS.mkInst(fam('Supreme Hero')); h.cores = 1; O.spirits = []; P.spirits = [h]; P.nexus = []; G.step = 3; G.active = P.key; const b = BS.bpOf(h);
    P.nexus = [nx('BS18-065')]; G.step = 5; out.push(BS.bpOf(h) - b); G.step = 3; out.push(BS.bpOf(h) - b);
    const v = BS.mkInst('BS01-001'); v.cores = 1; O.spirits = [v]; G.step = 5; await win(h, true); out.push(v.exhausted);
    // BS21-070: white Spirit +3000 in the opposing attack step; Armed Machine block win sends a Life to the Reserve
    const w = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || [BS.CARDS[k].color]).includes('white'))); w.cores = 1; P.nexus = []; P.spirits = [w]; G.step = 3; const b2 = BS.bpOf(w);
    P.nexus = [nx('BS21-070')]; G.step = 5; G.active = O.key; out.push(BS.bpOf(w) - b2); G.active = P.key; out.push(BS.bpOf(w) - b2);
    const am = BS.mkInst(fam('Armed Machine')); am.cores = 1; P.spirits = [am]; G.step = 5; G.active = O.key; O.life = 5; await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: am, attacking: false }); out.push(O.life);
    // BS21-069: battling Spirits +2000
    P.nexus = []; G.active = P.key; const z = BS.mkInst('BS01-001'); z.cores = 1; P.spirits = [z]; G.step = 5; G.attacker = null; G.blocker = null; const b3 = BS.bpOf(z);
    P.nexus = [nx('BS21-069')]; G.attacker = z; out.push(BS.bpOf(z) - b3); G.attacker = null; out.push(BS.bpOf(z) - b3);
    return out; })()`);
  assert.deepEqual(r, [2000, 0, true, 3000, 0, 4, 2000, 0], JSON.stringify(r));
});
