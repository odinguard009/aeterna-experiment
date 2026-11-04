import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1107 BS69-033 Guneus: Burst after an opposing Summoned effect summons it and heavy exhausts two; a set copy also activates when cards go to the opposing Removed Zone; Summoned bounces an exhausted Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost <= 3 && k !== 'BS69-033');
    const b = BS.mkInst('BS69-033'); P.burst = b; P.spirits = [];
    const t1 = BS.mkInst(any), t2 = BS.mkInst(any); t1.cores = t2.cores = 2; O.spirits = [t1, t2];
    await BS.maybeBurst(P, 'OPP_REMOVED', {});
    return { summoned: P.spirits.includes(b), heavy: [t1, t2].filter(t => t.heavy).length, left: O.spirits.length, also: BS.CARDS['BS69-033'].burst.also.when, partial: BS.CARDS['BS69-033'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.also, 'OPP_REMOVED', JSON.stringify(r));
  assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.heavy, 1, JSON.stringify(r)); assert.equal(r.left, 1, JSON.stringify(r));   // both heavy exhausted, then the Summoned effect returns one exhausted Spirit to the deck bottom
});

test('K-1108 BS69-067 Gaia\'s Crust Temple: ally Primordial attack gives counter +1 (<=4) or a core to Contractor Gaia (>=5), once per turn; Lv2 destroyed destroys a 15000 BP or less opposing Spirit and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const prim = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Primordial'));
    const gaia = 'BS69-CX01';
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels[0].bp <= 15000);
    const n = BS.mkInst('BS69-067'); n.cores = 2; const g = BS.mkInst(gaia); g.cores = 1; P.nexus = [n, g]; const a = BS.mkInst(prim); a.cores = 1; P.spirits = [a]; P.count = 2;
    await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a, subject: a }); const c1 = P.count;
    n.fxUsed = {};
    P.count = 5; P.reserve.n = 3; const before = g.cores; await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a, subject: a }); const gc = g.cores - before;
    const t = BS.mkInst(any); t.cores = 1; O.spirits = [t]; P.deck = [1,2,3].map(() => BS.mkInst(any)); const h = P.hand.length; P.nexus = [g]; n.lostLv = 1; P.trash.push(n);
    await BS.fireFx(P, 'DESTROYED', n, { subject: n });
    return { c1, gc, gone: !O.spirits.includes(t), drew: P.hand.length - h, partial: BS.CARDS['BS69-067'].partial, prim, gaia }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.c1, 3, JSON.stringify(r)); assert.equal(r.gc, 1, JSON.stringify(r));
  assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r));
});

test('K-1109 BS69-032 Proacher-Choukaku: Flash from Hand needs a Primordial/Gaudy Trooper on the field (once per turn); Summoned reveals two and deploys matching free; Lv2 ally attack heavy exhausts', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.phase = 'attack';
    const prim = 'BS69-001', other = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).some(f => f === 'Primordial' || f === 'Gaudy Trooper') && BS.CARDS[k].cost <= 3);
    const h = BS.mkInst('BS69-032'); P.hand = [h]; P.reserve.n = 12; P.spirits = [BS.mkInst(other)];
    const noCtrl = BS.highSpeedOK(P, h);
    const a = BS.mkInst(prim); a.cores = 1; P.spirits = [a]; const withCtrl = BS.highSpeedOK(P, h);
    const me = BS.mkInst('BS69-032'); me.cores = 5; P.spirits = [a, me]; P.deck = [BS.mkInst(prim), BS.mkInst(other), BS.mkInst(prim)]; const before = P.spirits.length;
    await BS.fireFx(P, 'SUMMONED', me, { subject: me });
    const t = BS.mkInst(other); t.cores = 2; O.spirits = [t];
    await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a, subject: a });
    return { noCtrl, withCtrl, grew: P.spirits.length - before, heavy: !!t.heavy, partial: BS.CARDS['BS69-032'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.noCtrl, false, JSON.stringify(r)); assert.equal(r.withCtrl, true, JSON.stringify(r));
  assert.ok(r.grew >= 1, JSON.stringify(r)); assert.equal(r.heavy, true, JSON.stringify(r));
});

