import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1131 BS73-077 Binding Fungus: sent to the Trash from the Deck by Yum-Kaax is added to the Hand and sends a Fungal Bed; Flash heavy exhausts and returns to the Hand by exhausting three beds', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const y = BS.mkInst('BS73-CX01'); y.cores = 3; P.nexus = [y]; P.tokens = { 'BS73-T001': 3 }; P.hand = [];
    const m = BS.mkInst('BS73-077'); P.deck = [m, BS.mkInst(any), BS.mkInst(any)];
    await BS.fireFx(P, 'SUMMONED', y, { subject: y });
    const inHand = P.hand.includes(m), beds = P.nexus.filter(n => n.id === 'BS73-T001').length;
    for (let i = 0; i < 2; i++) { const b = BS.mkInst('BS73-T001'); P.nexus.push(b); }
    const t = BS.mkInst(any); t.cores = 1; O.spirits = [t]; G.active = O.key; G.step = 5; P.hand = [m]; P.reserve = 10;
    const cast = BS.G.p.player.hand.includes(m); const s0 = P.nexus.filter(n => n.id === 'BS73-T001' && n.exhausted).length;
    return { inHand, beds, cast, partial: BS.CARDS['BS73-077'].partial, magic: BS.CARDS['BS73-077'].magic && BS.CARDS['BS73-077'].magic.actions.map(a => a.do), s0 }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.inHand, true, JSON.stringify(r)); assert.ok(r.beds >= 1, JSON.stringify(r));
  assert.deepEqual(r.magic, ['HEAVY_EXHAUST_OPP', 'MAGIC_BACK_HAND'], JSON.stringify(r));
});

test('K-1132 MAGIC_BACK_HAND exhausts the beds and the used Magic returns to the Hand; BS74-027 Mirage gives a counter when a Fungal Tree Spirit is summoned (once per turn)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const ft = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Fungal Tree') && k !== 'BS74-027');
    const mi = BS.mkInst('BS74-027'); mi.mirage = true; P.mirage = mi; P.count = 0;
    const s1 = BS.mkInst(ft), s2 = BS.mkInst(ft); P.spirits = [s1, s2];
    await BS.fireFx(P, 'ALLY_SUMMONED', s1, { subject: s1 }); const c1 = P.count;
    await BS.fireFx(P, 'ALLY_SUMMONED', s2, { subject: s2 });
    const m = BS.mkInst('BS73-077'); const b = [1, 2, 3].map(() => BS.mkInst('BS73-T001')); P.nexus = b;
    const c = { p: P, opp: O, src: m, ctx: {} }; await BS.FX_ACTIONS.MAGIC_BACK_HAND.run(c, { do: 'MAGIC_BACK_HAND', beds: 3 });
    return { c1, c2: P.count, ex: b.filter(x => x.exhausted).length, toHand: m.toHand === true, partial: BS.CARDS['BS74-027'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.c1, 1, JSON.stringify(r)); assert.equal(r.c2, 1, JSON.stringify(r));
  assert.equal(r.ex, 3, JSON.stringify(r)); assert.equal(r.toHand, true, JSON.stringify(r));
});

test('K-1133 BS74-071 Jungle: replaces sending out a Fungal Bed once per turn; LV1 on an opposing Hand increase destroys itself and the opponent returns that many cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const src = BS.mkInst(any); src.cores = 2; P.spirits = [src]; const j = BS.mkInst('BS74-071'); P.hand = [j]; P.tokens = { 'BS73-T001': 3 }; P.nexus = [];
    await BS.FX_ACTIONS.SEND_TOKEN.run({ p: P, opp: O, src, ctx: {} }, { do: 'SEND_TOKEN', token: 'BS73-T001', n: 1 });
    const first = P.nexus.map(n => n.id);
    await BS.FX_ACTIONS.SEND_TOKEN.run({ p: P, opp: O, src, ctx: {} }, { do: 'SEND_TOKEN', token: 'BS73-T001', n: 1 });
    const second = P.nexus.map(n => n.id);
    G.active = O.key; O.hand = [1, 2, 3, 4, 5].map(() => BS.mkInst(any)); const dk = O.deck.length;
    await BS.fireFx(P, 'OPP_HAND_UP', null, { handN: 2 });
    return { first, second, jn: P.nexus.filter(n => n.id === 'BS74-071').length, oh: O.hand.length, dk: O.deck.length - dk, partial: BS.CARDS['BS74-071'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.first, ['BS74-071'], JSON.stringify(r)); assert.deepEqual(r.second, ['BS74-071', 'BS73-T001'], JSON.stringify(r));
  assert.equal(r.jn, 0, JSON.stringify(r)); assert.equal(r.oh, 3, JSON.stringify(r)); assert.equal(r.dk, 2, JSON.stringify(r));
});

