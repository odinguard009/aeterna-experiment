// v0.38 colour expansion, green: Contractor Hermes / Lionheart (Blade Beast) deck. Card data from the owner-supplied Fandom export; gaps filled from cardrush-bs.jp.
// New engine vocabulary: Heavy Exhaust (setHeavy / refreshOne, HEAVY_EXHAUST_OPP), EXHAUST_OPP, the Removed Zone (REMOVE_OPP_HAND, OPP_CHOOSES_REMOVE_HAND, REMOVE_OPP_TRASH,
// SEND_REMOVED, the OPP_REMOVED trigger), VOID_TO_MATCHING, NO_BURST_BATTLE, BOUNCE_OPP exhaustedOnly, ACTIVATE cost exhaustSelf, Manifest timing YOUR_ATTACK,
// conditions oppRemovedGe / oppRemovedSpirit / removedGe. Quiet boards only.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const HERMES = 'BS69-CX02', SPIRAL = 'BS69-071', POST = 'BS70-072', MEDON = 'BS69-023', STICH = 'BS69-024', EURY = 'BS69-025', PRIA = 'BS69-026', SISY = 'BS70-028', EUDO = 'BS69-028',
  CALC = 'BS69-029', IPH = 'BS70-031', PELOPS = 'BS70-034', AUTO = 'BS69-030', HERMAPH = 'BS70-035', LEON = 'BS69-031', PERS = 'BS70-X03', GUNEUS = 'BS69-033';
// red targets from the built-in pack: cost 0, 1, 3, 4, 5, 8
const T0 = 'BS75-001', T1 = 'BS75-004', T3 = 'BS75-006', T4 = 'BS75-008', T5 = 'BS75-011', T8 = 'BS75-013';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; }, dk = (id, q = P) => { const i = BS.mkInst(id); q.deck.push(i); return i; };
  const ids = L => L.map(x => x.id);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);
const GREEN = [HERMES, SPIRAL, POST, MEDON, STICH, EURY, PRIA, SISY, EUDO, CALC, IPH, PELOPS, AUTO, HERMAPH, LEON, PERS, GUNEUS];

// ---- data ----
test('G01 the 17 green cards of the deck are in the pack, all green, with an image name', async () => {
  const r = await g.page.evaluate(L => L.map(i => { const c = BS.CARDS[i]; return !!c && (c.colors || [c.symbol]).includes('green') && !!c.image; }), GREEN);
  assert.deepEqual(r, GREEN.map(() => true));
});
test('G02 Contractor Hermes: Contract Grandwalker Nexus (cost 2, one symbol), Revive, Lv2 at 2 cores', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [c.type, c.cost, c.symbols, c.contract, c.revive, c.levels.map(l => l.cores), c.families.includes('Grandwalker'), c.reduction]; }, HERMES);
  assert.deepEqual(r, ['Nexus', 2, 1, true, true, [0, 2], true, { green: 1 }]);
});
test('G03 the prebuilt green deck has 40 cards, is legal in Eternal and uses only pack cards', async () => {
  const r = await g.page.evaluate(() => { const d = BS.PREBUILT.find(x => x.id === 'green'); const v = BS.validateDeck(d.cards, 'eternal'); return [v.total, v.errors, Object.keys(d.cards).every(i => !!BS.CARDS[i]), Object.keys(d.cards).length]; });
  assert.deepEqual(r, [40, [], true, 17]);
});
test('G04 the green deck file matches the prebuilt deck', async () => {
  const fs = await import('node:fs'); const txt = fs.readFileSync(new URL('../../data/decks/green-hermes-lionheart.txt', import.meta.url), 'utf8');
  const file = {}; for (const l of txt.split('\n')) { const t = l.split('#')[0].trim().split(/\s+/); if (t.length === 2) file[t[1]] = Number(t[0]); }
  const r = await g.page.evaluate(() => BS.PREBUILT.find(x => x.id === 'green').cards);
  assert.deepEqual(file, r);
});
test('G05 the Magic cards the deck used to leave out are in the pack after the 2026-11-01 playable pass', async () => {
  const r = await g.page.evaluate(() => ['BS69-083', 'BS69-084', 'BS70-083', 'BS69-X04'].map(i => !!BS.CARDS[i]));
  assert.deepEqual(r, [true, true, true, true]);
});