test('K-1110 BS69-NX01 Gigatoncheir: cost -2 per Nexus (field + both Trashes, max -12); attack destroys own Nexuses for opposing Spirits; the opponent either destroys a Spirit or loses Magic/Accel', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const nx = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && !BS.CARDS[k].token);
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost <= 3);
    const card = BS.CARDS['BS69-NX01']; const base = BS.effCost(P, card);
    P.nexus = [BS.mkInst(nx)]; P.trash = [BS.mkInst(nx)]; O.trash = [BS.mkInst(nx)]; const cut = base - BS.effCost(P, card);
    const a = BS.mkInst('BS69-NX01'); a.cores = 5; P.spirits = [a]; P.count = 8;
    const t1 = BS.mkInst(any), t2 = BS.mkInst(any), t3 = BS.mkInst(any); t1.cores = t2.cores = t3.cores = 2; O.spirits = [t1, t2, t3];
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a }); G.attacker = a;
    return { cut, nexusLeft: P.nexus.length, oppLeft: O.spirits.length, locked: O.noAccelB === G.battleNo || O.noMagicB != null, partial: card.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.cut, 6, JSON.stringify(r)); assert.equal(r.nexusLeft, 0, JSON.stringify(r));
  assert.ok(r.oppLeft <= 1, JSON.stringify(r));
});

test('K-1111 BS69-031 Leonteus: Summoned sends one opposing Spirit to Removed; Attacks returns a Cost 7+ Removed card to the deckbottom and puts two Void cores on Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const lo = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost <= 3), hi = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost >= 7);
    const a = BS.mkInst('BS69-031'); a.cores = 3; P.spirits = [a]; const t = BS.mkInst(lo); O.spirits = [t]; G.attacker = a; P.hand = []; P.reserve.n = 0;
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    const sent = O.removed.length, gone = !O.spirits.includes(t);
    O.removed = [BS.mkInst(hi)]; const dk = O.deck.length, c0 = a.cores; P.void = P.void || { n: 0 }; 
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { sent, gone, removed: O.removed.length, deck: O.deck.length - dk, partial: BS.CARDS['BS69-031'].partial, gained: a.cores - c0, mani: !!BS.CARDS['BS69-031'].manifest }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.sent, 1, JSON.stringify(r));
  assert.equal(r.removed, 0, JSON.stringify(r)); assert.equal(r.deck, 1, JSON.stringify(r)); assert.equal(r.mani, true, JSON.stringify(r));
});

test('K-1112 BS69-X01 Typhodeus: Attacks deploys a Primordial Nexus from Hand, takes two cores from a Primordial Grandwalker Nexus and destroys a Spirit with two or fewer symbols; manifest targets that Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const lo = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].symbols <= 2 && BS.CARDS[k].cost <= 3);
    const nxId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Primordial') && !(BS.CARDS[k].families || []).includes('Grandwalker'));
    const a = BS.mkInst('BS69-X01'); a.cores = 3; P.spirits = [a]; const gw = BS.mkInst('BS69-CX01'); gw.cores = 4; P.nexus = [gw];
    const h = BS.mkInst(nxId); P.hand = [h]; const t = BS.mkInst(lo); O.spirits = [t]; G.attacker = a; G.p.player.count = 8;
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { deployed: P.nexus.includes(h), gwCores: gw.cores, aCores: a.cores, gone: !O.spirits.includes(t), partial: BS.CARDS['BS69-X01'].partial, mani: BS.CARDS['BS69-X01'].manifest }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.deployed, true, JSON.stringify(r)); assert.equal(r.gwCores, 3, JSON.stringify(r));
  assert.equal(r.aCores, 5, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r)); assert.deepEqual(r.mani.nexusFamily, ['Primordial', 'Grandwalker'], JSON.stringify(r));
});

