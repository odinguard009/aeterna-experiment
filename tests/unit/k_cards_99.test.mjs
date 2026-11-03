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

test('K-1055 BS46-RV007 Soul Ogre: destroyed by the opponent puts a Void core to a Purple Grandwalker Nexus; draws only with the Soul Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = O.key;
    const nid = 'BS44-X08';
    const s = BS.mkInst('BS46-RV007'); s.cores = 1; s.lostLv = 1; P.spirits = []; P.trash.push(s); P.deck = BS.mkInst ? [BS.mkInst('BS46-RV007'), BS.mkInst('BS46-RV007')] : P.deck; O.spirits = []; const n = BS.mkInst(nid); n.cores = 0; P.nexus = [n]; P.void = 3; const d0 = P.hand.length;
    await BS.fireFx(P, 'DESTROYED', s, { subject: s, byOpp: true });
    const c1 = n.cores, h1 = P.hand.length - d0; s.soulLost = true; await BS.fireFx(P, 'DESTROYED', s, { subject: s, byOpp: true });
    return { nid: !!nid, c1, h1, h2: P.hand.length - d0 - h1, partial: BS.CARDS['BS46-RV007'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nid, true, JSON.stringify(r)); assert.equal(r.c1, 1, JSON.stringify(r)); assert.equal(r.h1, 0, JSON.stringify(r)); assert.equal(r.h2, 1, JSON.stringify(r));
});

test('K-1056 BS44-RV003 Kingghepardo: Life 3+ refreshes it once per turn, Life 3 or less returns an exhausted opposing Spirit to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const k = BS.mkInst('BS44-RV003'); k.cores = 3; k.exhausted = true; const t = BS.mkInst(${symSpirit('red')}); t.cores = 1; t.exhausted = true; P.spirits = [k]; O.spirits = [t]; G.attacker = k;
    P.life = 4; const d0 = O.deck.length;
    await BS.fireFx(P, 'ATTACKS', k, { subject: k }); const ref4 = !k.exhausted, kept4 = O.spirits.length;
    k.exhausted = true; await BS.fireFx(P, 'ATTACKS', k, { subject: k }); const ref2 = !k.exhausted;
    P.life = 3; await BS.fireFx(P, 'ATTACKS', k, { subject: k });
    return { ref4, kept4, ref2, left: O.spirits.length, deck: O.deck.length - d0, partial: BS.CARDS['BS44-RV003'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.ref4, true, JSON.stringify(r)); assert.equal(r.kept4, 1, JSON.stringify(r)); assert.equal(r.ref2, false, JSON.stringify(r)); assert.equal(r.left, 0, JSON.stringify(r)); assert.equal(r.deck, 1, JSON.stringify(r));
});

const invS = `'BS46-043'`;