// ---- Heavy Exhaust ----
test('G06 Heavy Exhaust: one Refresh turns it into a normal Exhaust, a second one readies the card', async () => {
  const r = await ev(`const s = sp('${T3}', O); BS.setHeavy(s); const a = [s.exhausted, s.heavy]; BS.refreshOne(s); const b = [s.exhausted, s.heavy]; BS.refreshOne(s); return [a, b, [s.exhausted, s.heavy]];`);
  assert.deepEqual(r, [[true, true], [true, false], [false, false]]);
});
test('G07 the Refresh Step only lifts a Heavy Exhaust to Exhaust', async () => {
  const r = await ev(`const s = sp('${T3}', P), t = sp('${T4}', P); BS.setHeavy(s); t.exhausted = true; for (let i = 0; i < 12; i++) dk('${T0}'); await BS.beginTurn('player'); return [s.exhausted, s.heavy, t.exhausted];`);
  assert.deepEqual(r, [true, false, false]);
});
test('G08 a Spirit that leaves the field loses Heavy Exhaust (bounce to the Hand)', async () => {
  const r = await ev(`const s = sp('${T3}', O); BS.setHeavy(s); BS.removeSpirit(O, s, 'destroyed', true); return [s.exhausted, !!s.heavy];`);
  assert.deepEqual(r, [false, false]);
});
test('G09 Medon LV2 attack: heavy exhausts an opposing Spirit; at LV1 nothing happens', async () => {
  const r = await ev(`const a = sp('${MEDON}', P, 4); const t = sp('${T3}', O); await BS.fireFx(P, 'ATTACKS', a); const x = [t.exhausted, t.heavy]; const b = sp('${MEDON}', P, 1); const u = sp('${T4}', O); await BS.fireFx(P, 'ATTACKS', b); return [x, [u.exhausted, !!u.heavy]];`);
  assert.deepEqual(r, [[true, true], [false, false]]);
});

// ---- Medon / Priapus / Eurytius ----
test('G10 Medon summon: a core from the Void each to two Devotee/Concluser Spirits; counter +1 for another Blade Beast', async () => {
  const r = await ev(`const m = sp('${MEDON}', P, 1), e = sp('${EURY}', P, 1), i = sp('${IPH}', P, 1), x = sp('${T3}', P, 1); await BS.fireFx(P, 'SUMMONED', m); return [m.cores + e.cores + i.cores + x.cores, x.cores, P.count];`);
  assert.equal(r[1], 1); assert.equal(r[0], 6); assert.equal(r[2], 1);
});
test('G11 Medon summon: no counter when the cores go to Devotee Spirits that are not Blade Beast', async () => {
  const r = await ev(`const m = sp('${MEDON}', P, 1), i = sp('${IPH}', P, 1), j = sp('${IPH}', P, 1); await BS.fireFx(P, 'SUMMONED', m); return [i.cores, j.cores, m.cores, P.count];`);
  assert.deepEqual(r.slice(0, 2), [2, 2]);
  assert.equal(r[3], 0);
});
test('G12 Eurytius with Hermes: counter +1 and a revealed Devotee card is added to the Hand', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); const e = sp('${EURY}', P, 1); dk('${IPH}'); dk('${T0}'); await BS.fireFx(P, 'SUMMONED', e); return [P.count, ids(P.hand), ids(P.deck)];`);
  assert.deepEqual(r, [1, [IPH], [T0]]);
});
test('G13 Eurytius with Hermes: a revealed Blade Beast Nexus is deployed without paying', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); const e = sp('${EURY}', P, 1); dk('${SPIRAL}'); await BS.fireFx(P, 'SUMMONED', e); return [ids(P.nexus), P.hand.length];`);
  assert.deepEqual(r, [[HERMES, SPIRAL], 0]);
});
test('G14 Eurytius without Hermes: only the counter, the Deck is untouched', async () => {
  const r = await ev(`const e = sp('${EURY}', P, 1); dk('${IPH}'); await BS.fireFx(P, 'SUMMONED', e); return [P.count, P.hand.length, P.deck.length];`);
  assert.deepEqual(r, [1, 0, 1]);
});
test('G15 Priapus: exhausts an opposing Spirit and puts a core, once per turn', async () => {
  const r = await ev(`const p = sp('${PRIA}', P, 1); const a = sp('${T3}', O), b = sp('${T4}', O); await BS.fireFx(P, 'SUMMONED', p); await BS.fireFx(P, 'ATTACKS', p); return [O.spirits.filter(s => s.exhausted).length, p.cores];`);
  assert.deepEqual(r, [1, 2]);
});