test('K-1113 BS69-CX01 Gaia: other Primordial Nexus deployed gives a counter and one draw per turn; Flash destroys a Nexus and refreshes a Primordial Spirit at 6 counters', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const nxId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Primordial') && !(BS.CARDS[k].families || []).includes('Grandwalker'));
    const prim = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Primordial'));
    const g = BS.mkInst('BS69-CX01'); g.cores = 6; g.fxUsed = {}; P.onceUsed = {}; P.nexus = [g]; P.count = 0; P.deck = [1,2,3,4,5].map(() => BS.mkInst(prim)); P.hand = [];
    const o = BS.mkInst(nxId); P.nexus.push(o);
    await BS.fireFx(P, 'ALLY_SUMMONED', g, { subject: o }); const c1 = P.count, h1 = P.hand.length;
    await BS.fireFx(P, 'ALLY_SUMMONED', g, { subject: o }); const c2 = P.count, h2 = P.hand.length;
    P.count = 6; const s = BS.mkInst(prim); s.exhausted = true; s.cores = 1; P.spirits = [s]; g.cores = 6; const on = BS.mkInst(nxId); O.nexus = [on]; G.step = 5;
    const idx = BS.CARDS['BS69-CX01'].effects.findIndex(e => e.trigger === 'ACTIVATE'); const ok = await BS.activateFx(P, g, idx);
    return { c1, h1, c2, h2, ok, oppNexus: O.nexus.length, refreshed: !s.exhausted, partial: BS.CARDS['BS69-CX01'].partial, revive: BS.CARDS['BS69-CX01'].revive }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.c1, 1, JSON.stringify(r)); assert.equal(r.h1, 1, JSON.stringify(r)); assert.equal(r.c2, 2, JSON.stringify(r)); assert.equal(r.h2, 1, JSON.stringify(r));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.oppNexus, 0, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r)); assert.equal(r.revive, true, JSON.stringify(r));
});

test('K-1114 BS70-001 Shakson Geosoldier: when your Nexus is destroyed it can be summoned from the Hand by paying one cost, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = O.key;
    const nxId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && !BS.CARDS[k].token);
    const c = BS.mkInst('BS70-001'); P.hand = [c]; P.spirits = []; P.onceUsed = {}; P.reserve.n = 4;
    const nx = BS.mkInst(nxId); P.nexus = [nx];
    await BS.fireFx(P, 'ALLY_NEXUS_DESTROYED', nx, { subject: nx });
    return { summoned: P.spirits.includes(c), handLeft: P.hand.includes(c), partial: BS.CARDS['BS70-001'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.handLeft, false, JSON.stringify(r));
});

test('K-1115 BS70-003 Gecko Geozard: a Primordial Nexus destroyed by your own effect stays when this Spirit is destroyed instead; an opposing effect destroys it normally', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const nxId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Primordial') && !BS.CARDS[k].token);
    const a = BS.mkInst('BS70-003'); a.cores = 3; P.spirits = [a]; const n1 = BS.mkInst(nxId); P.nexus = [n1];
    G.fxBy = P.key; BS.removeNexus(P, n1, 'destroyed'); const kept = P.nexus.includes(n1), gone = !P.spirits.includes(a);
    const b = BS.mkInst('BS70-003'); b.cores = 3; P.spirits = [b]; const n2 = BS.mkInst(nxId); P.nexus = [n2];
    G.fxBy = O.key; BS.removeNexus(P, n2, 'destroyed');
    return { kept, gone, oppKept: P.nexus.includes(n2), bStays: P.spirits.includes(b), partial: BS.CARDS['BS70-003'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.kept, true, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r));
  assert.equal(r.oppKept, false, JSON.stringify(r)); assert.equal(r.bStays, true, JSON.stringify(r));
});

test('K-1116 BS70-004 Nogihara Geozard: reveals two (three at six counters), adds a Primordial Nexus, discards the rest; draws when your Nexus is destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 3;
    const nxId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Primordial') && !BS.CARDS[k].token);
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Primordial'));
    const a = BS.mkInst('BS70-004'); a.cores = 3; P.spirits = [a]; P.hand = []; P.trash = []; P.onceUsed = {}; P.count = 0;
    P.deck = [BS.mkInst(any), BS.mkInst(any), BS.mkInst(nxId), BS.mkInst(any), BS.mkInst(any)];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); const first = { hand: P.hand.length, trash: P.trash.length };
    P.onceUsed = {}; a.fxUsed = {}; P.count = 6; P.hand = []; P.trash = []; P.deck = [BS.mkInst(any), BS.mkInst(any), BS.mkInst(nxId), BS.mkInst(any)];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); const second = { hand: P.hand.length, trash: P.trash.length };
    P.hand = []; P.deck = [BS.mkInst(any), BS.mkInst(any)]; const nx = BS.mkInst(nxId); P.nexus = [nx]; await BS.fireFx(P, 'ALLY_NEXUS_DESTROYED', a, { subject: nx });
    return { first, second, drew: P.hand.length, partial: BS.CARDS['BS70-004'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.first, { hand: 0, trash: 2 }, JSON.stringify(r)); assert.deepEqual(r.second, { hand: 1, trash: 2 }, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r));
});

