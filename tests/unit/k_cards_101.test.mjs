import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1096 BS44-CP02/XX02 Lolo: a Cost 3+ Spirit summon charges the Nexus once per turn, Cost 2 does not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const nx = BS.mkInst('BS44-XX02'); nx.cores = 1; P.nexus = [nx]; P.void = 5; P.onceUsed = {};
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const lo = BS.mkInst(ids.find(k => BS.CARDS[k].cost === 2)), hi = BS.mkInst(ids.find(k => BS.CARDS[k].cost >= 3));
    await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: lo }); const a = nx.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: hi }); const b = nx.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: hi }); const c = nx.cores;
    return { a, b, c, p1: BS.CARDS['BS44-CP02'].partial, p2: BS.CARDS['BS44-XX02'].partial }; })()`);
  assert.equal(r.p1, false, JSON.stringify(r)); assert.equal(r.p2, false, JSON.stringify(r));
  assert.equal(r.a, 1, JSON.stringify(r)); assert.equal(r.b, 2, JSON.stringify(r)); assert.equal(r.c, 2, JSON.stringify(r));
});

test('K-1097 BS44-XX02/CP02: activation pays 3 Nexus cores to the Void; XX02 (CPU) draws, CP02 puts a Void core into the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const out = {};
    for (const id of ['BS44-XX02', 'BS44-CP02']) {
      const nx = BS.mkInst(id); nx.cores = 3; P.nexus = [nx]; P.onceUsed = {}; P.void = 0; P.reserve.n = 2; P.hand = []; P.deck = [BS.mkInst('BS74-048'), BS.mkInst('BS74-049')];
      const idx = BS.CARDS[id].effects.findIndex(e => e.trigger === 'ACTIVATE');
      const ok = await BS.activateFx(P, nx, idx);
      out[id] = { ok, cores: nx.cores, hand: P.hand.length, res: P.reserve.n, void: P.void };
    }
    return out; })()`);
  assert.equal(r['BS44-XX02'].ok, true, JSON.stringify(r)); assert.equal(r['BS44-XX02'].cores, 0, JSON.stringify(r)); assert.equal(r['BS44-XX02'].hand, 1, JSON.stringify(r));
  assert.equal(r['BS44-CP02'].ok, true, JSON.stringify(r)); assert.equal(r['BS44-CP02'].cores, 0, JSON.stringify(r)); assert.equal(r['BS44-CP02'].hand, 0, JSON.stringify(r)); assert.equal(r['BS44-CP02'].res, 3, JSON.stringify(r));
});

test('K-1098 BS44-XX02 Lv2: also treated as all six colours (symbol)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const x = BS.mkInst('BS44-XX02'); x.cores = 3; P.nexus = [x]; P.spirits = [];
    const sy = BS.symbolsOn(P); const colours = ['red','purple','green','white','yellow','blue'].map(c => (sy[c] || 0) > 0);
    x.cores = 0; const sy0 = BS.symbolsOn(P); const lv1 = ['purple','blue'].map(c => (sy0[c] || 0) > 0);
    return { colours, lv1 }; })()`);
  assert.deepEqual(r.colours, [true, true, true, true, true, true], JSON.stringify(r));
  assert.deepEqual(r.lv1, [false, false], JSON.stringify(r));
});

test('K-1099 BS47-XX03 Grandwalker Kei: pays 3 cores, activates the set Burst at once (any timing), then may set a Burst card from the Hand; charges on Cost 3+ Burst Spirits only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS47-XX03'); nx.cores = 3; P.nexus = [nx]; P.onceUsed = {}; P.void = 0; P.hand = [BS.mkInst('BS18-X012A')]; P.deck = [BS.mkInst('BS74-048'), BS.mkInst('BS74-049')];
    const sp = BS.mkInst('BS74-048'); sp.cores = 1; sp.exhausted = true; P.spirits = [sp]; const b = BS.mkInst('BS25-079'); b.mirage = false; P.burst = b; const burstDef = BS.CARDS['BS25-079'].burst; P.burstSetThisTurn = false;
    const idx = BS.CARDS['BS47-XX03'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const ok = await BS.activateFx(P, nx, idx);
    const newBurst = P.burst && P.burst.id;
    return { ok, cores: nx.cores, refreshed: !sp.exhausted, newBurst, old: P.trash.includes(b) || P.spirits.includes(b) || P.hand.includes(b), partial: BS.CARDS['BS47-XX03'].partial, when: burstDef.when }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.cores, 0, JSON.stringify(r));
  assert.equal(r.refreshed, true, JSON.stringify(r)); assert.equal(r.newBurst, 'BS18-X012A', JSON.stringify(r)); assert.equal(r.old, true, JSON.stringify(r));
});

test('K-1100 BS47-XX03: nothing to activate without a set Burst (the action is not usable)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS47-XX03'); nx.cores = 3; P.nexus = [nx]; P.burst = null; P.onceUsed = {};
    const c = { p: P, opp: O, src: nx, ctx: {} };
    return { can: BS.FX_ACTIONS ? !!BS.FX_ACTIONS.ACTIVATE_SET_BURST.can(c, { do: 'ACTIVATE_SET_BURST' }) : null }; })()`);
  assert.equal(r.can, false, JSON.stringify(r));
});

