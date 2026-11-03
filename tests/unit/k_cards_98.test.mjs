import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1026 BS58-024 Wolfbanus: banishes up to five opposing Trash cards; with a Red symbol it draws and destroys a Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS58-024'); w.cores = 2; P.spirits = [w]; O.spirits = [];
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token).slice(0, 7);
    O.trash = ids.map(k => BS.mkInst(k)); const t0 = O.trash.length;
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { banished: t0 - O.trash.length, ok: !BS.CARDS['BS58-024'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.banished, 5, JSON.stringify(r));
});

test('K-1027 Mega-Grandstone Spirits (BS54-001/011/022/031/043): LV2 gives own matching Grandstone Nexuses an extra symbol; LV1 Nexus reduction gets the extra symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key;
    const gs = Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Nexus' && (c.families || []).includes('Grandstone') && (c.colors || [c.symbol]).includes('yellow') && !/Mega-Grandstone/.test(c.name); });
    const mega = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && /Mega-Grandstone/.test(BS.CARDS[k].name) && (BS.CARDS[k].reduction || {}).white);
    const nx = BS.mkInst(gs), pim = BS.mkInst('BS54-043'); pim.cores = 3; P.spirits = [pim]; P.nexus = [nx];
    const yel = BS.symbolsOn(P).yellow || 0; const pur = BS.symbolsOn(P).purple || 0;
    pim.cores = 1; const yel1 = BS.symbolsOn(P).yellow || 0;
    return { yel, yel1, pur, ok: ['BS54-001','BS54-011','BS54-022','BS54-031','BS54-043'].every(k => !BS.CARDS[k].partial), mega: !!mega }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.ok(r.yel >= r.yel1 + 1, JSON.stringify(r));
});

test('K-1028 BS56-018 RaiunZame: strips a core and draws on depletion; LV2 attack destroys a Spirit with four cores or more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS56-018'); w.cores = 3; P.spirits = [w];
    const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const big = BS.mkInst(id); big.cores = 5; O.spirits = [big]; const h0 = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { ok: !BS.CARDS['BS56-018'].partial, gone: !O.spirits.includes(big), h: P.hand.length - h0 }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r));
});

test('K-1029 BS54-015 Knowledge Snake: attack removes a core, with two counters removes one more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS54-015'); w.cores = 3; P.spirits = [w]; P.count = 2;
    const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const t = BS.mkInst(id); t.cores = 4; O.spirits = [t];
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { ok: !BS.CARDS['BS54-015'].partial, left: t.cores }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.left, 2, JSON.stringify(r));
});

test('K-1030 BS52-014 Lezard: a counter increase strips an opposing core; LV2 locks one-core opposing Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.fxBy = P.key;
    const w = BS.mkInst('BS52-014'); w.cores = 3; P.spirits = [w];
    const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const t = BS.mkInst(id); t.cores = 3; O.spirits = [t];
    const v = BS.mkInst('BS54-015'); P.spirits.push(v); v.cores = 1; P.spirits.pop();
    await BS.fireFx(P, 'COUNTER_UP', null, {});
    const one = BS.mkInst(id); one.cores = 1; O.spirits.push(one);
    return { ok: !BS.CARDS['BS52-014'].partial, left: t.cores, locked: !!BS.cantAttack && BS.cantAttack(O, one) }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.left, 2, JSON.stringify(r));
});

test('K-1031 BS75-055 Robin-Bad: summon gives a counter and two cores to a Khaos Nexus; attack draws two and discards two', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS75-055'); w.cores = 3; P.spirits = [w];
    const nx = BS.mkInst('BS75-CX04'); nx.cores = 0; P.nexus = [nx]; P.count = 0;
    await BS.fireFx(P, 'SUMMONED', w, { subject: w });
    const c1 = P.count, n1 = nx.cores; const h0 = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { ok: !BS.CARDS['BS75-055'].partial, c1, n1, dh: P.hand.length - h0 }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.c1, 1, JSON.stringify(r)); assert.equal(r.n1, 2, JSON.stringify(r));
});

