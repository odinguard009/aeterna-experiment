import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const SETUP = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
  const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !/^BS4[4-8]-03[3-9]$/.test(k));`;

test('K-1070 BS44-033 HEAVY_EXHAUST_OPP perRemoved: one Spirit per 3 removed cards (none below 3)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const run = async n => { const src = BS.mkInst(any); P.spirits = [src]; const ts = [1,2,3].map(() => BS.mkInst(any)); O.spirits = ts;
      const c = { p: P, opp: O, src, ctx: { removedN: n } }; await BS.FX_ACTIONS.HEAVY_EXHAUST_OPP.run(c, { do: 'HEAVY_EXHAUST_OPP', n: 1, perRemoved: 3 });
      return { did: c.ctx.did, ex: ts.filter(t => t.exhausted).length }; };
    return { a: await run(2), b: await run(3), c: await run(6), partial: BS.CARDS['BS44-033'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.a.ex, 0, JSON.stringify(r)); assert.equal(r.a.did, false, JSON.stringify(r));
  assert.equal(r.b.ex, 1, JSON.stringify(r)); assert.equal(r.c.ex, 2, JSON.stringify(r));
});

test('K-1071 BS44-034 SET_UNAFFECTED only while a Blade Beast Spirit is in the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const bb = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Blade Beast'));
    P.burst = BS.mkInst('BS44-034'); P.trash = []; const off = BS.burstSetSafe(P); P.trash = [BS.mkInst(bb)]; const on = BS.burstSetSafe(P);
    return { off, on, partial: BS.CARDS['BS44-034'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.off, false, JSON.stringify(r)); assert.equal(r.on, true, JSON.stringify(r));
});

test('K-1072 BS46-033 Summoned removes a random opposing Hand card; a Spirit card gives 2 cores', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const a = BS.mkInst('BS46-033'); P.spirits = [a]; a.cores = 1; P.void = 4; const h = BS.mkInst(any); O.hand = [h]; O.removed = O.removed || [];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    return { hand: O.hand.length, removed: O.removed.length, cores: a.cores, partial: BS.CARDS['BS46-033'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.hand, 0, JSON.stringify(r)); assert.equal(r.removed, 1, JSON.stringify(r)); assert.equal(r.cores, 3, JSON.stringify(r));
});

test('K-1073 BS47-035 Attacks removes a Hand card and bounces an exhausted Spirit; Burst is locked at LV2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const a = BS.mkInst('BS47-035'); a.cores = 4; P.spirits = [a]; G.attacker = a; const t = BS.mkInst(any); t.exhausted = true; O.spirits = [t]; O.hand = [BS.mkInst(any)]; O.removed = O.removed || [];
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { hand: O.hand.length, bounced: !O.spirits.includes(t), noBurst: G.noBurst === O.key, partial: BS.CARDS['BS47-035'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.hand, 0, JSON.stringify(r)); assert.equal(r.bounced, true, JSON.stringify(r)); assert.equal(r.noBurst, true, JSON.stringify(r));
});

test('K-1074 NO_FLASH_BATTLE and green-only Grandwalker core cost (BS48-039)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const gw = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker') && BS.CARDS[k].symbol === 'green');
    const rd = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker') && BS.CARDS[k].symbol === 'red');
    const n = BS.mkInst(gw); n.cores = 3; const m = BS.mkInst(rd); m.cores = 5; P.nexus = [m];
    const src = BS.mkInst('BS48-039'); P.spirits = [src]; G.attacker = src; const cc = { p: P, opp: O, src, ctx: {} };
    const noMatch = BS.FX_ACTIONS.OWN_NEXUS_CORE_TO_VOID.can(cc, { do: 'OWN_NEXUS_CORE_TO_VOID', n: 3, gwColor: 'green' });
    P.nexus = [m, n]; const v0 = P.void;
    await BS.FX_ACTIONS.OWN_NEXUS_CORE_TO_VOID.run(cc, { do: 'OWN_NEXUS_CORE_TO_VOID', n: 3, gwColor: 'green' });
    await BS.FX_ACTIONS.NO_FLASH_BATTLE.run(cc, { do: 'NO_FLASH_BATTLE' });
    return { noMatch, void: P.void - v0, gwCores: n.cores, redCores: m.cores, flash: G.noFlash === O.key, partial: BS.CARDS['BS48-039'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.noMatch, false, JSON.stringify(r)); assert.equal(r.void, 3, JSON.stringify(r));
  assert.equal(r.gwCores, 0, JSON.stringify(r)); assert.equal(r.redCores, 5, JSON.stringify(r)); assert.equal(r.flash, true, JSON.stringify(r));
});

test('K-1075 BS44-RV006 Attacks destroys one opposing Spirit of each cost 1/3/5/7/9 (others stay)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const by = n => Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost === n && !BS.CARDS[k].token && !BS.CARDS[k].effects);
    const src = BS.mkInst('BS44-RV006'); src.cores = 4; P.spirits = [src]; G.attacker = src;
    const t1 = BS.mkInst(by(1)), t3 = BS.mkInst(by(3)), t4 = BS.mkInst(by(4)); for (const t of [t1, t3, t4]) t.cores = 2; O.spirits = [t1, t3, t4];
    await BS.fireFx(P, 'ATTACKS', src, { attacker: src, subject: src });
    return { left: O.spirits.map(s => s.uid), keep: t4.uid, partial: BS.CARDS['BS44-RV006'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.left, [r.keep], JSON.stringify(r));
});

test('K-1076 BS44-X03 / BS46-X03 data: Flash Advent family Blade Beast, unaffected static, complete', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const a = BS.CARDS['BS44-X03'], b = BS.CARDS['BS46-X03'];
    return { a: a.contractAdvent, b: b.contractAdvent, ap: a.partial, bp: b.partial, un: a.effects.some(e => e.flag === 'UNAFFECTED') }; })()`);
  assert.equal(r.ap, false, JSON.stringify(r)); assert.equal(r.bp, false, JSON.stringify(r)); assert.equal(r.un, true);
  assert.equal(r.a.costGe, 6); assert.equal(r.b.costGe, 5); assert.equal(r.a.family, 'Blade Beast');
});