// ---- Removed Zone ----
test('G16 Calchas with Hermes: the opponent puts a card from their Hand onto the Removed Zone; Cost 3 or less gives counter +2', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); const c = sp('${CALC}', P, 1); hd('${T5}', O); hd('${T3}', O); await BS.fireFx(P, 'ATTACKS', c); return [ids(O.removed), ids(O.hand), P.count, c.cores];`);
  assert.deepEqual(r, [[T3], [T5], 2, 3]);
});
test('G17 Calchas: a Cost 4 or more card gives no counter, and no Hermes means no removal', async () => {
  const a = await ev(`nx('${HERMES}', P, 2); const c = sp('${CALC}', P, 1); hd('${T5}', O); await BS.fireFx(P, 'ATTACKS', c); return [ids(O.removed), P.count];`);
  const b = await ev(`const c = sp('${CALC}', P, 1); hd('${T3}', O); await BS.fireFx(P, 'ATTACKS', c); return [ids(O.removed), P.count, c.cores];`);
  assert.deepEqual(a, [[T5], 0]); assert.deepEqual(b, [[], 0, 3]);
});
test('G18 Calchas LV2 refreshes only while a Spirit card is on the opposing Removed Zone', async () => {
  const r = await ev(`const c = sp('${CALC}', P, 3); c.exhausted = true; await BS.fireFx(P, 'ATTACKS', c); const a = c.exhausted; c.exhausted = true; P.onceUsed = {}; c.fxUsed = {}; O.removed.push(BS.mkInst('${T3}')); await BS.fireFx(P, 'ATTACKS', c); return [a, c.exhausted];`);
  assert.deepEqual(r, [true, false]);
});
test('G19 Iphicles: a card of the opposing Trash goes to the Removed Zone, counter +1 and draw 1', async () => {
  const r = await ev(`const i = sp('${IPH}', P, 1); O.trash.push(BS.mkInst('${T4}')); dk('${T0}'); await BS.fireFx(P, 'SUMMONED', i); return [ids(O.removed), O.trash.length, P.count, P.hand.length];`);
  assert.deepEqual(r, [[T4], 0, 1, 1]);
});
test('G20 Iphicles: with an empty opposing Trash nothing follows (no counter, no draw)', async () => {
  const r = await ev(`const i = sp('${IPH}', P, 1); dk('${T0}'); await BS.fireFx(P, 'SUMMONED', i); return [P.count, P.hand.length];`);
  assert.deepEqual(r, [0, 0]);
});
test('G21 Eudoros with Hermes: two cores, the whole opposing Trash is banished, four cards make the opponent put a Hand card away', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); const e = sp('${EUDO}', P, 1); for (let i = 0; i < 4; i++) O.trash.push(BS.mkInst('${T4}')); hd('${T5}', O); await BS.fireFx(P, 'SUMMONED', e); return [e.cores, O.trash.length, O.removed.length, O.hand.length];`);
  assert.deepEqual(r, [3, 0, 5, 0]);
});
test('G22 Eudoros: three banished cards put no Hand card away; without Hermes no cores are added', async () => {
  const r = await ev(`const e = sp('${EUDO}', P, 1); for (let i = 0; i < 3; i++) O.trash.push(BS.mkInst('${T4}')); hd('${T5}', O); await BS.fireFx(P, 'SUMMONED', e); return [e.cores, O.removed.length, O.hand.length];`);
  assert.deepEqual(r, [1, 3, 1]);
});
test('G23 Eudoros LV2: when a card goes onto the opposing Removed Zone, heavy exhaust a Spirit (once per turn)', async () => {
  const r = await ev(`sp('${EUDO}', P, 3); const a = sp('${T3}', O), b = sp('${T4}', O); BS.toRemoved(O, BS.mkInst('${T0}')); await BS.flushBursts(); BS.toRemoved(O, BS.mkInst('${T1}')); await BS.flushBursts(); return [O.spirits.filter(s => s.heavy).length, O.removed.length];`);
  assert.deepEqual(r, [1, 2]);
});
test('G24 Pelops with Hermes: opposing Hand of six or more is cut to three at random, and two cores go to Pelops', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); const p = sp('${PELOPS}', P, 1); for (let i = 0; i < 7; i++) hd('${T3}', O); await BS.fireFx(P, 'SUMMONED', p); return [O.hand.length, O.removed.length, p.cores];`);
  assert.deepEqual(r, [3, 4, 3]);
});
test('G25 Pelops: an opposing Hand of five stays as it is', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); const p = sp('${PELOPS}', P, 1); for (let i = 0; i < 5; i++) hd('${T3}', O); await BS.fireFx(P, 'SUMMONED', p); return [O.hand.length, O.removed.length];`);
  assert.deepEqual(r, [5, 0]);
});
test('G26 Leonteus: sends the strongest opposing Spirit to the Removed Zone and its cores go to their Reserve', async () => {
  const r = await ev(`const l = sp('${LEON}', P, 1); const a = sp('${T8}', O, 3), b = sp('${T3}', O); O.reserve.n = 0; await BS.fireFx(P, 'SUMMONED', l); return [ids(O.spirits), ids(O.removed), ids(O.trash), O.reserve.n];`);
  assert.deepEqual(r, [[T3], [T8], [], 3]);
});
test('G27 Messenger Post LV2: exhausts an opposing Spirit when cards go onto the opposing Removed Zone', async () => {
  const r = await ev(`nx('${POST}', P, 1); const s = sp('${T3}', O); BS.toRemoved(O, BS.mkInst('${T0}')); await BS.flushBursts(); return [s.exhausted, !!s.heavy];`);
  assert.deepEqual(r, [true, false]);
});
test('G28 Messenger Post LV1 (opposing turn): the opposing Hand grows by an effect, the opponent puts a card onto their Removed Zone (Hermes needed)', async () => {
  const r = await ev(`nx('${POST}', P, 0); nx('${HERMES}', P, 2); G.active = 'opponent'; hd('${T3}', O); BS.handUp(O, 1); await BS.flushBursts(); return [ids(O.removed), O.hand.length];`);
  assert.deepEqual(r, [[T3], 0]);
});