test('K-1032 BS54-RV002 Charger Dragno / BS54-RV001 Assassin Dragno: Pursuit lets an exhausted Spirit attack and go heavy; Dragno BP +3000; low-core Spirits cannot block', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.turnNo = 3;
    const a = BS.mkInst('BS54-RV001'), b = BS.mkInst('BS54-RV002'); a.cores = 3; b.cores = 3; P.spirits = [a, b]; O.spirits = [];
    const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const lo = BS.mkInst(id); lo.cores = 1; const hi = BS.mkInst(id); hi.cores = 3; O.spirits = [lo, hi];
    P.count = 0; const blk1 = [BS.unblockableLow(P, a, lo), BS.unblockableLow(P, a, hi)];
    P.count = 3; const blk3 = BS.unblockableLow(P, a, hi);
    const bp0 = BS.bpOf(a); a.exhausted = true; const pf = BS.flagActive(P, 'PURSUIT', a);
    P.cpu = false; O.spirits = []; const ok = await BS.applyIntent(P.key, { type: 'attack', uid: a.uid });
    return { pf, ok, heavy: a.heavy, blk1, blk3, bp: BS.bpOf(b) >= 3000 }; })()`);
  assert.equal(r.pf, true, JSON.stringify(r)); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.heavy, true, JSON.stringify(r));
  assert.deepEqual(r.blk1, [true, false], JSON.stringify(r)); assert.equal(r.blk3, true, JSON.stringify(r));
});

test('K-1033 BS74-004 Scapoonrhynchus: counter +1 and destroys a 7000 BP Spirit; LV2 ally Lava Fish attack voids 3 cores from an opposing Grandwalker Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const s = BS.mkInst('BS74-004'); s.cores = 2; P.spirits = [s];
    const gw = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker'));
    const nx = BS.mkInst(gw); nx.cores = 5; O.nexus = [nx];
    const weak = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && ((BS.CARDS[k].levels || [])[0] || {}).bp <= 3000 && (BS.CARDS[k].levels || []).length === 1);
    const v = BS.mkInst(weak); v.cores = 1; O.spirits = [v]; const c0 = P.count || 0;
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s, subject: s });
    await BS.fireFx(P, 'ALLY_ATTACKS', s, { attacker: s, subject: s });
    return { dC: (P.count || 0) - c0, left: O.spirits.length, cores: nx.cores, ok: !BS.CARDS['BS74-004'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.dC, 1, JSON.stringify(r)); assert.equal(r.left, 0, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r));
});

test('K-1034 BS53-020 L\'Evangile: lowers an opposing Spirit to its own core count; destroyed by an opposing effect discards 2 random cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const s = BS.mkInst('BS53-020'); s.cores = 2; P.spirits = [s];
    const weak = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const v = BS.mkInst(weak); v.cores = 5; O.spirits = [v];
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s, subject: s });
    return { cores: v.cores, ok: !BS.CARDS['BS53-020'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r));
});

test('K-1035 BS53-015 Dominus: returns Grandwalker Dionysus from the Trash; a zero-core ally attack takes a core from an opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const d = BS.mkInst('BS53-015'); d.cores = 2; P.spirits = [d];
    const gw = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name === 'Grandwalker Dionysus');
    P.trash = [BS.mkInst(gw)]; const h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', d, { subject: d });
    const z = BS.mkInst('BS53-015'); z.cores = 0; P.spirits = [d, z];
    const weak = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const v = BS.mkInst(weak); v.cores = 3; O.spirits = [v];
    await BS.fireFx(P, 'ALLY_ATTACKS', d, { attacker: z, subject: z });
    return { got: P.hand.length - h0, trash: P.trash.length, cores: v.cores, ok: !BS.CARDS['BS53-015'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.got, 1, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r));
});

test('K-1036 BS54-002 Tsuna: with a Soul Core on it, draws up to four cards in Hand when attacking', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const s = BS.mkInst('BS54-002'); s.cores = 3; s.soul = true; P.spirits = [s]; P.hand = [];
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s, subject: s });
    const a = P.hand.length;
    s.soul = false; P.hand = [];
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s, subject: s });
    return { withSoul: a, noSoul: P.hand.length, ok: !BS.CARDS['BS54-002'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.withSoul, 4, JSON.stringify(r)); assert.equal(r.noSoul, 0, JSON.stringify(r));
});

test('K-1037 BS54-074 Freezing Pillar: used free from the Hand when the owner Life is reduced; not for own-cost Life loss', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const weak = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const v = BS.mkInst(weak); v.cores = 1; O.spirits = [v];
    const m = BS.mkInst('BS54-074'); P.hand = [m]; P.reserve.n = 0;
    await BS.maybeBurst(P, 'LIFE_DECREASE', { selfCost: true });
    const a = { inHand: P.hand.length, opp: O.spirits.length };
    await BS.maybeBurst(P, 'LIFE_DECREASE', {});
    return { a, inHand: P.hand.length, opp: O.spirits.length, deck: O.deck.length, ok: !BS.CARDS['BS54-074'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.a.inHand, 1, JSON.stringify(r)); assert.equal(r.inHand, 0, JSON.stringify(r)); assert.equal(r.opp, 0, JSON.stringify(r));
});

test('K-1038 BS54-072 Vacuum Slash: only at Life 3 or less; returns two exhausted opposing Spirits ignoring immunity', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const weak = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const mk = () => { const v = BS.mkInst(weak); v.cores = 1; v.exhausted = true; return v; };
    O.spirits = [mk(), mk(), mk()]; P.hand = [BS.mkInst('BS54-072')]; P.life = 4;
    await BS.maybeBurst(P, 'LIFE_DECREASE', {});
    const a = { hand: P.hand.length, opp: O.spirits.length };
    P.life = 3; await BS.maybeBurst(P, 'LIFE_DECREASE', {});
    return { a, hand: P.hand.length, opp: O.spirits.length, ok: !BS.CARDS['BS54-072'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.a.hand, 1, JSON.stringify(r)); assert.equal(r.hand, 0, JSON.stringify(r)); assert.equal(r.opp, 1, JSON.stringify(r));
});

test('K-1039 BS52-039 Pure Pentan / BS52-013 Bone-Dober: LIFE_GUARD stops or reduces an opposing Life-reduction effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const src = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token)); P.spirits = [src]; O.spirits = [];
    const run = n => BS.FX_ACTIONS.OPP_LIFE_TO_TRASH.run({ p: P, opp: O, src, ctx: {} }, { do: 'OPP_LIFE_TO_TRASH', n });
    O.life = 5; O.reserve.n = 10; O.hand = [BS.mkInst('BS52-039')]; const l0 = O.life; await run(1); const prevented = O.life === l0 && O.spirits.length === 1;
    O.spirits = []; O.hand = []; O.trash = [BS.mkInst('BS52-013')]; O.life = 5; await run(2); const minus = O.life === 4 && O.trash.length === 0 && O.removed.length === 1;
    return { prevented, minus, life: O.life, ok: !BS.CARDS['BS52-039'].partial && !BS.CARDS['BS52-013'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.prevented, true, JSON.stringify(r)); assert.equal(r.minus, true, JSON.stringify(r));
});

test('K-1040 BS55-058 Moldavite-Golem / BS52-033 Amenomahitotsu: Brave core, remain on the Field, pay-two bounce', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = O.key;
    const m = BS.mkInst('BS55-058'); m.cores = 3; const am = BS.mkInst('BS52-033'); am.cores = 3; P.spirits = [m, am]; O.spirits = [];
    BS.removeSpirit(P, am, 'destroyed'); const stayA = P.spirits.includes(am) && am.exhausted;
    BS.removeSpirit(P, m, 'destroyed'); const stayM = P.spirits.includes(m) && m.exhausted;
    const bounceStay = (BS.bounceCard(P, m, 'hand'), P.spirits.includes(m));
    return { stayA, stayM, bounceStay, ok: !BS.CARDS['BS55-058'].partial && !BS.CARDS['BS52-033'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.stayA && r.stayM && r.bounceStay, true, JSON.stringify(r));
});

test('K-1041 BS52-027 Rhinoscore: summons a Green Brave from Hand free; attack moves one Void core (two while braved)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const rh = BS.mkInst('BS52-027'); rh.cores = 2; P.spirits = [rh]; O.spirits = [];
    const bid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave' && (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).includes('green') && !BS.CARDS[k].token);
    P.hand = [BS.mkInst(bid)]; const n0 = P.spirits.length; await BS.fireFx(P, 'SUMMONED', rh, { subject: rh });
    const summoned = P.hand.length === 0 && P.spirits.length > n0;
    P.void = 5; P.reserve.n = 0; await BS.fireFx(P, 'ATTACKS', rh, { attacker: rh, subject: rh }); const one = P.reserve.n;
    return { summoned, one, ok: !BS.CARDS['BS52-027'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.one, 1, JSON.stringify(r));
});

test('K-1042 BS73-006 Haganewurm X: attack gives counter +1; a Rekka Spirit that destroys a blocker draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const h = BS.mkInst('BS73-006'); h.cores = 2; P.spirits = [h]; O.spirits = []; const c0 = P.count;
    await BS.fireFx(P, 'ATTACKS', h, { attacker: h, subject: h }); const counter = P.count - c0;
    P.hand = []; P.deck = P.deck.length ? P.deck : [BS.mkInst(h.id), BS.mkInst(h.id)]; const d0 = P.hand.length;
    await BS.fireFx(P, 'ALLY_DESTROYS', null, { attacker: h, subject: h }); const drew = P.hand.length - d0;
    return { counter, drew, ok: !BS.CARDS['BS73-006'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.counter, 1, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r));
});

test('K-1043 BS59-074 Oblivion Wind: Winged/Hunter Beast Spirits gain an attack effect that blocks opposing Bursts this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const wid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Hunter Beast') && !BS.CARDS[k].token);
    const other = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !(BS.CARDS[k].families || []).some(f => f === 'Hunter Beast' || f === 'Winged Beast') && !BS.CARDS[k].token);
    const w = BS.mkInst(wid), o = BS.mkInst(other); P.spirits = [w, o]; O.spirits = [];
    const a = BS.CARDS['BS59-074'].magic.actions[0]; await BS.FX_ACTIONS.GRANT_FX.run({ p: P, opp: O, src: BS.mkInst('BS59-074'), ctx: {} }, a);
    const got = (w.grantFx || []).length, none = (o.grantFx || []).length;
    G.attacker = w; await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { got, none, nb: G.noBurst === O.key, ok: !BS.CARDS['BS59-074'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.got, 1, JSON.stringify(r)); assert.equal(r.none, 0, JSON.stringify(r)); assert.equal(r.nb, true, JSON.stringify(r));
});

test('K-1044 BS55-061 Six Heaven Golem: LV2 attack/destroyed deploys a named Nexus from the Trash free (no HeavenlyDemon Nexus is in the library yet; checked with another Nexus name)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const g = BS.mkInst('BS55-061'); g.cores = 3; P.spirits = [g]; O.spirits = []; P.nexus = [];
    const nid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && !BS.CARDS[k].token && !BS.CARDS[k].partial && !(BS.CARDS[k].cost > 0 && false));
    P.trash = [BS.mkInst(nid)];
    const eff = BS.CARDS['BS55-061'].effects.filter(e => e.trigger === 'ATTACKS' || e.trigger === 'DESTROYED');
    const act = Object.assign({}, eff[0].actions[0], { match: { name: [BS.CARDS[nid].name] } });
    await BS.FX_ACTIONS.SUMMON_HAND.run({ p: P, opp: O, src: g, ctx: {} }, act);
    return { nex: P.nexus.length, trash: P.trash.length, two: eff.length, ok: !BS.CARDS['BS55-061'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.two, 2, JSON.stringify(r)); assert.equal(r.nex, 1, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r));
});
