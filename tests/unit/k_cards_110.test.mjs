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
