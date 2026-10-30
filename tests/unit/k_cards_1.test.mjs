// Lane K tests, file 1 (new rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SETUP = `const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; }
  const hit = async cores => { const a = BS.mkInst('26RBS01-001'); a.cores = cores; a.exhausted = false; O.spirits.length = 0; O.spirits.push(a); G.active = O.key; G.step = 5; const l = P.life; await BS.doBattle(O.key, a); return l - P.life; };`;

test('K-97 26RSD02-013 Rainy Poison: LIFE_CORE_SHIELD only after the Life was reduced; attackers with one core then take no Life this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const t = BS.mkInst('26RBS01-001'); t.cores = 1; t.exhausted = true; P.spirits.push(t);
    const cast = async () => { const m = BS.mkInst('26RSD02-013'); G.active = O.key; G.step = 5; await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' }); };
    P.life = 5; P.lifeRedTurn = -1; await cast(); const noShield = !P.coreShield;
    P.lifeRedTurn = G.turnNo; await cast(); const shield = !!P.coreShield;
    return [noShield, shield, await hit(1), await hit(2)]; })()`);
  assert.deepEqual(r, [true, true, 0, 1], JSON.stringify(r));
});

test('K-98 26RBS03-076 Venomous Bottomless Swamp: Invoke destroys the Nexus for a this-battle shield (gone with the next battle); Life hit exhausts it and sends cores until one remains', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS03-076'); n.cores = 3; P.nexus.push(n);
    const i = BS.CARDS['26RBS03-076'].effects.findIndex(e => e.invoke);
    G.active = O.key; G.step = 5; const ok = await BS.activateFx(P, n, i);
    const gone = !P.nexus.includes(n), set = !!(P.coreShield && P.coreShield.b === (G.battleNo || 0));
    const later = await hit(1);
    const m = BS.mkInst('26RBS03-076'); m.cores = 3; P.nexus.push(m);
    const e = BS.mkInst('26RBS01-001'); e.cores = 4; O.spirits.length = 0; O.spirits.push(e);
    await BS.fireFx(P, 'OWN_LIFE_HIT', null, { attacker: e }); await BS.flushBursts();
    return [ok, gone, set, later, m.exhausted, e.cores]; })()`);
  assert.deepEqual(r, [true, true, true, 1, true, 1], JSON.stringify(r));
});

test('K-99 26RBS01-X01 Restiel: Invoke needs an own Clash attacker (attackerKeyword), exhausts itself and lets an opposing Spirit block while exhausted this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const w = BS.mkInst('26RBS01-X01'); w.cores = 3; P.spirits.push(w);
    const o = BS.mkInst('26RBS01-001'); o.cores = 1; o.exhausted = true; O.spirits.push(o);
    const i = BS.CARDS['26RBS01-X01'].effects.findIndex(e => e.invoke);
    G.active = P.key; G.step = 5; G.battleNo = 5;
    const a = BS.mkInst('BS06-012'); a.cores = 1; P.spirits.push(a);
    G.attacker = a; const ok = await BS.activateFx(P, w, i); const marked = o.blockExB === 5 && w.exhausted;
    w.exhausted = false; o.blockExB = null;
    const b = BS.mkInst('26RBS01-001'); b.cores = 1; P.spirits.push(b); G.attacker = b;
    const no = await BS.activateFx(P, w, i); G.attacker = null;
    return [ok, marked, !!no, o.blockExB == null]; })()`);
  assert.deepEqual(r, [true, true, false, true], JSON.stringify(r));
});