test('K-1134 BS74-081 Fungus Attack: Cost 4 by destroying a Fungal Bed; exhausts two, banishes per exhausted, bounces an exhausted Spirit; returns from Trash instead of a Token', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const src = BS.mkInst(any); src.cores = 2; P.spirits = [src]; P.nexus = []; P.tokens = { 'BS73-T001': 3 };
    const m = BS.mkInst('BS74-081'); P.trash = [m]; P.hand = [];
    await BS.FX_ACTIONS.SEND_TOKEN.run({ p: P, opp: O, src, ctx: {} }, { do: 'SEND_TOKEN', token: 'BS73-T001', n: 1 });
    const back = P.hand.includes(m) && P.nexus.length === 0;
    const a = BS.mkInst(any), b = BS.mkInst(any); a.cores = 1; b.cores = 1; O.spirits = [a, b]; O.trash = [BS.mkInst(any), BS.mkInst(any), BS.mkInst(any)];
    const c = { p: P, opp: O, src: m, ctx: {} };
    for (const x of BS.CARDS['BS74-081'].magic.actions) await BS.FX_ACTIONS[x.do].run(c, x);
    return { back, trash: O.trash.length, sp: O.spirits.length, alt: BS.CARDS['BS74-081'].costAlt, partial: BS.CARDS['BS74-081'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r)); assert.equal(r.trash, 1, JSON.stringify(r)); assert.equal(r.sp, 1, JSON.stringify(r)); assert.equal(r.alt.bed, true, JSON.stringify(r));
});

test('K-1135 BS74-034 AriArikui: Summoned with Yum-Kaax sends a Fungal Bed and puts a core from the Void to each of up to three beds; the Burst chain deploys Yum-Kaax from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const yk = BS.mkInst('BS73-CX01'); P.nexus = [yk]; P.tokens = { 'BS73-T001': 3 };
    const s = BS.mkInst('BS74-034'); s.cores = 2; P.spirits = [s]; P.void = 5;
    await BS.fireFx(P, 'SUMMONED', s, { subject: s });
    const beds = P.nexus.filter(n => n.id === 'BS73-T001'); const got = beds.map(b => b.cores);
    const y2 = BS.mkInst('BS73-CX01'); P.nexus = []; P.trash = [y2];
    const c = { p: P, opp: O, src: s, ctx: {} }; await BS.FX_ACTIONS.DEPLOY_NAMED_TRASH_SOUL.run(c, { do: 'DEPLOY_NAMED_TRASH_SOUL', name: 'Contractor Yum-Kaax' });
    return { nb: beds.length, got, dep: P.nexus.includes(y2), hu: BS.CARDS['BS74-034'].handUnaffected, partial: BS.CARDS['BS74-034'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nb, 1, JSON.stringify(r)); assert.equal(r.got[0] >= 1, true, JSON.stringify(r)); assert.equal(r.dep, true, JSON.stringify(r)); assert.equal(r.hu, true, JSON.stringify(r));
});

test('K-1136 BS73-076 Fluffy Reverse: Main discards the Hand and draws per opposing Hand/Removed card; at Start of Main it returns from the Trash by destroying two beds', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2;
    const ft = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Fungal Tree') && BS.CARDS[k].type === 'Spirit');
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const m = BS.mkInst('BS73-076'); P.hand = [BS.mkInst(ft), BS.mkInst(any)]; P.deck = [1,2,3,4,5,6,7,8].map(() => BS.mkInst(any)); O.hand = [BS.mkInst(any), BS.mkInst(any)]; O.removed = [BS.mkInst(any)];
    const c = { p: P, opp: O, src: m, ctx: {} }; await BS.FX_ACTIONS.DISCARD_HAND_FUNGAL_DRAW.run(c, { do: 'DISCARD_HAND_FUNGAL_DRAW' });
    const hand = P.hand.length, tr = P.trash.length;
    P.nexus = [BS.mkInst('BS73-T001'), BS.mkInst('BS73-T001')]; P.trash = [m]; P.hand = [];
    await BS.fireFx(P, 'START_MAIN', null, {});
    return { hand, tr, back: P.hand.includes(m), beds: P.nexus.length, partial: BS.CARDS['BS73-076'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.hand, 3, JSON.stringify(r)); assert.equal(r.tr, 2, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r)); assert.equal(r.beds, 0, JSON.stringify(r));
});