test('K-1057 BS46-XX02 Grandwalker Antarc (Oracle Core Charge): deploy mills three and adds a Void core per target card; skipped with a same-named Nexus on the Field', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 3; G.fxBy = P.key;
    const x = BS.mkInst('BS46-XX02'); P.nexus = [x]; P.spirits = []; P.void = 3;
    const junk = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Investigator'));
    P.deck = [BS.mkInst(${invS}), BS.mkInst(junk), BS.mkInst('BS46-061'), BS.mkInst(junk), BS.mkInst(junk)]; const t0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', x, { subject: x });
    const a = { cores: x.cores, trash: P.trash.length - t0, deck: P.deck.length };
    const y = BS.mkInst('BS46-XX02'); P.nexus.push(y); P.deck = P.deck.concat([BS.mkInst(${invS}), BS.mkInst(${invS}), BS.mkInst(${invS})]); const d0 = P.deck.length;
    await BS.fireFx(P, 'SUMMONED', y, { subject: y });
    return { a, dup: { cores: y.cores, deck: P.deck.length - d0 }, partial: BS.CARDS['BS46-XX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.a, { cores: 2, trash: 3, deck: 2 }, JSON.stringify(r)); assert.deepEqual(r.dup, { cores: 0, deck: 0 }, JSON.stringify(r));
});

test('K-1058 BS46-XX02 Antarc: summoning an Investigator Spirit or a Cost 3+ Ultimate adds a Void core to the Nexus; other Spirits do not; capped at six cores', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 3; G.fxBy = P.key;
    const x = BS.mkInst('BS46-XX02'); P.nexus = [x]; P.void = 8; P.spirits = [];
    const junk = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Investigator'));
    const ult = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Ultimate' && BS.CARDS[k].cost >= 3), ult2 = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Ultimate' && BS.CARDS[k].cost < 3);
    const sm = async id => { const s = BS.mkInst(id); P.spirits.push(s); await BS.fireFx(P, 'SUMMONED', s, { subject: s }); return x.cores; };
    const out = [await sm(${invS}), await sm(junk), await sm(ult)]; const u2 = ult2 ? await sm(ult2) : null;
    x.cores = 5; const c5 = await sm(${invS}); const c6 = await sm(${invS});
    return { out, u2, c5, c6 }; })()`);
  assert.deepEqual(r.out, [1, 1, 2], JSON.stringify(r)); if (r.u2 != null) assert.equal(r.u2, 2, JSON.stringify(r)); assert.equal(r.c5, 6, JSON.stringify(r)); assert.equal(r.c6, 6, JSON.stringify(r));
});

test('K-1059 BS46-XX02 Antarc: the Skill refreshes an Investigator Spirit and puts a Void core on it; Grand Field (LV2) ignores Ultimate summon conditions and adds all symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const x = BS.mkInst('BS46-XX02'); x.cores = 3; P.nexus = [x]; const s = BS.mkInst(${invS}); s.cores = 1; s.exhausted = true; P.spirits = [s]; P.void = 3;
    const e = BS.CARDS['BS46-XX02'].effects.find(q => q.trigger === 'ACTIVATE'); const c = { p: P, opp: O, src: x, ctx: {} };
    await BS.FX_ACTIONS.REFRESH_PUT_CORE.run(c, e.actions[0]);
    const k = { ref: !s.exhausted, cores: s.cores, cost: e.cost };
    const lv1 = BS.alsoTreated ? BS.alsoTreated(x, 'symbol').length : -1; x.cores = 4; const lv2 = BS.alsoTreated ? BS.alsoTreated(x, 'symbol') : [];
    const ult = Object.keys(BS.CARDS).find(q => BS.CARDS[q].type === 'Ultimate' && BS.CARDS[q].cost <= 7 && BS.CARDS[q].summonIf);
    P.spirits = []; const ok2 = BS.summonOK(P, BS.CARDS[ult]); x.cores = 0; P.nexus = []; const ok0 = BS.summonOK(P, BS.CARDS[ult]);
    return { k, lv1, lv2, ok2, ok0 }; })()`);
  assert.equal(r.k.ref, true, JSON.stringify(r)); assert.equal(r.k.cores, 2, JSON.stringify(r)); assert.deepEqual(r.k.cost, { nexusToVoid: 3 }, JSON.stringify(r));
  assert.equal(r.lv1, 0, JSON.stringify(r)); assert.equal(r.lv2.length, 7, JSON.stringify(r)); assert.equal(r.ok2, true, JSON.stringify(r));
});

const B = `const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;`;

test('K-1060 BS46-061 Shirabel: Summoned reveals 3, adds an Antarc card and returns the other two to the deck bottom; her own main-step summon draws once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); ${B}
    const sh = BS.mkInst('BS46-061'); sh.cores = 2; P.spirits = [sh]; const inv = BS.mkInst(${invS}); P.spirits.push(inv);
    const junk = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !/Antarc/.test(BS.CARDS[k].name));
    P.deck = [BS.mkInst('BS46-XX02'), BS.mkInst(junk), BS.mkInst(junk), BS.mkInst(junk)]; const h0 = P.hand.length, d0 = P.deck.length, t0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', sh, { subject: sh });
    const a = { hand: P.hand.length - h0, deck: P.deck.length, trash: P.trash.length - t0 };
    const h1 = P.hand.length; await BS.fireFx(P, 'ALLY_SUMMONED', sh, { subject: inv }); await BS.fireFx(P, 'ALLY_SUMMONED', sh, { subject: inv }); const d = P.hand.length - h1;
    return { a, d, partial: BS.CARDS['BS46-061'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.a, { hand: 2, deck: 2, trash: 0 }, JSON.stringify(r)); assert.equal(r.d, 0, JSON.stringify(r));      // Shirabel is an Investigator herself: her own summon draws once (add 1 + draw 1), the second is blocked by once-per-turn
});