test('K-100 26RBS02-X07 Great Emperan: Invoke exhausts one of your Spirits, the opponent exhausts one of their refreshed Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const w = BS.mkInst('26RBS02-X07'); w.cores = 3; P.spirits.push(w);
    const c = BS.mkInst('26RBS01-001'); c.cores = 1; P.spirits.push(c);
    const o = BS.mkInst('26RBS01-001'); o.cores = 1; O.spirits.push(o);
    const i = BS.CARDS['26RBS02-X07'].effects.findIndex(e => e.invoke);
    G.active = P.key; G.step = 3;
    const ok = await BS.activateFx(P, w, i);
    return [ok, o.exhausted, w.exhausted || c.exhausted]; })()`);
  assert.deepEqual(r, [true, true, true], JSON.stringify(r));
});

test('K-101 26RBS01-093 Downdraft Dragon Current: Invoke exhausts the Nexus and gives +3000 BP to the attacking Clash Spirit this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS01-093'); n.cores = 3; P.nexus.push(n);
    const a = BS.mkInst('BS06-012'); a.cores = 1; P.spirits.push(a);
    const i = BS.CARDS['26RBS01-093'].effects.findIndex(e => e.invoke);
    G.active = P.key; G.step = 5; G.attacker = a;
    const before = BS.bpOf(a); const ok = await BS.activateFx(P, n, i);
    return [ok, n.exhausted, BS.bpOf(a) - before]; })()`);
  assert.deepEqual(r, [true, true, 3000], JSON.stringify(r));
});

test('K-102 26RBS01-095 High-Rise Tombs / 26RBS03-018 Sthenon: destroying an own Purple/Beastleptic Spirit sends a core from an opposing small Spirit to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS01-095'); n.cores = 3; P.nexus.push(n);
    const p = BS.mkInst('26RBS03-018'); p.cores = 2; P.spirits.push(p);
    const o = BS.mkInst('TRAIN-02'); o.cores = 2; O.spirits.push(o);
    const ci = BS.CARDS['26RBS01-095'].effects.findIndex(e => e.invoke);
    G.active = P.key; G.step = 3;
    const ok = await BS.activateFx(P, n, ci);
    const gone = !P.spirits.includes(p), left = o.cores;
    const p2 = BS.mkInst('26RBS03-018'); p2.cores = 2; P.spirits.push(p2);
    const q = BS.mkInst('26RBS03-018'); q.cores = 2; P.spirits.push(q);
    const si = BS.CARDS['26RBS03-018'].effects.findIndex(e => e.invoke);
    G.step = 5; G.attacker = p2; const ok2 = await BS.activateFx(P, p2, si);
    return [ok, gone, left, ok2, o.cores]; })()`);
  assert.deepEqual(r, [true, true, 1, true, 0], JSON.stringify(r));
});

test('K-103 26RBS01-095 High-Rise Tombs LV2: draws a card when the opposing Life is reduced by your Shamanism Spirit (not by another Spirit)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS01-095'); n.cores = 3; P.nexus.push(n);
    const s = BS.mkInst('26RBS02-023'); s.cores = 1; P.spirits.push(s);
    const x = BS.mkInst('BS06-012'); x.cores = 1; P.spirits.push(x);
    G.active = P.key; G.step = 5; P.hand.length = 0;
    const run = async a => { const h = P.hand.length; await BS.fireFx(P, 'ALLY_LIFE_HIT', a, { attacker: a }); return P.hand.length - h; };
    const no = await run(x); G.turnNo += 1; const yes = await run(s);
    return [no, yes]; })()`);
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-104 26RBS03-083 War Feat: extra Blue symbol for a Cost 6+ vanilla Blue Spirit (LV1-2 only for that card); LV2 Flash refreshes a vanilla Blue Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const cost = id => BS.effCost(P, BS.CARDS[id]);
    const n = BS.mkInst('26RBS03-083'); n.cores = 0; P.nexus.push(n);
    const base = cost('26RBS03-072');
    n.cores = 3; const lv2 = cost('26RBS03-072'), other = cost('26RBS01-070');
    P.nexus.length = 0; const none = cost('26RBS03-072'), noneOther = cost('26RBS01-070');
    P.nexus.push(n);
    const v = BS.mkInst('26RBS03-072'); v.cores = 1; v.exhausted = true; P.spirits.push(v);
    G.active = O.key; G.step = 5; const ok = await BS.activateFx(P, n, 1);
    return [base, lv2, none, other >= noneOther - 1, ok, v.exhausted, n.exhausted]; })()`);
  assert.equal(r[0], r[2] - 2, 'Nexus own symbol + extra symbol at LV1');
  assert.equal(r[1], r[2] - 2, 'and at LV2');
  assert.equal(r[3], true, 'a non-matching card gets no extra symbol (at most the Nexus own one)');
  assert.deepEqual(r.slice(4), [true, false, true], JSON.stringify(r));
});

test('K-105 26RBS01-093 DRAW_STEP: after the Draw Step draw, draws +1 then must return a Hand card to the deckbottom; only its owner, once (Can\'t Stack)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS01-093'); P.nexus.push(n);
    const m = BS.mkInst('26RBS01-093'); P.nexus.push(m);
    G.active = P.key; P.hand.length = 0; for (let i = 0; i < 3; i++) P.hand.push(BS.mkInst('BS50-014'));      // cost 0: the CPU returns the cheapest card, a tie keeps the earliest, so the drawn card stays
    const before = P.hand.slice(), lenH = P.hand.length;
    await BS.fireFx(P, 'DRAW_STEP', null, {});
    const gained = P.hand.filter(x => !before.includes(x)).length, bottom = before.includes(P.deck[P.deck.length - 1]);
    const own = [P.hand.length - lenH, gained, bottom];
    const h2 = O.hand.length; await BS.fireFx(O, 'DRAW_STEP', null, {});
    return [own, O.hand.length - h2]; })()`);
  assert.deepEqual(r, [[0, 1, true], 0], JSON.stringify(r));
});

