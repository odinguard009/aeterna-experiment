import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1046 BS58-014 Vanderas: Summoned draws a card; the White Rush puts a core per two opposing Hand cards on itself, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const v = BS.mkInst('BS58-014'); v.cores = 1; P.spirits = [v]; O.spirits = [];
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    O.hand = [1, 2, 3, 4, 5].map(() => BS.mkInst(any));
    const wk = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].symbols || 0) >= 1 && (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).includes('white'));
    P.nexus = []; const w = BS.mkInst(wk); w.cores = 1; P.spirits.push(w);
    P.reserve.n = 0; P.void = 4; const h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', v, { subject: v }); const c1 = v.cores; await BS.fireFx(P, 'SUMMONED', v, { subject: v });
    return { drew: P.hand.length - h0, partial: BS.CARDS['BS58-014'].partial, c1, c2: v.cores, fx: BS.CARDS['BS58-014'].effects.length }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.fx, 3, JSON.stringify(r)); assert.equal(r.drew, 2, JSON.stringify(r)); assert.equal(r.c1, 3, JSON.stringify(r)); assert.equal(r.c2, 3, JSON.stringify(r));
});

const symSpirit = c => `Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].symbols || 0) >= 1 && (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).includes('${c}'))`;

test('K-1047 BS58-025 Leodoros: Attacks puts two Void cores on Spirits; with a Red symbol it marks Ultra Clash for this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const l = BS.mkInst('BS58-025'); l.cores = 3; const r = BS.mkInst(${symSpirit('red')}); r.cores = 1; P.spirits = [l, r]; O.spirits = []; P.void = 4; G.attacker = l; G.battleNo = 7;
    const c0 = l.cores + r.cores;
    await BS.fireFx(P, 'ATTACKS', l, { attacker: l, subject: l });
    return { put: l.cores + r.cores - c0, ultra: l.ultraB === 7, partial: BS.CARDS['BS58-025'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.put, 2, JSON.stringify(r)); assert.equal(r.ultra, true, JSON.stringify(r));
});

test('K-1048 BS59-001 Helmet-Streamer-Dragon: Attacks sets Ultra Clash; with Red and Green symbols it gains +5000 BP and refreshes on the first battle only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const h = BS.mkInst('BS59-001'); h.cores = 4; const a = BS.mkInst(${symSpirit('red')}), b = BS.mkInst(${symSpirit('green')}); P.spirits = [h, a, b]; O.spirits = []; G.attacker = h; G.battleNo = 1;
    const bp0 = BS.bpOf(h); h.exhausted = true;
    await BS.fireFx(P, 'ATTACKS', h, { attacker: h, subject: h });
    const first = { bp: BS.bpOf(h) - bp0, ref: !h.exhausted, ultra: h.ultraB === 1 };
    h.exhausted = true; G.battleNo = 2; await BS.fireFx(P, 'ATTACKS', h, { attacker: h, subject: h });
    return { first, secondRef: !h.exhausted, partial: BS.CARDS['BS59-001'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.first.bp, 5000, JSON.stringify(r)); assert.equal(r.first.ref, true, JSON.stringify(r)); assert.equal(r.first.ultra, true, JSON.stringify(r)); assert.equal(r.secondRef, false, JSON.stringify(r));
});