test('K-1117 BS70-048 HighEvo-Frost: Attacks gives a counter and adds a revealed Burst card; its Burst returns a LV2 Spirit to the deckbottom and summons itself', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const bu = Object.keys(BS.CARDS).find(k => BS.CARDS[k].burst && BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const a = BS.mkInst('BS70-048'); a.cores = 3; P.spirits = [a]; P.hand = []; P.count = 0; P.deck = [BS.mkInst(bu), BS.mkInst(bu)]; G.attacker = a;
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    const c = BS.CARDS['BS70-048'];
    return { count: P.count, hand: P.hand.length, when: c.burst && c.burst.when, summon: c.burst.actions.some(x => x.do === 'SUMMON_SELF'), partial: c.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.count, 1, JSON.stringify(r)); assert.equal(r.hand, 1, JSON.stringify(r));
  assert.equal(r.when, 'LIFE_DECREASE', JSON.stringify(r)); assert.equal(r.summon, true, JSON.stringify(r));
});

test('K-1118 BS60-003 Ryuukin: Summoned destroys a 3000 BP or less Spirit or a Nexus; Attacks with six counters banishes itself to draw three', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const lo = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].levels[0].bp || 0) <= 3000 && (BS.CARDS[k].levels[0].bp || 0) > 0);
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const a = BS.mkInst('BS60-003'); a.cores = 3; P.spirits = [a]; const t = BS.mkInst(lo); t.cores = 1; O.spirits = [t]; O.nexus = [];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); const killed = !O.spirits.includes(t);
    P.count = 6; P.hand = []; P.deck = [1,2,3,4].map(() => BS.mkInst(any)); G.attacker = a;
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { killed, hand: P.hand.length, banished: P.removed.includes(a), gone: !P.spirits.includes(a), partial: BS.CARDS['BS60-003'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.killed, true, JSON.stringify(r)); assert.equal(r.hand, 3, JSON.stringify(r));
  assert.equal(r.banished, true, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r));
});

test('K-1119 BS70-002 Saber Gurnard: Summoned destroys two Cost 3 or less Nexuses; set as Mirage it stops opposing effects returning your Scarlet Flame Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nxId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && BS.CARDS[k].cost <= 3);
    const a = BS.mkInst('BS70-002'); a.cores = 1; P.spirits = [a]; O.nexus = [BS.mkInst(nxId), BS.mkInst(nxId), BS.mkInst(nxId)];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    const left = O.nexus.length;
    const sf = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Scarlet Flame'));
    const s = BS.mkInst(sf); P.spirits = [s]; P.mirage = null;
    const before = BS.flagActive(P, 'NO_RETURN', s);
    const m = BS.mkInst('BS70-002'); m.mirage = true; P.mirage = m;
    const after = BS.flagActive(P, 'NO_RETURN', s);
    return { left, before, after, partial: BS.CARDS['BS70-002'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.left, 1, JSON.stringify(r)); assert.equal(r.before, false, JSON.stringify(r)); assert.equal(r.after, true, JSON.stringify(r));
});

test('K-1120 BS65-003 Kirihoubou: as set Mirage a Scarlet Flame effect discarding your Hand gives counter +1 and one draw per turn; BS68-001 Attacks counts and summons a Cost 3 Scarlet Flame from Hand with Bladra', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const sf = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Scarlet Flame'));
    const m = BS.mkInst('BS65-003'); m.mirage = true; P.mirage = m; const src = BS.mkInst(sf); P.spirits = [src];
    P.count = 0; P.hand = [BS.mkInst(any), BS.mkInst(any)]; P.deck = [1,2,3].map(() => BS.mkInst(any));
    const c = { p: P, opp: O, src, ctx: {} };
    await BS.runActions(c, { actions: [{ do: 'DISCARD_HAND', n: 1 }] }, 'ATTACKS'); const one = { count: P.count, hand: P.hand.length };
    await BS.runActions(c, { actions: [{ do: 'DISCARD_HAND', n: 1 }] }, 'ATTACKS'); const two = { count: P.count, hand: P.hand.length };
    return { one, two, partial: BS.CARDS['BS65-003'].partial, p2: BS.CARDS['BS68-001'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.p2, false, JSON.stringify(r));
  assert.deepEqual(r.one, { count: 1, hand: 2 }, JSON.stringify(r)); assert.deepEqual(r.two, { count: 2, hand: 1 }, JSON.stringify(r));
});