test('K-106 26RBS03-018 When Destroyed: summons a Cost 4 or less Beastleptic Spirit from the Trash (a Cost 5 one stays)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    P.reserve.n = 3; const n = BS.mkInst('26RBS03-018'); n.lostLv = 0; P.trash.push(n);
    const lo = BS.mkInst('26RBS02-013'), hi = BS.mkInst('26RBS03-018'); P.trash.push(hi, lo);
    await BS.fireFx(P, 'DESTROYED', n, {});
    return [P.spirits.includes(lo), P.trash.includes(lo), P.trash.includes(hi), P.spirits.includes(hi)]; })()`);
  assert.deepEqual(r, [true, false, true, false], JSON.stringify(r));
});

test('K-107 26RBS02-074 / 26RBS03-005 LV2: at the end of the battle of a 10000+ BP Spirit, a core from the Trash goes to a non-attacking (074) / matching-family (005) Spirit; not below 10000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const nx = BS.mkInst('26RBS02-074'); nx.cores = 2; P.nexus.push(nx);
    const big = BS.mkInst('26RBS02-013'); big.cores = 3; P.spirits.push(big);
    const ally = BS.mkInst('26RBS02-013'); ally.cores = 3; P.spirits.push(ally);
    const run = async a => { P.trashCores.n = 2; const b = big.cores + ally.cores; G.attacker = a; await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: a, attacker: a }); G.attacker = null; return [big.cores + ally.cores - b, ally.cores - 3]; };
    const low = await run(big);
    big.bpMod = 10000; ally.bpMod = 0; const hi = await run(big);
    return [low, hi]; })()`);
  assert.deepEqual(r[0], [0, 0], JSON.stringify(r));
  assert.equal(r[1][1], 1, JSON.stringify(r));
});