test('K-1061 BS46-069 Eilmer: Attacks bans opposing White Magic this battle (not other colours, not next battle)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); ${B}
    const e = BS.mkInst('BS46-069'); e.cores = 1; P.spirits = [e]; G.attacker = e; G.battleNo = 3;
    const mk = col => Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic' && (BS.CARDS[k].colors || [BS.CARDS[k].color]).includes(col) && BS.CARDS[k].cost <= 3 && (BS.CARDS[k].magic.timing || []).includes('FLASH') && !BS.CARDS[k].magic.by);
    const w = mk('white'), rd = mk('red'); O.hand = [BS.mkInst(w), BS.mkInst(rd)]; O.reserve.n = 8; G.active = P.key;
    const before = BS.magicUsable(O, O.hand[0], 'flash'); await BS.fireFx(P, 'ATTACKS', e, { attacker: e, subject: e });
    const after = BS.magicUsable(O, O.hand[0], 'flash'), other = BS.magicUsable(O, O.hand[1], 'flash'); G.battleNo = 4; const later = BS.magicUsable(O, O.hand[0], 'flash');
    return { w: !!w, rd: !!rd, before, after, other, later, partial: BS.CARDS['BS46-069'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.after, false, JSON.stringify(r)); assert.equal(r.later, r.before, JSON.stringify(r));
  if (r.rd) assert.equal(r.other, true, JSON.stringify(r));
});

test('K-1062 BS46-RV001 Ozzania: an attacking Investigator gets +3000 BP and draws only with a Hand of four or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); ${B}
    const o = BS.mkInst('BS46-RV001'); o.cores = 1; const inv = BS.mkInst(${invS}); inv.cores = 1; P.spirits = [o, inv]; G.attacker = inv; G.battleNo = 1;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const bp0 = BS.bpOf ? BS.bpOf(inv) : null; P.hand = [1, 2].map(() => BS.mkInst(any)); P.deck = [1, 2, 3, 4, 5, 6, 7].map(() => BS.mkInst(any));
    await BS.fireFx(P, 'ALLY_ATTACKS', inv, { attacker: inv, subject: inv }); const h1 = P.hand.length;
    P.hand = [1, 2, 3, 4, 5].map(() => BS.mkInst(any)); await BS.fireFx(P, 'ALLY_ATTACKS', inv, { attacker: inv, subject: inv });
    return { bp0, bp1: BS.bpOf ? BS.bpOf(inv) : null, h1, h2: P.hand.length, partial: BS.CARDS['BS46-RV001'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.h1, 3, JSON.stringify(r)); assert.equal(r.h2, 5, JSON.stringify(r));
  if (r.bp0 != null) assert.equal(r.bp1 - r.bp0, 6000, JSON.stringify(r));
});

test('K-1063 BS46-RV003 Laten: End Step refreshes Investigators; BS46-RV005 Asia: losing an Investigator to the opponent draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); ${B}
    const l = BS.mkInst('BS46-RV003'); l.cores = 3; const inv = BS.mkInst(${invS}); inv.exhausted = true; P.spirits = [l, inv]; G.step = 7;
    await BS.fireFx(P, 'END_STEP', null, {}); const ref = !inv.exhausted;
    const a = BS.mkInst('BS46-RV005'); a.cores = 1; P.spirits = [a]; const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    P.deck = [1, 2, 3].map(() => BS.mkInst(any)); const h0 = P.hand.length;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: BS.mkInst(${invS}), byOpp: true, byOppFx: true });
    return { ref, drew: P.hand.length - h0 }; })()`);
  assert.equal(r.ref, true, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r));
});

const INDRA = 'BS75-CX03';

test('K-1064 BS75-044 Manevajra: an opposing destroy sends one Life core to a Thunderive Spirit and it remains; BS75-068 Temple LV2: a Void core goes to Life, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = O.key;
    const th = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Thunderive') && k !== 'BS75-044');
    const m = BS.mkInst('BS75-044'); m.cores = 1; const t = BS.mkInst(th); t.cores = 1; P.spirits = [m, t]; P.nexus = []; P.life = 5;
    BS.removeSpirit(P, t, 'destroyed', true);
    const stay = P.spirits.includes(t), life1 = P.life, cores = t.cores;
    P.nexus = [BS.mkInst('BS75-068')]; P.nexus[0].cores = 1; P.spirits = [t]; P.void = 3; P.life = 1; P.nexus[0].leaveTurn = 0;
    BS.removeSpirit(P, t, 'destroyed', true); const life2 = P.life; P.spirits = [t]; BS.removeSpirit(P, t, 'destroyed', true);
    return { stay, life1, cores, life2, life3: P.life, p44: BS.CARDS['BS75-044'].partial, p68: BS.CARDS['BS75-068'].partial, cx: BS.CARDS['${INDRA}'].partial }; })()`);
  assert.equal(r.stay, true, JSON.stringify(r)); assert.equal(r.life1, 4, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r));
  assert.equal(r.life2, 2, JSON.stringify(r)); assert.equal(r.life3, 2, JSON.stringify(r));
  assert.equal(r.p44, false); assert.equal(r.p68, false); assert.equal(r.cx, false);
});