// ---- Autolycus / Hermaphros / Guneus ----
test('G29 Autolycus summon: a core from the Void each to up to five Blade Beast Spirits/Nexuses', async () => {
  const r = await ev(`const m = sp('${MEDON}', P, 1), e = sp('${EURY}', P, 1), p = sp('${PRIA}', P, 1), i = sp('${IPH}', P, 1), a = sp('${AUTO}', P, 1), n = nx('${SPIRAL}', P, 0); await BS.fireFx(P, 'SUMMONED', a); return [m.cores, e.cores, p.cores, i.cores, a.cores, n.cores];`);
  assert.deepEqual(r, [2, 2, 2, 1, 2, 1]);
});
test('G30 Autolycus LV2: when a Devotee attacks, an opposing EXHAUSTED Spirit returns to the bottom of the Deck, a ready one stays', async () => {
  const r = await ev(`sp('${AUTO}', P, 3); const m = sp('${MEDON}', P, 1); const a = sp('${T3}', O), b = sp('${T4}', O); a.exhausted = true; await BS.fireFx(P, 'ALLY_ATTACKS', m, { attacker: m }); return [ids(O.spirits), ids(O.deck)];`);
  assert.deepEqual(r, [[T4], [T3]]);
});
test('G31 Hermaphros LV2 attack heavy exhausts two opposing Spirits; LV1 does nothing', async () => {
  const r = await ev(`const h = sp('${HERMAPH}', P, 3); const a = sp('${T3}', O), b = sp('${T4}', O); await BS.fireFx(P, 'ATTACKS', h); const x = O.spirits.filter(s => s.heavy).length; const l = sp('${HERMAPH}', P, 1); const c = sp('${T5}', O); await BS.fireFx(P, 'ATTACKS', l); return [x, !!c.heavy];`);
  assert.deepEqual(r, [2, false]);
});
test('G32 Guneus Burst: summoned without paying, then heavy exhausts two opposing Spirits', async () => {
  const r = await ev(`P.burst = BS.mkInst('${GUNEUS}'); P.burst.mirage = false; const a = sp('${T3}', O), b = sp('${T4}', O), c = sp('${T5}', O); const used = await BS.maybeBurst(P, 'OPP_SUMMON_FX', {}); return [used, ids(P.spirits), O.spirits.filter(s => s.heavy).length, O.spirits.length, O.deck.length];`);
  // the summoned Guneus also fires its own (When Summoned): it returns one exhausted (here a heavy exhausted) Spirit to the Deck bottom
  assert.deepEqual(r, [true, [GUNEUS], 1, 2, 1]);
});