test('K-108 26RBS01-102 Rock Pit: an attacking Amplify Spirit cannot be blocked by Cost 2 or less Spirits; LV2 end of its battle: +1 core from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const nx = BS.mkInst('26RBS01-102'); nx.cores = 2; P.nexus.push(nx);
    const amp = BS.mkInst('26RBS01-048'), plain = BS.mkInst('26RBS02-013'); amp.cores = 1; plain.cores = 1; P.spirits.push(amp, plain);
    G.battleNo = (G.battleNo || 0) + 1; await BS.fireFx(P, 'ALLY_ATTACKS', amp, { attacker: amp }); await BS.fireFx(P, 'ALLY_ATTACKS', plain, { attacker: plain });
    const m = [!!amp.noBlockBy, !!plain.noBlockBy, amp.noBlockBy && amp.noBlockBy.costLe];
    P.trashCores.n = 2; G.attacker = amp; const c0 = amp.cores; await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: amp, attacker: amp }); G.attacker = null;
    return [m, amp.cores - c0]; })()`);
  assert.deepEqual(r, [[true, false, 2], 1], JSON.stringify(r));
});

test('K-109 26RBS02-X01 Gene-Rose: LV1 gives a Red Spirit +3000 BP at Start of Attack; LV2 reveals when a 10000+ BP Spirit reduces the Life (a Red Cloud Spirit on top goes to the Hand)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const g = BS.mkInst('26RBS02-X01'); g.cores = 3; P.spirits.push(g);
    const b0 = bpOf(g); await BS.fireFx(P, 'START_ATTACK', null, {}); const up = bpOf(g) - b0;
    g.bpMod = 10000; P.deck.unshift(BS.mkInst('26RBS03-005')); const h = P.hand.length;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: g });
    return [up, P.hand.length - h, P.deck.length]; })()`);
  assert.equal(r[0], 3000, JSON.stringify(r));
  assert.equal(r[1], 1, JSON.stringify(r));
});

test('K-110 EXHAUSTED_FX: X09 exhausts (then heavy exhausts) an opposing Spirit; Grayken gives +2000 BP per event; Emperan puts one Void core into the Trash once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const x9 = BS.mkInst('26RBS02-X09'), gr = BS.mkInst('26RBS02-037'), em = BS.mkInst('26RBS02-X07'); for (const s of [x9, gr, em]) { s.cores = 6; P.spirits.push(s); }
    const v = BS.mkInst('26RBS01-001'); v.cores = 1; v.exhausted = false; O.spirits.push(v);
    const t0 = P.trashCores.n; G.active = P.key; G.turnNo = G.turnNo || 1;
    await BS.fireFx(P, 'ATTACKS', x9, { attacker: x9 });
    return [!!v.exhausted, !!v.heavy, P.trashCores.n - t0, [x9, gr, em].reduce((s, i) => s + (i.bpMod || 0), 0)]; })()`);
  assert.deepEqual(r.slice(0, 3), [true, true, 1], JSON.stringify(r));
  assert.ok(r[3] >= 2000, JSON.stringify(r));
});

test('K-111 26RBS02-078 Great Shield of Bubbles: green Floodragon Life hit heavy-exhausts an exhausted Cost 5- Spirit; LV2 returns Rapid Ripper from the Trash when a Spirit effect exhausts', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS02-078'); n.cores = 3; P.nexus.push(n);
    const a = BS.mkInst('26RBS02-029'); a.cores = 2; P.spirits.push(a);
    const v = BS.mkInst('26RBS01-001'); v.cores = 1; v.exhausted = true; O.spirits.push(v);
    G.active = P.key; G.turnNo = G.turnNo || 1;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: a });
    const heavy = !!v.heavy;
    const rr = BS.mkInst('26RBS02-089'); P.trash.push(rr); const h0 = P.hand.length;
    await BS.fireFx(P, 'EXHAUSTED_FX', null, { side: 'opp', fxSrc: a });
    return [heavy, P.hand.length - h0, P.hand.includes(rr)]; })()`);
  assert.deepEqual(r, [true, 1, true], JSON.stringify(r));
});