test('K-1101 BS47-XX02 Grandwalker Manaka: setting a Burst puts a Void core on the Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const nx = BS.mkInst('BS47-XX02'); nx.cores = 1; P.nexus = [nx]; P.void = 3;
    await BS.fireFx(P, 'BURST_SET', null, {});
    return { cores: nx.cores, partial: BS.CARDS['BS47-XX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r));
});

test('K-1102 BS47-XX02: Flash destroys an opposing Spirit that has a Burst effect or Advent, never a plain one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS47-XX02'); nx.cores = 2; P.nexus = [nx]; P.onceUsed = {}; P.spirits = [];
    const plain = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].burst && !BS.CARDS[k].token && !(BS.CARDS[k].keywords || []).includes('Advent') && !(BS.CARDS[k].effects || []).some(e => e.trigger === 'ADVENT'));
    const pl = BS.mkInst(plain); pl.cores = 1; O.spirits = [pl];
    const idx = BS.CARDS['BS47-XX02'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const okPlain = await BS.activateFx(P, nx, idx); const plainLeft = O.spirits.includes(pl);
    const bs = BS.mkInst('BS18-X012A'); bs.cores = 1; O.spirits = [pl, bs]; nx.cores = 2; P.onceUsed = {}; nx.exhausted = false;
    const ok = await BS.activateFx(P, nx, idx);
    return { okPlain, plainLeft, ok, burstGone: !O.spirits.includes(bs), plainStays: O.spirits.includes(pl), cores: nx.cores }; })()`);
  assert.equal(r.plainLeft, true, JSON.stringify(r)); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.burstGone, true, JSON.stringify(r)); assert.equal(r.plainStays, true, JSON.stringify(r));
});

test('K-1103 BS47-XX02 Lv2: an opposing Spirit that leaves due to your Burst sends one opposing Life to the Reserve, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS47-XX02'); nx.cores = 6; P.nexus = [nx]; P.onceUsed = {}; P.spirits = [];
    const run = async () => { const v = BS.mkInst('BS18-X012A'); v.cores = 1; v.bpMod = -20000; O.spirits = [v]; O.life = 5; const b = BS.mkInst('BS15-074'); P.burst = b; b.mirage = false;
      const l0 = O.reserve.n; await BS.maybeBurst(P, 'LIFE_DECREASE', {}); return { gone: !O.spirits.includes(v), life: O.life, res: O.reserve.n - l0 }; };
    const first = await run(); const second = await run();
    nx.cores = 1; P.onceUsed = {}; G.turnNo += 1; const lv1 = await run();
    return { first, second, lv1 }; })()`);
  assert.equal(r.first.gone, true, JSON.stringify(r)); assert.equal(r.first.life, 4, JSON.stringify(r)); assert.equal(r.second.life, 5, JSON.stringify(r)); assert.equal(r.lv1.life, 5, JSON.stringify(r));
});

