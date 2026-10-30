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