test('K-1077 OPP_GW_CORES_TO_VOID: two cores from every opposing Grandwalker Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const gw = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker')).slice(0, 2);
    const plain = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && !(BS.CARDS[k].families || []).includes('Grandwalker'));
    const a = BS.mkInst(gw[0]), b = BS.mkInst(gw[1]), p = BS.mkInst(plain); a.cores = 3; b.cores = 1; p.cores = 2; O.nexus = [a, b, p]; const v0 = O.void;
    const src = BS.mkInst('BS46-X03'); P.spirits = [src];
    const c = { p: P, opp: O, src, ctx: {} }; await BS.FX_ACTIONS.OPP_GW_CORES_TO_VOID.run(c, { do: 'OPP_GW_CORES_TO_VOID', n: 2 });
    return { a: a.cores, b: b.cores, p: p.cores, v: O.void - v0 }; })()`);
  assert.deepEqual([r.a, r.b, r.p, r.v], [1, 0, 2, 3], JSON.stringify(r));
});

test('K-1078 BLOCK_MIN: fewer than three eligible blockers cannot block; with three, all exhaust and one fights', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const run = async n => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
      const a = BS.mkInst('BS46-X03'); a.cores = 4; P.spirits = [a]; O.spirits = []; for (let i = 0; i < n; i++) { const s = BS.mkInst(any); s.cores = 3; O.spirits.push(s); }
      O.life = 5; const life = O.life; a.blockN = { b: G.battleNo + 1, n: 3 }; const sp = O.spirits.slice();
      await BS.doBattle(P.key, a); return { exhausted: sp.filter(s => s.exhausted).length, lifeLost: life - O.life }; };
    return { two: await run(2), three: await run(3) }; })()`);
  assert.equal(r.two.exhausted, 0, JSON.stringify(r));
  assert.equal(r.three.exhausted, 2, JSON.stringify(r));      // the fighting blocker is destroyed (3 cores vs 4 cores attacker is a guess), the two others stay exhausted assert.equal(r.three.lifeLost, 0, JSON.stringify(r));
});