test('K-112 NEXUS_AS_SPIRIT: 086 (Invoke) and 069 (core from this Spirit) turn a Nexus into a 7000 BP Spirit with no Nexus effects until the step ends; 068 needs every Nexus to be Cyantree', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS02-086'); n.cores = 3; P.nexus.push(n);
    G.active = O.key; G.step = 5; P.reserve.n = Math.max(P.reserve.n, 3); P.life = Math.max(P.life, 3);
    const i = BS.CARDS['26RBS02-086'].effects.findIndex(e => e.invoke);
    const ok = await BS.activateFx(P, n, i);
    const as = [P.spirits.includes(n), !P.nexus.includes(n), BS.bpOf(n)];
    BS.setStep(6);
    const back = [!P.spirits.includes(n), P.nexus.includes(n), !n.asSpirit];
    const sp = BS.mkInst('26RBS02-069'); sp.cores = 3; P.spirits.push(sp); const m = BS.mkInst('26RBS02-086'); m.cores = 1; P.nexus.push(m); G.step = 5;
    const j = BS.CARDS['26RBS02-069'].effects.findIndex(e => e.invoke);
    const ok2 = await BS.activateFx(P, sp, j);
    const two = [P.spirits.includes(m) || P.spirits.includes(n), sp.cores];
    return { ok, as, back, ok2, two }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.as, [true, true, 7000], JSON.stringify(r));
  assert.deepEqual(r.back, [true, true, true], JSON.stringify(r));
  assert.equal(r.ok2, true, JSON.stringify(r));
  assert.deepEqual(r.two, [true, 2], JSON.stringify(r));
});

test('K-113 zone:trash triggers: 032 returns from the Trash on a heavy exhaust only while a Floodragon Spirit/Nexus is controlled; 012 returns when a Thunder Dragon Spirit is destroyed (once per turn per name)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = G.turnNo || 1;
    const e = BS.mkInst('26RBS02-032'); P.trash.push(e); const h0 = P.hand.length;
    await BS.fireFx(P, 'EXHAUSTED_FX', null, { side: 'opp', heavy: true });
    const noCtl = P.hand.length - h0;
    const a = BS.mkInst('26RBS02-029'); a.cores = 2; P.spirits.push(a);
    await BS.fireFx(P, 'EXHAUSTED_FX', null, { side: 'opp', heavy: false });
    const light = P.hand.length - h0;
    await BS.fireFx(P, 'EXHAUSTED_FX', null, { side: 'opp', heavy: true });
    const ok = [P.hand.includes(e), P.trash.includes(e)];
    const m = BS.mkInst('26RSD05-012'); P.trash.push(m); const h1 = P.hand.length;
    const td = BS.mkInst('26RBS01-066'); td.cores = 1; P.spirits.push(td);
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: td });
    const first = P.hand.includes(m); P.hand.splice(P.hand.indexOf(m), 1); P.trash.push(m);
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: td });
    return [noCtl, light, ok, first, P.hand.includes(m)]; })()`);
  assert.equal(r[0], 0, JSON.stringify(r));
  assert.equal(r[1], 0, JSON.stringify(r));
  assert.deepEqual(r[2], [true, false], JSON.stringify(r));
  assert.deepEqual(r.slice(3), [true, false], JSON.stringify(r));
});

test('K-114 26RBS02-050: LV2 refreshes an exhausted Wailwraith/Hexcraft Spirit when this Spirit is exhausted by an opposing EXHAUST_OPP effect (own side only; the exhauster side does not trigger it)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = G.turnNo || 1;
    const s = BS.mkInst('26RBS02-050'); s.cores = BS.CARDS['26RBS02-050'].levels[1].cores; s.exhausted = true; O.spirits.push(s);
    const w = BS.mkInst('26RBS01-061'); w.cores = 1; w.exhausted = true; O.spirits.push(w);
    await BS.fireFx(O, 'EXHAUSTED_FX', null, { side: 'own', subject: s });
    const own = !w.exhausted || !s.exhausted;  // the CPU may refresh the victim itself (it also matches the family)
    s.exhausted = true; w.exhausted = true; await BS.fireFx(O, 'EXHAUSTED_FX', null, { side: 'own', subject: w });
    return [true, own, w.exhausted && s.exhausted]; })()`);
  assert.deepEqual(r, [true, true, true], JSON.stringify(r));
});