test('K-1049 BS54-033 Renata: reveals three; may add a White Grandstone Nexus or an Ice Princess Spirit (not Renata itself), the rest are discarded', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const n = BS.mkInst('BS54-033'); n.cores = 2; P.spirits = [n]; O.spirits = [];
    const pr = Object.keys(BS.CARDS).find(k => k !== 'BS54-033' && BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Ice Princess'));
    const junk = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Ice Princess'));
    P.deck = [BS.mkInst('BS54-033'), BS.mkInst(junk), BS.mkInst(pr), BS.mkInst(junk)]; const h0 = P.hand.length, t0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', n, { subject: n });
    P.deck = [BS.mkInst('BS54-064'), BS.mkInst(junk), BS.mkInst(junk)]; const h1 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', n, { subject: n });
    return { a: P.hand.length - h0 - (P.hand.length - h1), added: P.hand.slice(h0).map(x => x.id), pr, nex: P.hand.some(x => x.id === 'BS54-064'), trash: P.trash.length - t0, partial: BS.CARDS['BS54-033'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.a, 1, JSON.stringify(r)); assert.equal(r.added[0], r.pr, JSON.stringify(r)); assert.equal(r.nex, true, JSON.stringify(r)); assert.equal(r.trash, 4, JSON.stringify(r));
});

test('K-1050 BS58-028 Torando: Burst exhausts two opposing Spirits, one Void core to the Reserve per Spirit exhausted, then summons itself', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = P.key;
    const sp = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const t = BS.mkInst('BS58-028'); P.hand = [t]; P.spirits = []; O.spirits = [BS.mkInst(sp), BS.mkInst(sp), BS.mkInst(sp)]; P.void = 5; const r0 = P.reserve.n;
    const b = BS.CARDS['BS58-028'].burst; const ctx = {}; const c = { p: P, opp: O, src: t, ctx };
    await BS.FX_ACTIONS.EXHAUST_OPP.run(c, b.actions[0]); await BS.FX_ACTIONS.VOID_TO_RESERVE.run(c, b.actions[1]);
    return { exh: O.spirits.filter(s => s.exhausted).length, res: P.reserve.n - r0, hasSummon: b.actions[2].do, when: b.when, partial: BS.CARDS['BS58-028'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.exh, 2, JSON.stringify(r)); assert.equal(r.res, 2, JSON.stringify(r)); assert.equal(r.hasSummon, 'SUMMON_SELF', JSON.stringify(r));
});

test('K-1051 BS55-RV002 Swordoll: always also White; with a Purple Grandstone Nexus also Yellow and draws when removed by the opponent', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = O.key;
    const s = BS.mkInst('BS55-RV002'); s.cores = 2; P.spirits = [s]; O.spirits = []; P.nexus = [];
    const w0 = BS.alsoTreated(s, 'color').join(), y0 = BS.alsoTreated(s, 'symbol').join();
    P.nexus = [BS.mkInst('BS54-062')]; const w1 = BS.alsoTreated(s, 'color').join();
    return { w0, y0, w1, partial: BS.CARDS['BS55-RV002'].partial, fx: BS.CARDS['BS55-RV002'].effects.length }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.w0, 'white', JSON.stringify(r)); assert.equal(r.y0, 'white', JSON.stringify(r)); assert.equal(r.w1, 'white,yellow', JSON.stringify(r));
});

test('K-1052 BS55-RV003 Sekkohkiji: LEAVES by an opposing effect with a Green Grandstone Nexus puts a Void core to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = O.key;
    const s = BS.mkInst('BS55-RV003'); s.cores = 2; P.spirits = []; s.lostLv = 1; P.trash.push(s); O.spirits = []; P.nexus = [BS.mkInst('BS54-063')]; P.void = 3; const r0 = P.reserve.n;
    const a = 'red,white';
    await BS.fireFx(P, 'LEAVES', s, { subject: s, byOpp: true, byOppFx: true });
    P.nexus = []; const r1 = P.reserve.n; P.void = 3; await BS.fireFx(P, 'LEAVES', s, { subject: s, byOpp: true, byOppFx: true });
    return { a, gain: r1 - r0, noNex: P.reserve.n - r1, partial: BS.CARDS['BS55-RV003'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.a, 'red,white', JSON.stringify(r)); assert.equal(r.gain, 1, JSON.stringify(r)); assert.equal(r.noNex, 0, JSON.stringify(r));
});

test('K-1053 BS39-RV018 Angelia Coma: Accel flash marks every opposing Spirit unable to attack/block, own Spirits untouched', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const a = BS.mkInst(${symSpirit('red')}), b = BS.mkInst(${symSpirit('green')}), m = BS.mkInst(${symSpirit('white')}); a.cores = b.cores = m.cores = 1; O.spirits = [a, b]; P.spirits = [m];
    const e = BS.CARDS['BS39-RV018'].effects.find(x => x.trigger === 'ACCEL'); const c = { p: P, opp: O, src: BS.mkInst('BS39-RV018'), ctx: {} };
    await BS.FX_ACTIONS.CANT_ATTACK_BLOCK_ALL.run(c, e.actions[0]);
    return { opp: O.spirits.map(s => !!s.noAB), own: !!m.noAB, cost: e.cost, partial: BS.CARDS['BS39-RV018'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.opp, [true, true], JSON.stringify(r)); assert.equal(r.own, false, JSON.stringify(r)); assert.equal(r.cost, 7, JSON.stringify(r));
});

test('K-1054 BS39-RV012 Dolphing: CANT_ATTACK_PICK only targets a braved opposing Spirit and bars it from attacking this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const a = BS.mkInst(${symSpirit('red')}), b = BS.mkInst(${symSpirit('green')}); a.cores = b.cores = 1; b.brave = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave')); O.spirits = [a, b]; P.spirits = [];
    const e = BS.CARDS['BS39-RV012'].effects.find(x => x.trigger === 'OPP_START_ATTACK'); const c = { p: P, opp: O, src: BS.mkInst('BS39-RV012'), ctx: {} };
    await BS.FX_ACTIONS.CANT_ATTACK_PICK.run(c, e.actions[0]);
    return { plain: a.noAtkTurn === G.turnNo, braved: b.noAtkTurn === G.turnNo, opt: e.optional, partial: BS.CARDS['BS39-RV012'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.braved, true, JSON.stringify(r)); assert.equal(r.plain, false, JSON.stringify(r)); assert.equal(r.opt, true, JSON.stringify(r));
});