test('K-1104 BS45-XX02 Grandwalker Alex: Flash puts a Hand card under an Advent Spirit and refreshes it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS45-XX02'); nx.cores = 3; P.nexus = [nx]; P.onceUsed = {};
    const adv = 'BS39-XX01';
    const sp = BS.mkInst(adv); sp.cores = 1; sp.exhausted = true; P.spirits = [sp]; sp.under = [];
    const h = BS.mkInst('BS18-X012A'); P.hand = [h];
    G.attack = G.attack || {}; G.attackStep = true;
    const idx = BS.CARDS['BS45-XX02'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const c = { p: P, opp: O, src: nx, ctx: {} };
    await BS.FX_ACTIONS.PREADVENT_REFRESH.run(c, { do: 'PREADVENT_REFRESH' });
    return { adv, under: sp.under.length, refreshed: !sp.exhausted, hand: P.hand.length, idx, partial: BS.CARDS['BS45-XX02'].partial }; })()`);
  assert.equal(r.under, 1, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r)); assert.equal(r.hand, 0, JSON.stringify(r)); assert.equal(r.partial, false, JSON.stringify(r));
});

test('K-1105 BS45-XX02 Lv2: both players draw at most one card outside the Draw Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const nx = BS.mkInst('BS45-XX02'); nx.cores = 3; P.nexus = [nx];
    const n0 = O.hand.length; await BS.draw(O, 3); const capped = O.hand.length - n0;
    G.step = 2; const m0 = O.hand.length; await BS.draw(O, 2); const step = O.hand.length - m0;
    nx.cores = 1; G.step = 4; const k0 = O.hand.length; await BS.draw(O, 3); const lv1 = O.hand.length - k0;
    return { capped, step, lv1 }; })()`);
  assert.equal(r.capped, 1, JSON.stringify(r)); assert.equal(r.step, 2, JSON.stringify(r)); assert.equal(r.lv1, 3, JSON.stringify(r));
});

test('K-1106 BS45-XX02: its colour and symbol are also treated as all six colours', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const nx = BS.mkInst('BS45-XX02'); nx.cores = 3; const e = BS.CARDS['BS45-XX02'].effects.find(x => x.flag === 'ALSO_TREATED'); return { cols: e.colors.length, sym: e.symbol }; })()`);
  assert.equal(r.cols, 6, JSON.stringify(r)); assert.equal(r.sym, true, JSON.stringify(r));
});

test('K-1107 BS51-XX03 Grandwalker Alex-Lolo: deploy Core Charge adds one trashed card to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const nx = BS.mkInst('BS51-XX03'); nx.cores = 1; P.nexus = [nx]; P.void = 5;
    const h0 = P.hand.length, d0 = P.deck.length;
    await BS.fireFx(P, 'SUMMONED', nx, {});
    return { hand: P.hand.length - h0, deck: d0 - P.deck.length, partial: BS.CARDS['BS51-XX03'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.hand, 1, JSON.stringify(r)); assert.equal(r.deck, 3, JSON.stringify(r));
});

test('K-1108 BS51-XX03: Main deploys a Grandwalker Nexus from the Trash only while you control two or fewer Grandwalker Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 3; G.fxBy = P.key;
    const nx = BS.mkInst('BS51-XX03'); nx.cores = 3; P.nexus = [nx]; P.onceUsed = {}; P.void = 0;
    const t = BS.mkInst('BS47-XX03'); P.trash = [t];
    const idx = BS.CARDS['BS51-XX03'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const ok = await BS.activateFx(P, nx, idx);
    const deployed = P.nexus.includes(t);
    const a = BS.mkInst('BS44-XX02'), b = BS.mkInst('BS47-XX02'); P.nexus = [nx, a, b]; nx.cores = 3; P.onceUsed = {}; nx.exhausted = false; const t2 = BS.mkInst('BS47-XX03'); P.trash = [t2];
    const ok3 = await BS.activateFx(P, nx, idx);
    return { ok, deployed, three: P.nexus.length, t2in: P.trash.includes(t2), ok3 }; })()`);
  assert.equal(r.deployed, true, JSON.stringify(r)); assert.equal(r.t2in, true, JSON.stringify(r)); assert.equal(r.three, 3, JSON.stringify(r));
});

test('K-1109 BS50-CP01 Grandphosis: Flash pays 3 cores, the Nexus is also a 3000 BP Spirit and stays so for the turn, then reverts', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS50-CP01'); nx.cores = 5; P.nexus = [nx]; P.spirits = []; P.onceUsed = {};
    const idx = BS.CARDS['BS50-CP01'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const ok = await BS.activateFx(P, nx, idx);
    const asSp = P.spirits.includes(nx), bp = BS.bpOf ? BS.bpOf(nx) : null, cores = nx.cores;
    G.step = 6; const stillSp = P.spirits.includes(nx) || (BS.setStep && (BS.setStep(7), P.spirits.includes(nx)));
    return { ok, asSp, bp, cores, stillSp, partial: BS.CARDS['BS50-CP01'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.asSp, true, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r)); assert.equal(r.stillSp, true, JSON.stringify(r));
  if (r.bp != null) assert.equal(r.bp, 3000, JSON.stringify(r));
});

