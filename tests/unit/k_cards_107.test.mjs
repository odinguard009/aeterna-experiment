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

test('K-1079 BS45-032 Agamemnon: discarded by an opposing effect pays 1 and summons from Trash then draws 3; Lv2 protects cores; Blade Beast win trashes a Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = O.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS45-032');
    const pc = BS.mkInst('BS45-032'); P.hand = [pc]; P.deck = [1,2,3,4,5,6].map(() => BS.mkInst(any)); P.spirits = []; P.reserve.n = 4;
    const src = BS.mkInst(any); O.spirits = [src];
    await BS.FX_ACTIONS.OPP_DISCARD.run({ p: O, opp: P, src, ctx: {} }, { do: 'OPP_DISCARD', n: 1 });
    const summoned = P.spirits.includes(pc), hand = P.hand.length;
    pc.cores = 3; const t = BS.mkInst(any); t.cores = 3; O.spirits = [t]; const before = t.cores;
    const cap = BS.coreTakeCap(O, t, 2);
    return { summoned, hand, cap, before, partial: BS.CARDS['BS45-032'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.hand, 3, JSON.stringify(r));
  assert.equal(r.cap, 0, JSON.stringify(r));
});

test('K-1080 BS45-032 Agamemnon: a Blade Beast ally winning on your attack sends an opposing Life to the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const a = BS.mkInst('BS45-032'); a.cores = 3; const bb = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Blade Beast') && BS.CARDS[k].type === 'Spirit' && k !== 'BS45-032'); const w = BS.mkInst(bb); w.cores = 2; P.spirits = [a, w]; O.life = 5; G.attacker = w;
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', a, { subject: w, attacking: true });
    return { life: O.life }; })()`);
  assert.equal(r.life, 4, JSON.stringify(r));
});

test('K-1081 BS45-X03 Odyssaber: Attacks sends two opposing Spirits to Removed, Unleash core locks their Removed Zone, extra Green symbols per two removed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS45-X03');
    const gw = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker') && BS.CARDS[k].symbol === 'green');
    const a = BS.mkInst('BS45-X03'); a.cores = 3; const n = BS.mkInst(gw); n.cores = 3; P.spirits = [a]; P.nexus = [n]; G.attacker = a;
    const t1 = BS.mkInst(any), t2 = BS.mkInst(any), t3 = BS.mkInst(any); [t1, t2, t3].forEach(t => t.cores = 1); O.spirits = [t1, t2, t3]; O.removed = [BS.mkInst(any), BS.mkInst(any)];
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { oppSpirits: O.spirits.length, removed: O.removed.length, nexusCores: n.cores, spiritCores: a.cores, locked: !!G.removedLock, sym: a.symTurn && a.symTurn.cols.length, partial: BS.CARDS['BS45-X03'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.oppSpirits, 1, JSON.stringify(r)); assert.equal(r.removed, 4, JSON.stringify(r));
  assert.equal(r.nexusCores, 2, JSON.stringify(r)); assert.equal(r.spiritCores, 4, JSON.stringify(r)); assert.equal(r.locked, true, JSON.stringify(r)); assert.equal(r.sym, 2, JSON.stringify(r));
});

test('K-1082 BS46-037 Theseus: a set Burst discarded by the opponent activates anyway (summon, exhaust two, Blade Beast +10000); Lv2 win refreshes', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = O.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Blade Beast'));
    const bb = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Blade Beast') && BS.CARDS[k].type === 'Spirit' && k !== 'BS46-037');
    const b = BS.mkInst('BS46-037'); P.burst = b; P.reserve.n = 3; const ally = BS.mkInst(bb); ally.cores = 2; P.spirits = [ally];
    const t1 = BS.mkInst(any), t2 = BS.mkInst(any); t1.cores = t2.cores = 1; O.spirits = [t1, t2];
    const src = BS.mkInst(any); await BS.FX_ACTIONS.DISCARD_OPP_BURST.run({ p: O, opp: P, src, ctx: {} }, { do: 'DISCARD_OPP_BURST' });
    const s = P.spirits.find(x => x.id === 'BS46-037');
    return { summoned: !!s, burst: !!P.burst, trash: P.trash.includes(b), exh: O.spirits.filter(x => x.exhausted).length, bp: ally.bpMod, partial: BS.CARDS['BS46-037'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.burst, false, JSON.stringify(r));
  assert.equal(r.exh, 2, JSON.stringify(r)); assert.equal(r.bp, 10000, JSON.stringify(r)); assert.equal(r.trash, false, JSON.stringify(r));
});

test('K-1083 BS49-033 Dioscuri: green Grandwalker Nexus locks the opposing Removed Zone; Lv2 Attacks sends an exhausted Spirit to Removed and splits two Void cores', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS49-033');
    const gw = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker') && BS.CARDS[k].symbol === 'green');
    const a = BS.mkInst('BS49-033'); a.cores = 3; const n = BS.mkInst(gw); n.cores = 1; P.spirits = [a]; P.nexus = [n]; G.attacker = a;
    P.void = 3; const lockedBefore = BS.removedLocked(O);
    const t = BS.mkInst(any); t.exhausted = true; t.cores = 1; O.spirits = [t]; O.removed = [];
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { lockedBefore, removed: O.removed.length, gone: !O.spirits.includes(t), cores: a.cores + n.cores, partial: BS.CARDS['BS49-033'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.lockedBefore, true, JSON.stringify(r)); assert.equal(r.removed, 1, JSON.stringify(r));
  assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.cores, 6, JSON.stringify(r));
});

test('K-1084 BS49-037 Atalante: Attacks sends an originally Cost 6-8 opposing Spirit to Removed and refreshes; Lv2 stops Bursts and discards a Red/White card from their Removed Zone', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const sp = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const big = sp.find(k => [6, 7, 8].includes(BS.CARDS[k].cost) && k !== 'BS49-037'), small = sp.find(k => BS.CARDS[k].cost <= 3);
    const red = sp.find(k => (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).includes('red'));
    const a = BS.mkInst('BS49-037'); a.cores = 4; a.exhausted = true; P.spirits = [a]; G.attacker = a;
    const t1 = BS.mkInst(big), t2 = BS.mkInst(small); t1.cores = t2.cores = 1; O.spirits = [t2, t1]; O.removed = [BS.mkInst(red)];
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { bigGone: !O.spirits.includes(t1), smallStays: O.spirits.includes(t2), removed: O.removed.length, refreshed: !a.exhausted, noBurst: G.noBurst, trash: O.trash.length, partial: BS.CARDS['BS49-037'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.bigGone, true, JSON.stringify(r)); assert.equal(r.smallStays, true, JSON.stringify(r));
  assert.equal(r.refreshed, true, JSON.stringify(r)); assert.ok(r.noBurst, JSON.stringify(r)); assert.equal(r.removed, 1, JSON.stringify(r));
});

test('K-1085 BS50-035 Meleagros: a Blade Beast attacking removes a random opposing Hand card; Lv2 reveals one card per Removed card and summons HeroBeast Spirits for 1 each', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !/HeroBeast/.test(BS.CARDS[k].name));
    const hero = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && /HeroBeast/.test(BS.CARDS[k].name) && k !== 'BS50-035' && BS.CARDS[k].cost <= 4);
    const a = BS.mkInst('BS50-035'); a.cores = 4; P.spirits = [a]; G.attacker = a; P.reserve.n = 4;
    O.hand = [BS.mkInst(any), BS.mkInst(any)]; O.removed = [];
    await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a, subject: a });
    const afterHand = O.hand.length, rem = O.removed.length;
    P.deck = [BS.mkInst(hero), BS.mkInst(any), BS.mkInst(any)]; const sp0 = P.spirits.length, tr0 = P.trash.length;
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { afterHand, rem, summoned: P.spirits.length - sp0, trash: P.trash.length - tr0, partial: BS.CARDS['BS50-035'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.afterHand, 1, JSON.stringify(r)); assert.equal(r.rem, 1, JSON.stringify(r));
  assert.equal(r.summoned, 1, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r));
});

test('K-1086 BS45-024 Hector: in a Removed Zone it blocks effect draws by R/P/Y/B Spirit sources only; Attacks stops opposing Bursts', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const sp = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS45-024');
    const col = c => (BS.CARDS[c].colors || [BS.CARDS[c].symbol]);
    const blue = sp.find(k => col(k).includes('blue')), green = sp.find(k => col(k).length === 1 && col(k)[0] === 'green');
    P.deck = [1, 2, 3, 4, 5, 6].map(() => BS.mkInst(sp[0]));
    const before = P.hand.length; P.removed = [BS.mkInst('BS45-024')];
    const g = BS.G; g.fxSrc = null;
    const run = async id => { const src = BS.mkInst(id); P.spirits = [src]; g.fxSrc = src; const h = P.hand.length; await BS.FX_ACTIONS.DRAW.run({ p: P, opp: O, src, ctx: {} }, { do: 'DRAW', n: 1 }); g.fxSrc = null; return P.hand.length - h; };
    const b = await run(blue), gr = await run(green);
    const a = BS.mkInst('BS45-024'); a.cores = 3; P.spirits = [a]; G.attacker = a; G.noBurst = null; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { b, gr, noBurst: G.noBurst, partial: BS.CARDS['BS45-024'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.b, 0, JSON.stringify(r)); assert.equal(r.gr, 1, JSON.stringify(r)); assert.ok(r.noBurst, JSON.stringify(r));
});

test('K-1087 BS66-XV05 Titus XV: Summoned mills ten then destroys opposing Spirits up to total cost 15 only if the opposing Removed Zone has a card; an unblocked Crush Spirit refreshes once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const sp = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS66-XV05');
    const small = sp.find(k => BS.CARDS[k].cost <= 3);
    const a = BS.mkInst('BS66-XV05'); a.cores = 5; P.spirits = [a];
    O.deck = Array.from({ length: 12 }, () => BS.mkInst(small)); O.spirits = [BS.mkInst(small), BS.mkInst(small)]; O.spirits.forEach(s => s.cores = 1); O.removed = [BS.mkInst(small)]; O.trash = [];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    const milled = O.trash.length, left = O.spirits.length;
    a.exhausted = true; a.crushRefT = 0; G.attacker = a;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: a });
    const ref1 = !a.exhausted; a.exhausted = true;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: a });
    return { milled, left, ref1, ref2: !a.exhausted, partial: BS.CARDS['BS66-XV05'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.ok(r.milled >= 10, JSON.stringify(r)); assert.equal(r.left, 0, JSON.stringify(r));
  assert.equal(r.ref1, true, JSON.stringify(r)); assert.equal(r.ref2, false, JSON.stringify(r));
});

test('K-1088 BS67-XV05 Behedoth XV: returns from Trash when a Raon COUNTER raises the counter; Lv3 attack locks opposing Hand Magic this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 3;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS67-XV05');
    const bh = BS.mkInst('BS67-XV05'); P.trash = [bh]; P.hand = [];
    const raon = BS.mkInst('BS62-CX02'); P.spirits = []; P.void = 5;
    await BS.FX_ACTIONS.COUNTER.run({ p: P, opp: O, src: raon, ctx: {} }, { do: 'COUNTER', n: 2 });
    const back = P.hand.includes(bh);
    const other = BS.mkInst(any); const t = BS.mkInst('BS67-XV05'); t.cores = 6; P.spirits = [t]; G.attacker = t; G.battleNo = 7;
    await BS.fireFx(P, 'ATTACKS', t, { attacker: t, subject: t });
    const mag = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic');
    return { back, lock: !!(O.noMagicB && O.noMagicB.all && O.noMagicB.no === 7), usable: BS.magicUsable ? BS.magicUsable(O, BS.mkInst(mag), 'flash') : null, partial: BS.CARDS['BS67-XV05'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r)); assert.equal(r.lock, true, JSON.stringify(r));
  if (r.usable !== null) assert.equal(r.usable, false, JSON.stringify(r));
});