test('K-1065 BS76-076 Ward Tower: Life hit puts a core on Contractor Indra; LV2 draws two from the deckbottom when an opposing can\'t attack/block Spirit leaves', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS76-076'); w.cores = 1; const ind = BS.mkInst('${INDRA}'); ind.cores = 0; P.nexus = [w, ind]; P.reserve.n = 3;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token); const at = BS.mkInst(any); P.spirits = [at];
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: at, subject: at }); const c1 = ind.cores;
    const e = BS.mkInst(any); e.noAB = true; O.spirits = [e]; P.deck = [1, 2, 3, 4].map(() => BS.mkInst(any)); P.hand = [];
    BS.removeSpirit(O, e, 'destroyed', true);
    return { c1, hand: P.hand.length, deck: P.deck.length, p: BS.CARDS['BS76-076'].partial }; })()`);
  assert.equal(r.c1, 1, JSON.stringify(r)); assert.equal(r.hand, 2, JSON.stringify(r)); assert.equal(r.deck, 2, JSON.stringify(r)); assert.equal(r.p, false);
});

test('K-1066 BS76-050 Raishin Vajdra: Summoned sends six cores from opposing Grandwalker Nexuses to the Void; its attack returns a can\'t attack/block Spirit to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const v = BS.mkInst('BS76-050'); v.cores = 2; P.spirits = [v]; const gn = BS.mkInst('${INDRA}'); gn.cores = 7; O.nexus = [gn]; const v0 = O.void;
    await BS.fireFx(P, 'SUMMONED', v, { subject: v });
    const left = gn.cores, vo = O.void - v0;
    const a = BS.mkInst(any), b = BS.mkInst(any); a.cores = b.cores = 1; a.noAB = true; O.spirits = [a, b]; const d0 = O.deck.length; G.attacker = v;
    await BS.fireFx(P, 'ALLY_ATTACKS', v, { attacker: v, subject: v });
    return { left, vo, gone: !O.spirits.includes(a), kept: O.spirits.includes(b), deck: O.deck.length - d0, man: !!BS.CARDS['BS76-050'].manifest, p: BS.CARDS['BS76-050'].partial }; })()`);
  assert.equal(r.p, false); assert.equal(r.man, true); assert.equal(r.left, 1, JSON.stringify(r)); assert.equal(r.vo, 6, JSON.stringify(r));
  assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.kept, true, JSON.stringify(r)); assert.equal(r.deck, 1, JSON.stringify(r));
});

test('K-1067 BS76-088 Spread Lightning: cost -2 per opposing can\'t attack/block Spirit (max -6); Flash returns one, or three with Contractor Indra', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token); const mk = n => { const x = BS.mkInst(any); x.cores = 1; x.noAB = n; return x; };
    const c = BS.CARDS['BS76-088']; O.spirits = []; const c0 = BS.effCost(P, c); O.spirits = [mk(true), mk(true)]; const c2 = BS.effCost(P, c); O.spirits = [1, 2, 3, 4, 5].map(() => mk(true)); const c5 = BS.effCost(P, c);
    O.spirits = [mk(true), mk(true), mk(true), mk(false)]; P.nexus = []; P.reserve.n = 20; let m = BS.mkInst('BS76-088'); P.hand = [m];
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' }); const n1 = O.spirits.length;
    const ind = BS.mkInst('${INDRA}'); P.nexus = [ind]; O.spirits = [mk(true), mk(true), mk(true), mk(true), mk(false)]; m = BS.mkInst('BS76-088'); P.hand = [m]; P.reserve.n = 20;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { c0, c2, c5, n1, n2: O.spirits.length, p: c.partial }; })()`);
  assert.equal(r.p, false); assert.equal(r.c0, 7, JSON.stringify(r)); assert.equal(r.c2, 3, JSON.stringify(r)); assert.equal(r.c5, 1, JSON.stringify(r));
  assert.equal(r.n1, 3, JSON.stringify(r)); assert.equal(r.n2, 2, JSON.stringify(r));
});