test('K-1110 BS50-CP01: a Grandphosis Nexus is destroyed by a Grandwalker Nexus effect only, and a second Nexus refreshes it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS50-CP01'); nx.cores = 5; P.nexus = [nx]; P.spirits = []; P.onceUsed = {};
    await BS.FX_ACTIONS.GRANDPHOSIS.run({ p: P, opp: O, src: nx, ctx: {} }, { do: 'GRANDPHOSIS', bp: 3000 });
    const plain = BS.mkInst('BS18-X012A'); G.fxSrc = plain; G.fxBy = O.key; BS.removeSpirit(P, nx, 'destroyed', false); const survivedPlain = P.spirits.includes(nx);
    const gw = BS.mkInst('BS47-XX03'); G.fxSrc = gw; BS.removeSpirit(P, nx, 'destroyed', false); const diedGw = !P.spirits.includes(nx);
    G.fxSrc = null; G.fxBy = P.key;
    const nx2 = BS.mkInst('BS51-XX03'); nx2.cores = 3; nx2.gpBp = 3000; nx2.gp = G.turnNo; nx2.asSpirit = true; nx2.exhausted = true; P.spirits = [nx2];
    const c = { p: P, opp: O, src: nx, ctx: {} };
    const canSelfName = BS.FX_ACTIONS.REFRESH_GP_NEXUS.can(c, { do: 'REFRESH_GP_NEXUS', exceptSelfName: true });
    await BS.FX_ACTIONS.REFRESH_GP_NEXUS.run(c, { do: 'REFRESH_GP_NEXUS', exceptSelfName: true });
    return { survivedPlain, diedGw, canSelfName, refreshed: !nx2.exhausted }; })()`);
  assert.equal(r.survivedPlain, true, JSON.stringify(r)); assert.equal(r.diedGw, true, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r));
});

test('K-1111 BS50-CP01: the Grandphosis state ends with the turn (Nexus back on the Field with its cores) and Core Charge needs a Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS50-CP01'); nx.cores = 4; P.nexus = [nx]; P.spirits = [];
    await BS.FX_ACTIONS.GRANDPHOSIS.run({ p: P, opp: O, src: nx, ctx: {} }, { do: 'GRANDPHOSIS', bp: 3000 });
    BS.setStep(6); const same = P.spirits.includes(nx);
    G.turnNo += 1; BS.setStep(1);
    return { same, back: P.nexus.includes(nx) && !P.spirits.includes(nx), cores: nx.cores, flags: [nx.asSpirit, nx.gpBp, nx.gp] }; })()`);
  assert.equal(r.same, true, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r)); assert.equal(r.cores, 4, JSON.stringify(r));
});

test('K-1112 BS50-X12 Vishnu: Grandphosis cannot be refreshed, and LV2 gives extra White symbols to itself and cost 6+ Armored Dragon Spirits on your turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS50-X12'); nx.cores = 5; P.nexus = [nx]; P.spirits = [];
    const ad = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost >= 6 && (c.families || []).includes('Armored Dragon'));
    const sp = BS.mkInst(ad.id); sp.cores = 3; P.spirits.push(sp);
    const withNx = BS.attackSymbols(sp); G.active = O.key; const oppTurn = BS.attackSymbols(sp); G.active = P.key; P.nexus = []; const without = BS.attackSymbols(sp); P.nexus = [nx];
    await BS.FX_ACTIONS.GRANDPHOSIS.run({ p: P, opp: O, src: nx, ctx: {} }, { do: 'GRANDPHOSIS', bp: 3000, noRefresh: true });
    nx.exhausted = true; const inSp = P.spirits.includes(nx), flag = nx.gpNoRefresh;
    G.turnNo += 1; BS.setStep(1);
    return { inSp, flag, back: P.nexus.includes(nx), cleared: nx.gpNoRefresh, withNx, oppTurn, without, adId: ad.id }; })()`);
  assert.equal(r.inSp, true, JSON.stringify(r)); assert.equal(r.flag, true, JSON.stringify(r));
  assert.equal(r.back, true, JSON.stringify(r)); assert.ok(!r.cleared, JSON.stringify(r));
  assert.equal(r.withNx, r.without + 1, JSON.stringify(r)); assert.equal(r.oppTurn, r.without, JSON.stringify(r));
});