test('K-1121 BS62-011 Scapanolancer: Attacks destroys one 12000- Spirit, or three when a Lava Fish pre-advent card is discarded; Contract Advent accepts a Lava Fish target; OC Flash returns a Lava Fish Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const low = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels && BS.CARDS[k].levels[0].bp <= 5000 && BS.CARDS[k].cost <= 3 && !k.startsWith('TRAIN'));
    const fish = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Lava Fish') && BS.CARDS[k].cost >= 3 && k !== 'BS62-011');
    const a = BS.mkInst('BS62-011'); a.cores = 3; P.spirits = [a]; O.spirits = [1,2,3,4].map(() => { const x = BS.mkInst(low); x.cores = 1; return x; }); G.attacker = a;
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a }); const one = O.spirits.length;
    a.under = [BS.mkInst(fish)]; O.spirits = [1,2,3,4].map(() => { const x = BS.mkInst(low); x.cores = 1; return x; });
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a }); const three = O.spirits.length, under = a.under.length;
    const f = BS.mkInst(fish); const adv = BS.mkInst('BS62-011'); P.hand = [adv]; P.spirits = [f]; P.count = 4; const tg = BS.contractAdventTargets ? BS.contractAdventTargets(P, adv, 'flash').length : -1;
    return { one, three, under, tg, partial: BS.CARDS['BS62-011'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.one, 3, JSON.stringify(r)); assert.equal(r.three, 1, JSON.stringify(r)); assert.equal(r.under, 0, JSON.stringify(r));
  assert.equal(r.tg, 1, JSON.stringify(r));
});

test('K-1122 BS74-AX01 Mudou: Soul Drive sends the Soul Core to Ometeotl Nexus and two opposing Lives go to the Void; LV3 destroys three', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const a = BS.mkInst('BS74-AX01'); a.cores = 9; P.spirits = [a]; G.attacker = a;
    const nx = BS.mkInst('BS74-CX01'); nx.cores = 1; P.nexus = [nx]; P.trashCores.soul = true;
    O.spirits = [1,2,3,4].map(() => { const s = BS.mkInst(any); s.cores = 1; return s; }); const life0 = O.life, void0 = O.void;
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { lv: BS.lvNo(a), left: O.spirits.length, soulOnNexus: !!nx.soul, dLife: life0 - O.life, dVoid: O.void - void0, partial: BS.CARDS['BS74-AX01'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.soulOnNexus, true, JSON.stringify(r));
  assert.equal(r.left, 4 - ({ 3: 3, 4: 4, 5: 5 }[r.lv] || 0) < 0 ? 0 : 4 - ({ 3: 3, 4: 4, 5: 5 }[r.lv] || 0), JSON.stringify(r));
  if (r.lv >= 4) { assert.equal(r.dLife, 2, JSON.stringify(r)); assert.equal(r.dVoid, 2, JSON.stringify(r)); }
});

test('K-1123 BS75-062 The Stardust Lava Sea: Mirage Flash pays the Soul Core from a Nexus to destroy a 10000 BP or less Spirit; LV1 locks Deck discards for the turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels && BS.CARDS[k].levels[0].bp <= 10000);
    const src = BS.mkInst('BS75-062'); const nx = BS.mkInst('BS74-CX01'); nx.cores = 1; nx.soul = true; P.nexus = [nx]; P.trashCores.soul = false;
    const t = BS.mkInst(any); t.cores = 1; O.spirits = [t];
    const c = { p: P, opp: O, src, ctx: {} }; const eff = BS.CARDS['BS75-062'].effects;
    for (const a of eff[0].actions) { if (a.if && !c.ctx.did) continue; await BS.FX_ACTIONS[a.do].run(c, a); }
    const gone = !O.spirits.includes(t), soulTrash = P.trashCores.soul, soulOnNx = nx.soul;
    BS.G.deckLockTurn = undefined; const c2 = { p: P, opp: O, src, ctx: {} }; await BS.FX_ACTIONS.DECK_LOCK_TURN.run(c2, { do: 'DECK_LOCK_TURN' });
    return { gone, soulTrash, soulOnNx, locked: BS.G.deckLockTurn === BS.G.turnNo, partial: BS.CARDS['BS75-062'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.soulTrash, true, JSON.stringify(r));
  assert.equal(r.soulOnNx, false, JSON.stringify(r)); assert.equal(r.locked, true, JSON.stringify(r));
});