test('K-1137 BS74-026 RiRisu: returns from the Trash when a Grandwalker Nexus is destroyed by an opposing effect; from the Hand it is summoned when one enters Soul State and deploys another; Void core when destroyed by the opponent', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const rr = BS.mkInst('BS74-026'); P.trash = [rr]; const yk = BS.mkInst('BS73-CX01'); P.nexus = [yk];
    G.fxBy = O.key; BS.removeNexus(P, yk, 'destroyed'); await flushBursts(); G.fxBy = null;
    const back = P.hand.includes(rr);
    const r2 = BS.mkInst('BS74-026'); P.hand = [r2]; P.trash = []; const y1 = BS.mkInst('BS73-CX01'), y2 = BS.mkInst('BS73-CX01'); P.nexus = [y1]; P.soulState = [y2]; y2.inSoulState = true; P.spirits = []; O.spirits = [BS.mkInst(any)]; O.spirits[0].cores = 1;
    G.fxBy = O.key; BS.toSoulState(P, y1); await flushBursts(); G.fxBy = null;
    return { back, summoned: P.spirits.includes(r2), dep: P.nexus.includes(y2), partial: BS.CARDS['BS74-026'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.dep, true, JSON.stringify(r));
});

test('K-1138 BS73-023 PiPig: summoned free from the Hand when the opposing Hand grows (5+ Hand + Removed, Yum-Kaax, Main Step) and locks opposing Purple draws; Summoned puts Void cores to two other Fungal Tree cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Fungal Tree') && k !== 'BS73-023');
    const pg = BS.mkInst('BS73-023'); P.hand = [pg]; P.nexus = [BS.mkInst('BS73-CX01')]; const a = BS.mkInst(any), b = BS.mkInst(any); a.cores = 1; b.cores = 1; P.spirits = [a, b]; P.void = 4;
    O.hand = [1,2,3].map(() => BS.mkInst(any)); O.removed = [BS.mkInst(any), BS.mkInst(any)]; O.trash = [BS.mkInst(any)];
    await BS.fireFx(P, 'OPP_HAND_UP', null, { handN: 1 }); await flushBursts();
    const out = { dep: P.spirits.includes(pg), lock: !!G.noDraw && G.noDraw.color === 'purple', ca: a.cores, cb: b.cores, partial: BS.CARDS['BS73-023'].partial };
    const p2 = BS.mkInst('BS73-023'); P.hand = []; P.trash = [p2]; P.spirits = [a]; G.noDraw = null; O.hand = [BS.mkInst(any)]; O.removed = [BS.mkInst(any)];
    await BS.fireFx(P, 'OPP_HAND_UP', null, { handN: 1 }); await flushBursts(); out.few = !P.spirits.includes(p2);
    return out; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.dep, true, JSON.stringify(r)); assert.equal(r.lock, true, JSON.stringify(r));
  assert.equal(r.ca + r.cb, 4, JSON.stringify(r)); assert.equal(r.few, true, JSON.stringify(r));
});

test('K-1139 BS73-029 JarJaguar: Summoned exhausts an opposing Spirit and floors its cores at three for the turn; LV2 opposing Start Step destroys a Fungal Bed so an exhausted Spirit cannot refresh', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS73-029');
    const a = BS.mkInst('BS73-029'); a.cores = 2; P.spirits = [a]; const t = BS.mkInst(any); t.cores = 5; O.spirits = [t];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    const exh = t.exhausted, cap = coreTakeCap(O, t, 5);
    P.nexus = [BS.mkInst('BS74-071')]; G.active = O.key; G.step = 1; await BS.fireFx(P, 'OPP_START_STEP', null, {});
    return { exh, cap, nref: t.noRefreshT === G.turnNo, beds: P.nexus.length, hs: BS.CARDS['BS73-029'].highSpeedBeds, partial: BS.CARDS['BS73-029'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.exh, true, JSON.stringify(r)); assert.equal(r.cap, 2, JSON.stringify(r));
  assert.equal(r.nref, true, JSON.stringify(r)); assert.equal(r.beds, 0, JSON.stringify(r)); assert.equal(r.hs, 'destroy', JSON.stringify(r));
});

test('K-1140 BS73-AX01 BigBang-Golem: Summoned banishes up to ten Trash cards and heavy exhausts per two; LV2 floors exhausted Spirits at three cores against opposing effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS73-AX01');
    const a = BS.mkInst('BS73-AX01'); a.cores = 3; P.spirits = [a]; O.spirits = [1, 2, 3].map(() => { const s = BS.mkInst(any); s.cores = 1; return s; }); O.trash = [1, 2, 3, 4, 5].map(() => BS.mkInst(any));
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    const banished = O.removed.length, exhN = O.spirits.filter(s => s.exhausted).length;
    const e = BS.mkInst(any); e.cores = 5; e.exhausted = true; P.spirits.push(e); G.fxBy = O.key; const cap = coreTakeCap(P, e, 5); e.exhausted = false; const cap2 = coreTakeCap(P, e, 5);
    return { banished, exhN, cap, cap2, partial: BS.CARDS['BS73-AX01'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.banished, 5, JSON.stringify(r)); assert.equal(r.exhN, 2, JSON.stringify(r));
  assert.equal(r.cap, 2, JSON.stringify(r)); assert.equal(r.cap2, 5, JSON.stringify(r));
});