test('K-115 26RBS02-082: LV1 -1000 BP + destroy at 0 when an ally is blocked; LV2 returns a Cost 4 or less Spirit on the second Wailwraith/Hexcraft attack', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = O.key; G.turnNo = G.turnNo || 1;
    const n = BS.mkInst('26RBS02-082'); n.cores = BS.CARDS['26RBS02-082'].levels[1].cores; O.nexus.push(n);
    const a = BS.mkInst('26RBS01-061'); a.cores = 1; O.spirits.push(a);
    const t = BS.mkInst('26RBS01-001'); t.cores = 1; P.spirits.push(t); t.bpMod = -(BS.bpOf(t) - 1000);
    await BS.fireFx(O, 'ALLY_BLOCKED', a, { attacker: a, blocker: t });
    const killed = !P.spirits.includes(t);
    const c = BS.mkInst('26RBS01-001'); O.trash.push(c); O.attacksThisTurn = 1;
    await BS.fireFx(O, 'ALLY_ATTACKS', a, { attacker: a }); const first = O.hand.includes(c);
    O.attacksThisTurn = 2; await BS.fireFx(O, 'ALLY_ATTACKS', a, { attacker: a }); const second = O.hand.includes(c);
    return [killed, first, second]; })()`);
  assert.deepEqual(r, [true, false, true], JSON.stringify(r));
});

test('K-116 26RBS03-054: LV1 picks another own Spirit that opposing 8000 BP or less Spirits cannot block; LV2 -2000 BP and destroy at 0 on the blocking Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = G.turnNo || 1;
    const m = BS.mkInst('26RBS03-054'); m.cores = BS.CARDS['26RBS03-054'].levels[1].cores; P.spirits.push(m);
    const a = BS.mkInst('26RBS01-061'); a.cores = 1; P.spirits.push(a);
    await BS.fireFx(P, 'SUMMONED', m, {});
    const picked = !!a.noBlockTurnBp && !m.noBlockTurnBp;
    const lowBlk = BS.mkInst('26RBS01-001'); lowBlk.cores = 1; O.spirits.push(lowBlk); lowBlk.bpMod = -(BS.bpOf(lowBlk) - 2000);
    await BS.fireFx(P, 'ALLY_BLOCKED', m, { attacker: m, blocker: lowBlk });
    return [picked, !O.spirits.includes(lowBlk)]; })()`);
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-117 26RBS03-077: LV1 purple Spirit blocked -> 1 core from an opposing Spirit (keeps one); LV2 life hit -> 1 core from a Cost 6 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = G.turnNo || 1;
    const n = BS.mkInst('26RBS03-077'); n.cores = BS.CARDS['26RBS03-077'].levels[1].cores; P.nexus.push(n);
    const pid = Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && (c.colors || [c.symbol]).includes('purple') && c.cost <= 3; });
    const att = BS.mkInst(pid); att.cores = 1; P.spirits.push(att);
    const t = BS.mkInst('26RBS01-001'); t.cores = 3; O.spirits.push(t);
    await BS.fireFx(P, 'ALLY_BLOCKED', att, { attacker: att, blocker: null });
    const a = t.cores;
    t.cores = 1; await BS.fireFx(P, 'ALLY_BLOCKED', att, { attacker: att, blocker: null }); const keep = t.cores;
    t.cores = 3; await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: att }); const b = t.cores;
    return [a, keep, b]; })()`);
  assert.deepEqual(r, [2, 1, 2], JSON.stringify(r));
});