test('K-1124 BS75-X02 Blezion: Flash discard sends the Soul Core to the Ometeotl Nexus and, with 8 counters, summons it free; Unleash destroys a Spirit and takes the Soul Core plus a Nexus core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const nx = BS.mkInst('BS74-CX01'); nx.cores = 3; P.nexus = [nx]; P.trashCores.soul = true; P.trashCores.n = 1; P.count = 8;
    const tg = BS.mkInst(any); tg.cores = 1; O.spirits = [tg]; const b = BS.mkInst('BS75-X02'); P.hand = [b]; const used = await BS.useAccel(P, b, 0, null, 'FLASH');
    const sum = P.spirits.includes(b), soulNx = nx.soul || b.soul;
    const r2 = { gone: !O.spirits.includes(tg), bSoul: !!b.soul, nxLost: 3 - nx.cores, bCores: b.cores };
    P.count = 3; P.onceUsed = {}; const b2 = BS.mkInst('BS75-X02'); P.hand = [b2]; nx.soul = false; P.trashCores.soul = true; P.trashCores.n = 1; P.spirits = [];
    await BS.useAccel(P, b2, 0, null, 'FLASH');
    return { used, sum, soulNx, r2, noSummon: !P.spirits.includes(b2), inTrash: P.trash.includes(b2), partial: BS.CARDS['BS75-X02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.used, true, JSON.stringify(r)); assert.equal(r.sum, true, JSON.stringify(r)); assert.equal(r.soulNx, true, JSON.stringify(r));
  assert.equal(r.r2.gone, true, JSON.stringify(r)); assert.equal(r.r2.bSoul, true, JSON.stringify(r)); assert.equal(r.r2.nxLost, 1, JSON.stringify(r));
  assert.equal(r.noSummon, true, JSON.stringify(r)); assert.equal(r.inTrash, true, JSON.stringify(r));
});

test('K-1125 BS77-005 Hitokaku: Flag Contract Advent onto a Vermillion Contract Nexus; End of Main Step sends 3 cores of a Grandwalker Nexus to the Void', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = false; G.active = P.key; G.step = 4;
    const h = BS.mkInst('BS77-005'), nx = BS.mkInst('BS77-CX01'); nx.cores = 3; nx.soul = true; P.hand = [h]; P.nexus = [nx]; P.spirits = []; P.reserve.soul = true;
    const tg = BS.contractAdventTargets(P, h, 'main').map(t => t.uid === nx.uid);
    const ok = await BS.doContractAdvent(P, h, nx, 'main');
    const stacked = P.spirits.includes(h) && !P.nexus.includes(nx) && h.under.includes(nx);
    const gw = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Grandwalker'));
    const g = BS.mkInst(gw); g.cores = 4; O.nexus = [g]; h.cores = 3;
    await BS.fireFx(P, 'END_MAIN', null, {});
    return { tg, ok, stacked, left: g.cores, partial: BS.CARDS['BS77-005'].partial, cx: BS.CARDS['BS77-CX01'].families }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.tg.length, 1, JSON.stringify(r)); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.stacked, true, JSON.stringify(r)); assert.ok(r.left <= 1, JSON.stringify(r));
});

test('K-1126 BS73-CX01 Yum-Kaax: ACTIVATE gives counters +2 and a Fungal Bed Token Nexus; opposing summon with cost <= counters destroys a Fungal Bed and exhausts the card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true; G.active = P.key; G.step = 4;
    const y = BS.mkInst('BS73-CX01'); y.cores = 3; P.nexus = [y]; P.count = 0; P.tokens = { 'BS73-T001': 3 };
    const idx = BS.CARDS['BS73-CX01'].effects.findIndex(e => e.trigger === 'ACTIVATE'); const ok = await BS.activateFx(P, y, idx);
    const bed = P.nexus.filter(n => n.id === 'BS73-T001').length;
    const cheap = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost <= 2);
    const s = BS.mkInst(cheap); O.spirits = [s]; y.cores = 3; G.active = O.key;
    await BS.fireFx(O, 'SUMMONED', s, { subject: s });
    return { ok, counters: P.count, bed, bedAfter: P.nexus.filter(n => n.id === 'BS73-T001').length, exhausted: !!s.exhausted, partial: BS.CARDS['BS73-CX01'].partial, done: BS.CARDS['BS73-CX01'].fxComplete }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.counters >= 2, true, JSON.stringify(r));
  assert.equal(r.bed, 1, JSON.stringify(r)); assert.equal(r.bedAfter, 0, JSON.stringify(r)); assert.equal(r.exhausted, true, JSON.stringify(r));
});