// ---- Hermes ----
test('G33 Hermes Neo-Core Charge: +1 core when a Blade Beast/Devotee/Concluser Spirit of Cost 3 or more is summoned, not for others', async () => {
  const r = await ev(`const h = nx('${HERMES}', P, 2); const s = sp('${T5}', P); await BS.fireFx(P, 'SUMMONED', s); const a = h.cores; const m = sp('${PRIA}', P, 1); await BS.fireFx(P, 'SUMMONED', m); return [a, h.cores];`);
  assert.deepEqual(r, [2, 3]);
});
test('G34 Hermes Contract Skill (Flash): two cores to the Void, counter +2, exhaust a Cost 7 or less Spirit (not Cost 8)', async () => {
  const r = await ev(`const h = nx('${HERMES}', P, 3); G.step = 5; const a = sp('${T8}', O), b = sp('${T5}', O); const L = BS.activatable(P, h, 'FLASH'); await BS.activateFx(P, h, L[0].idx); return [L.length, h.cores, P.count, a.exhausted, b.exhausted];`);
  assert.deepEqual(r, [1, 1, 2, false, true]);
});
test('G35 Hermes Contract Skill needs two cores on the Nexus', async () => {
  const r = await ev(`const h = nx('${HERMES}', P, 1); G.step = 5; sp('${T5}', O); return BS.activatable(P, h, 'FLASH').length;`);
  assert.equal(r, 0);
});
test('G36 Hermes Contract Field LV2: during the battle the opponent cannot activate Burst effects; the lock ends with the battle', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); P.count = 2; const a = sp('${T3}', P); O.burst = BS.mkInst('BS71-061'); O.burst.mirage = false; G.attacker = a; await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a }); const lock = G.noBurst; const used = await BS.maybeBurst(O, 'LIFE_DECREASE', {}); return [lock, used, !!O.burst];`);
  assert.deepEqual(r, ['opponent', false, true]);
});
test('G37 Hermes Contract Field at LV1 gives no Burst lock', async () => {
  const r = await ev(`nx('${HERMES}', P, 0); P.count = 1; const a = sp('${T3}', P); G.attacker = a; await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a }); return G.noBurst || null;`);
  assert.equal(r, null);
});
test('G38 Hermes Contract Field LV2: a Devotee/Concluser attacker also puts a random opposing Hand card onto the Removed Zone', async () => {
  const r = await ev(`nx('${HERMES}', P, 2); P.count = 2; const m = sp('${MEDON}', P, 1); hd('${T3}', O); hd('${T4}', O); G.attacker = m; await BS.fireFx(P, 'ALLY_ATTACKS', m, { attacker: m }); return [O.hand.length, O.removed.length];`);
  assert.deepEqual(r, [1, 1]);
});

// ---- Spiral Way / Manifest ----
test('G39 Spiral Way Flash: exhausts itself and sends an opposing exhausted Cost 3 or less Spirit to the Removed Zone (attack step only)', async () => {
  const r = await ev(`const n = nx('${SPIRAL}', P, 0); const a = sp('${T3}', O), b = sp('${T4}', O); a.exhausted = true; b.exhausted = true; G.step = 4; const early = BS.activatable(P, n, 'FLASH').length; G.step = 5; const L = BS.activatable(P, n, 'FLASH'); await BS.activateFx(P, n, L[0].idx); return [early, L.length, n.exhausted, ids(O.spirits), ids(O.removed), BS.activatable(P, n, 'FLASH').length];`);
  assert.deepEqual(r, [0, 1, true, [T4], [T3], 0]);
});
test('G40 Spiral Way Flash is not offered when no opposing exhausted Cost 3 or less Spirit exists', async () => {
  const r = await ev(`const n = nx('${SPIRAL}', P, 0); sp('${T3}', O); const b = sp('${T4}', O); b.exhausted = true; G.step = 5; return BS.activatable(P, n, 'FLASH').length;`);
  assert.equal(r, 0);
});
test('G41 Spiral Way LV2: a revealed Devotee/Concluser/Grandwalker card is added to the Hand when cards go onto the opposing Removed Zone', async () => {
  const r = await ev(`nx('${SPIRAL}', P, 1); dk('${HERMES}'); BS.toRemoved(O, BS.mkInst('${T0}')); await BS.flushBursts(); return [ids(P.hand), P.deck.length];`);
  assert.deepEqual(r, [[HERMES], 0]);
});
test('G42 Manifest data: Leonteus (Either Attack Step, 4 counters), Perseus (5), Sisyphus (Your Attack Step, 2) name Contractor Hermes', async () => {
  const r = await g.page.evaluate(L => L.map(i => BS.CARDS[i].manifest), [LEON, PERS, SISY]);
  assert.deepEqual(r, [{ name: 'Contractor Hermes', counterGe: 4, turn: 'EITHER_ATTACK' }, { name: 'Contractor Hermes', counterGe: 5, turn: 'EITHER_ATTACK' }, { name: 'Contractor Hermes', counterGe: 2, turn: 'YOUR_ATTACK' }]);
});
test('G43 Sisyphus manifests only in your own Attack Step Flash Timing', async () => {
  const r = await ev(`const h = nx('${HERMES}', P, 1); const s = hd('${SISY}'); P.count = 2; P.reserve.soul = true; const out = []; G.active = 'player'; G.step = 5; out.push(BS.manifestTargets(P, s, 'flash').length); G.step = 4; out.push(BS.manifestTargets(P, s, 'flash').length); G.step = 5; G.active = 'opponent'; out.push(BS.manifestTargets(P, s, 'flash').length); return out;`);
  assert.deepEqual(r, [1, 0, 0]);
});

// ---- bookkeeping ----
test('G44 the new conditions oppRemovedGe, oppRemovedSpirit and removedGe', async () => {
  const r = await g.page.evaluate(() => [BS.fxIf({ removed: [], hand: [], void: 0, soulState: [], life: 5, count: 0, key: 'player', nexus: [], spirits: [] }, { removed: [{ id: 'BS75-006' }], hand: [], life: 5 }, { oppRemovedGe: 1, oppRemovedSpirit: true }, {}),
    BS.fxIf({ removed: [], hand: [], void: 0, soulState: [], life: 5, count: 0, key: 'player', nexus: [], spirits: [] }, { removed: [], hand: [], life: 5 }, { oppRemovedGe: 1 }, {}),
    BS.fxIf({ removed: [], hand: [], void: 0, soulState: [], life: 5, count: 0, key: 'player', nexus: [], spirits: [] }, { removed: [], hand: [], life: 5 }, { removedGe: 4 }, { removedN: 4 })]);
  assert.deepEqual(r, [true, false, true]);
});
test('G45 every green card with effects parses without errors and fxComplete cards carry no residual', async () => {
  const r = await g.page.evaluate(L => L.map(i => { const c = BS.CARDS[i]; return [i, !!c.effects || !!c.burst, c.fxComplete === true && !!(c.residual && c.residual.length)]; }), GREEN);
  assert.deepEqual(r.filter(x => !x[1]).map(x => x[0]), []);
  assert.deepEqual(r.filter(x => x[2]).map(x => x[0]), []);
});