test('K-1127 BS73-027: ATTACKS banishes up to 3 Trash cards and sends Fungal Bed Tokens only when a Cost 8+ card was banished', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const big = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost >= 8);
    const a = BS.mkInst('BS73-027'); a.cores = 4; P.spirits = [a]; P.tokens = { 'BS73-T001': 3 }; G.attacker = a;
    O.trash = [BS.mkInst(big), BS.mkInst(big)];
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { trash: O.trash.length, beds: P.nexus.filter(n => n.id === 'BS73-T001').length, partial: BS.CARDS['BS73-027'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r)); assert.ok(r.beds >= 1, JSON.stringify(r));
});

test('K-1128 BS73-030: MANIFEST exhausts every Fungal Bed (CPU) and draws one card per two beds', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const s = BS.mkInst('BS73-030'); s.cores = 3; P.spirits = [s]; O.spirits = [BS.mkInst(any), BS.mkInst(any)]; P.deck = [1,2,3,4,5].map(() => BS.mkInst(any)); P.hand = [];
    P.nexus = [BS.mkInst('BS73-T001'), BS.mkInst('BS73-T001')];
    await BS.fireFx(P, 'MANIFEST', s, { subject: s });
    return { ex: P.nexus.filter(n => n.exhausted).length, hand: P.hand.length, partial: BS.CARDS['BS73-030'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.ex, 2, JSON.stringify(r)); assert.equal(r.hand, 1, JSON.stringify(r));
});

test('K-1129 BS73-031: SUMMONED returns every opposing exhausted Spirit to the Hand and gains a core each; Fungal Tree life hit sends an opposing Life to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS73-031');
    const z = BS.mkInst('BS73-031'); z.cores = 3; P.spirits = [z]; P.void = Math.max(P.void || 0, 5);
    const e1 = BS.mkInst(any), e2 = BS.mkInst(any), r1 = BS.mkInst(any); e1.exhausted = e2.exhausted = true; r1.cores = 1; O.spirits = [e1, e2, r1]; O.hand = [];
    await BS.fireFx(P, 'SUMMONED', z, { subject: z });
    const ft = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Fungal Tree') && k !== 'BS73-031');
    const a = BS.mkInst(ft); a.cores = 3; P.spirits.push(a); const life = O.life; G.attacker = a;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', a, { attacker: a, subject: a });
    return { hand: O.hand.length, left: O.spirits.length, gained: z.cores - 3, life: life - O.life, partial: BS.CARDS['BS73-031'].partial, burst: BS.CARDS['BS73-031'].burst && BS.CARDS['BS73-031'].burst.when }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.hand, 2, JSON.stringify(r)); assert.equal(r.left, 1, JSON.stringify(r));
  assert.equal(r.life, 1, JSON.stringify(r)); assert.equal(r.burst, 'LIFE_DECREASE', JSON.stringify(r));
});

test('K-1130 BS74-035: ATTACKS heavy exhausts an opposing Spirit and, controlling Contractor Yum-Kaax, sends a Fungal Bed Token', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const a = BS.mkInst('BS74-035'); a.cores = 3; const y = BS.mkInst('BS73-CX01'); y.cores = 2; P.spirits = [a]; P.nexus = [y]; P.tokens = { 'BS73-T001': 3 }; G.attacker = a;
    const t = BS.mkInst(any); t.cores = 1; O.spirits = [t];
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { ex: !!t.exhausted, beds: P.nexus.filter(n => n.id === 'BS73-T001').length, partial: BS.CARDS['BS74-035'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.ex, true, JSON.stringify(r)); assert.equal(r.beds, 1, JSON.stringify(r));
});
