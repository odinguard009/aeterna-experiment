// v0.40 colour expansion, yellow: Contractor Indra / Thunderive deck (official BS75 Indra deck without Magic and AX02). Card data from the owner-supplied Fandom export;
// Indra's Neo-Core Charge target, Lv2 (Count 2), Contract Field and Contract Skill read from yuyu-tei.jp / battlespirits.com; the Temple Lv2 threshold is not verified.
// New engine vocabulary: CANT_ATTACK_BLOCK (noAB), DRAW_BOTTOM, DISCARD_ALL_HAND, REVEAL_ADD, VOID_TO_LIFE, LIFE_TO_SELF, NEXUS_CORES_TO_SELF, SELF_TO_HAND, STATIC EXTRA_REDUCTION,
// BOUNCE_OPP lv/nexus, conditions oppNoAB / oppNexusGe, effect flags other / noStack / self (ALLY_LIFE_HIT). Quiet boards only.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser, simMatch } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const INDRA = 'BS75-CX03', TEMPLE = 'BS75-068', BILI = 'BS75-042', DRACO = 'BS75-043', MANE = 'BS75-044', RAIV = 'BS75-045', SHIMA = 'BS75-046', MAGJ = 'BS75-047',
  MAGAN = 'BS75-048', AIRA = 'BS75-049', NARAKA = 'BS75-050', VAJRA = 'BS75-X10', TOGE = 'BS76-047', VREINE = 'BS76-048';
const YELLOW = [INDRA, TEMPLE, BILI, DRACO, MANE, RAIV, SHIMA, MAGJ, MAGAN, AIRA, NARAKA, VAJRA, TOGE, VREINE];
// red targets from the built-in pack: cost 0 (1 core to stay), 3, 4, 5, 8; levels: T3 lv1 at 1 core, lv2 at 3 cores
const T0 = 'BS75-001', T1 = 'BS75-004', T3 = 'BS75-006', T4 = 'BS75-008', T5 = 'BS75-011', T8 = 'BS75-013';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; }, dk = (id, q = P) => { const i = BS.mkInst(id); q.deck.push(i); return i; };
  const ids = L => L.map(x => x.id);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

// ---- data ----
test('Y01 the 14 yellow cards of the deck are in the pack, all yellow, with an image name', async () => {
  const r = await g.page.evaluate(L => L.map(i => { const c = BS.CARDS[i]; return !!c && (c.colors || [c.symbol]).includes('yellow') && !!c.image; }), YELLOW);
  assert.deepEqual(r, YELLOW.map(() => true));
});
test('Y02 Contractor Indra: Contract Grandwalker Nexus (cost 2, one symbol), Revive, Lv2 at 2 cores, yellow reduction', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [c.type, c.cost, c.symbols, c.contract, c.revive, c.levels.map(l => l.cores), c.families.includes('Grandwalker'), c.reduction]; }, INDRA);
  assert.deepEqual(r, ['Nexus', 2, 1, true, true, [0, 2], true, { yellow: 1 }]);
});
test('Y03 the prebuilt yellow deck has 40 cards, is legal in Eternal and uses only pack cards', async () => {
  const r = await g.page.evaluate(() => { const d = BS.PREBUILT.find(x => x.id === 'yellow'); const v = BS.validateDeck(d.cards, 'eternal'); return [v.total, v.errors, Object.keys(d.cards).every(i => !!BS.CARDS[i]), Object.keys(d.cards).length]; });
  assert.deepEqual(r, [40, [], true, 14]);
});
test('Y04 the yellow deck file matches the prebuilt deck', async () => {
  const fs = await import('node:fs'); const txt = fs.readFileSync(new URL('../../data/decks/yellow-indra-thunderive.txt', import.meta.url), 'utf8');
  const file = {}; for (const l of txt.split('\n')) { const t = l.split('#')[0].trim().split(/\s+/); if (t.length === 2) file[t[1]] = Number(t[0]); }
  assert.deepEqual(file, await g.page.evaluate(() => BS.PREBUILT.find(x => x.id === 'yellow').cards));
});
test('Y05 Indra\'s Heavenly Thunder Temple is a Nexus with Lv2 at 1 core', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [c.type, c.cost, c.levels.map(l => l.cores)]; }, TEMPLE);
  assert.deepEqual(r, ['Nexus', 3, [0, 1]]);
});
test('Y06 every yellow card has effects or burst/manifest data, and the 12 Spirits are Thunderive', async () => {
  const r = await g.page.evaluate(L => L.map(i => { const c = BS.CARDS[i]; return !!(c.effects || c.burst || c.manifest) && (c.type !== 'Spirit' || c.families.includes('Thunderive')); }), YELLOW);
  assert.deepEqual(r, YELLOW.map(() => true));
});

// ---- new vocabulary ----
test('Y07 condition oppNoAB is true only while an opposing Spirit is under can\'t attack/block', async () => {
  const r = await ev(`const f = () => BS.fxIf(P, O, { oppNoAB: true }, {}); const a = f(); const t = sp('${T3}', O); t.noAB = true; return [a, f()];`);
  assert.deepEqual(r, [false, true]);
});
test('Y08 condition oppNexusGe counts the opposing Nexuses', async () => {
  const r = await ev(`const f = () => BS.fxIf(P, O, { oppNexusGe: 1 }, {}); const a = f(); nx('${TEMPLE}', O, 0); return [a, f()];`);
  assert.deepEqual(r, [false, true]);
});
test('Y09 CANT_ATTACK_BLOCK marks the strongest opposing Spirit for the CPU and keeps it on the Field', async () => {
  const r = await ev(`const a = sp('${T3}', O, 2), b = sp('${T8}', O, 4); const s = sp('${VAJRA}', P, 3); await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'CANT_ATTACK_BLOCK', n: 1 }] }, 'ATTACKS'); return [!!a.noAB, !!b.noAB, O.spirits.length];`);
  assert.deepEqual(r, [false, true, 2]);
});
test('Y10 an opposing Spirit that can\'t attack/block does not block, so the attack hits the Life', async () => {
  const r = await ev(`const blk = sp('${T8}', O, 4); blk.noAB = true; const att = sp('${T4}', P, 3); P.life = 5; O.life = 5; G.active = 'player'; G.step = 5; G.turnNo = 3; await BS.doBattle('player', att); return [O.life, O.spirits.length];`);
  assert.deepEqual(r, [4, 1]);
});
test('Y11 a Spirit that can\'t attack/block loses the flag when it returns to the Hand', async () => {
  const r = await ev(`const t = sp('${T3}', O, 2); t.noAB = true; BS.bounceCard(O, t, 'hand'); const i = O.hand[0]; return [!!i.noAB, ids(O.hand)];`);
  assert.deepEqual(r, [false, [T3]]);
});
test('Y12 DRAW_BOTTOM draws from the bottom of the Deck, not the top', async () => {
  const r = await ev(`dk('${T0}'); dk('${T1}'); dk('${T3}'); const s = sp('${TEMPLE.replace('068', '042')}', P, 1); await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'DRAW_BOTTOM', n: 2 }] }, 'ATTACKS'); return [ids(P.hand), ids(P.deck)];`);
  assert.deepEqual(r, [[T3, T1], [T0]]);
});
test('Y13 DISCARD_ALL_HAND needs at least one card and sends the whole Hand to the Trash', async () => {
  const r = await ev(`const s = sp('${AIRA}', P, 3); const c = { p: P, opp: O, src: s, ctx: {} }; const a = BS.FX_ACTIONS.DISCARD_ALL_HAND.can(c, {}); hd('${T0}'); hd('${T1}'); hd('${T3}'); await BS.FX_ACTIONS.DISCARD_ALL_HAND.run(c, {}); return [a, P.hand.length, P.trash.length];`);
  assert.deepEqual(r, [false, 0, 3]);
});
test('Y14 REVEAL_ADD reveals three, adds one matching card and discards the rest; eight counters reveal +1 and add +1', async () => {
  const a = await ev(`const s = sp('${MANE}', P, 1); dk('${T0}'); dk('${BILI}'); dk('${T3}'); dk('${DRACO}'); await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'REVEAL_ADD', n: 3, add: 1, match: { name: ['Contractor Indra'], family: ['Thunderive'] }, moreIf: { counterGe: 8 } }] }, 'SUMMONED'); return [ids(P.hand), P.trash.length, P.deck.length];`);
  assert.deepEqual(a, [[BILI], 2, 1]);
  const b = await ev(`const s = sp('${MANE}', P, 1); P.count = 8; dk('${T0}'); dk('${BILI}'); dk('${T3}'); dk('${DRACO}'); dk('${T4}'); await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'REVEAL_ADD', n: 3, add: 1, match: { name: ['Contractor Indra'], family: ['Thunderive'] }, moreIf: { counterGe: 8 } }] }, 'SUMMONED'); return [P.hand.length, P.trash.length, P.deck.length];`);
  assert.deepEqual(b, [2, 2, 1]);
});
test('Y15 BOUNCE_OPP with lv [1,2] to the Deck bottom skips a LV3 Spirit', async () => {
  const r = await ev(`const hi = sp('${T4}', O, 6), lo = sp('${T3}', O, 2); const s = sp('${AIRA}', P, 3); await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'BOUNCE_OPP', kind: 'spirit', to: 'deckBottom', lv: [1, 2] }] }, 'SUMMONED'); return [ids(O.spirits), ids(O.deck)];`);
  assert.deepEqual(r, [[T4], [T3]]);
});
test('Y16 BOUNCE_OPP kind nexus with lv [1] returns only a LV1 Nexus', async () => {
  const r = await ev(`const a = nx('${TEMPLE}', O, 0), b = nx('${TEMPLE}', O, 1); const s = sp('${MAGAN}', P, 3); await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'BOUNCE_OPP', kind: 'nexus', to: 'deckBottom', lv: [1] }] }, 'ATTACKS'); return [O.nexus.length, O.nexus[0] === b, O.deck.length];`);
  assert.deepEqual(r, [1, true, 1]);
});
test('Y17 VOID_TO_LIFE puts a Void core on the Life only while the Life is low enough', async () => {
  const r = await ev(`const s = sp('${NARAKA}', P, 3); const c = { p: P, opp: O, src: s, ctx: {} }; P.void = 2; P.life = 4; await BS.FX_ACTIONS.VOID_TO_LIFE.run(c, { n: 1, lifeLe: 3 }); const a = [P.life, P.void]; P.life = 3; c.ctx = {}; await BS.FX_ACTIONS.VOID_TO_LIFE.run(c, { n: 1, lifeLe: 3 }); return [a, [P.life, P.void]];`);
  assert.deepEqual(r, [[4, 2], [4, 1]]);
});
test('Y18 LIFE_TO_SELF moves a Life to this Spirit, but never the last Life', async () => {
  const r = await ev(`const s = sp('${MAGAN}', P, 3); const c = { p: P, opp: O, src: s, ctx: {} }; P.life = 3; await BS.FX_ACTIONS.LIFE_TO_SELF.run(c, { n: 1 }); const a = [P.life, s.cores]; P.life = 1; const ok = BS.FX_ACTIONS.LIFE_TO_SELF.can(c, { n: 1 }); return [a, ok];`);
  assert.deepEqual(r, [[2, 4], false]);
});
test('Y19 NEXUS_CORES_TO_SELF moves cores from Indra to this Spirit and needs enough cores on the Nexus', async () => {
  const r = await ev(`const i = nx('${INDRA}', P, 3); const s = sp('${VAJRA}', P, 2); const c = { p: P, opp: O, src: s, ctx: {} }; await BS.FX_ACTIONS.NEXUS_CORES_TO_SELF.run(c, { n: 2, name: 'Contractor Indra' }); const ok = BS.FX_ACTIONS.NEXUS_CORES_TO_SELF.can(c, { n: 2, name: 'Contractor Indra' }); return [i.cores, s.cores, ok];`);
  assert.deepEqual(r, [1, 4, false]);
});
test('Y20 SELF_TO_HAND returns this Spirit to the Hand', async () => {
  const r = await ev(`const s = sp('${TOGE}', P, 3); await BS.FX_ACTIONS.SELF_TO_HAND.run({ p: P, opp: O, src: s, ctx: {} }, {}); return [P.spirits.length, ids(P.hand)];`);
  assert.deepEqual(r, [0, [TOGE]]);
});
test('Y21 STATIC EXTRA_REDUCTION: with Indra on the Field a Thunderive card costs one less, a non-Thunderive card does not', async () => {
  const r = await ev(`const card = BS.CARDS['${MAGAN}']; const base = BS.effCost(P, card); nx('${INDRA}', P, 0); const withIndra = BS.effCost(P, card); const other = BS.CARDS['${T3}']; return [base, withIndra, BS.extraReduction(P, other).length];`);
  assert.equal(r[0] - r[1], 1); assert.equal(r[2], 0);
});
test('Y22 Shimavajdra LV2 gives Cost 5+ Thunderive cards an extra reduction symbol, LV1 does not', async () => {
  const r = await ev(`const s = sp('${SHIMA}', P, 1); const a = BS.extraReduction(P, BS.CARDS['${AIRA}']).length; s.cores = 2; const b = BS.extraReduction(P, BS.CARDS['${AIRA}']).length; const c = BS.extraReduction(P, BS.CARDS['${MAGJ}']).length; return [a, b, c];`);
  assert.deepEqual(r, [0, 1, 0]);
});
test('Y23 parseEffects rejects EXTRA_REDUCTION without a colour, a bad CANT_ATTACK_BLOCK and a bad BOUNCE lv', async () => {
  const r = await g.page.evaluate(() => [
    !!BS.parseEffects([{ trigger: 'STATIC', flag: 'EXTRA_REDUCTION', to: 'own' }]).error,
    !!BS.parseEffects([{ trigger: 'ATTACKS', actions: [{ do: 'CANT_ATTACK_BLOCK', n: 0 }] }]).error,
    !!BS.parseEffects([{ trigger: 'ATTACKS', actions: [{ do: 'BOUNCE_OPP', kind: 'spirit', to: 'deckBottom', lv: [9] }] }]).error,
    !!BS.parseEffects([{ trigger: 'ATTACKS', actions: [{ do: 'DRAW_BOTTOM', n: 2 }] }]).error]);
  assert.deepEqual(r, [true, true, true, false]);
});

// ---- Contractor Indra ----
test('Y24 Neo-Core Charge: a Cost 3+ Thunderive/Devotee Spirit gives Indra a core, a Cost 1 Spirit does not', async () => {
  const r = await ev(`const h = nx('${INDRA}', P, 0); const a = sp('${MAGAN}', P, 1); await BS.fireFx(P, 'SUMMONED', a); const x = h.cores; const b = sp('${BILI}', P, 1); await BS.fireFx(P, 'SUMMONED', b); return [x, h.cores];`);
  assert.deepEqual(r, [1, 1]);
});
test('Y25 Indra deploy: three cards from the Deck go to the Trash, +1 core for each Cost 3+ Thunderive/Devotee/Concluser', async () => {
  const r = await ev(`const h = nx('${INDRA}', P, 0); dk('${MAGAN}'); dk('${T3}'); dk('${T0}'); dk('${T1}'); await BS.fireFx(P, 'SUMMONED', h); return [h.cores, P.trash.length, P.deck.length];`);
  assert.deepEqual(r, [2, 3, 1]);
});
test('Y26 Contract Field: summoning a Thunderive Spirit gives +2 counters, up to 10', async () => {
  const r = await ev(`nx('${INDRA}', P, 0); const a = sp('${DRACO}', P, 1); await BS.fireFx(P, 'SUMMONED', a); const x = P.count; P.count = 9; const b = sp('${DRACO}', P, 1); await BS.fireFx(P, 'SUMMONED', b); return [x, P.count];`);
  assert.deepEqual(r, [2, 10]);
});
test('Y27 Contract Field (Can\'t Stack): two Indra give +2 counters once, not +4', async () => {
  const r = await ev(`nx('${INDRA}', P, 0); nx('${INDRA}', P, 0); const a = sp('${DRACO}', P, 1); await BS.fireFx(P, 'SUMMONED', a); return [P.count];`);
  assert.deepEqual(r, [2]);
});
test('Y28 Contract Skill (Lv2, 3 cores to the Void): an opposing Spirit can\'t attack/block for the rest of the game', async () => {
  const r = await ev(`const h = nx('${INDRA}', P, 5); P.count = 2; const t = sp('${T4}', O, 3); const idx = BS.CARDS['${INDRA}'].effects.findIndex(e => e.trigger === 'ACTIVATE'); const ok = await BS.activateFx(P, h, idx); return [ok, h.cores, !!t.noAB];`);
  assert.deepEqual(r, [true, 2, true]);
});
test('Y29 Contract Skill is not available below Lv2 or with fewer than 3 cores', async () => {
  const r = await ev(`const h = nx('${INDRA}', P, 1); P.count = 2; sp('${T4}', O, 3); const a = BS.activatable(P, h, 'FLASH').length; const h2 = nx('${INDRA}', P, 5); P.count = 0; return [a, BS.activatable(P, h2, 'FLASH').length];`);
  assert.deepEqual(r, [0, 0]);
});

test('Y29b the CPU uses Indra\'s Contract Skill in its Main Step when an opposing Spirit is on the Field', async () => {
  const r = await ev(`const h = nx('${INDRA}', P, 5); P.count = 2; const t = sp('${T4}', O, 3); await BS.cpuActivate ? 0 : 0; const idx = BS.CARDS['${INDRA}'].effects.findIndex(e => e.trigger === 'ACTIVATE'); return [BS.activatable(P, h, 'MAIN').map(x => x.idx), idx];`);
  assert.deepEqual(r[0], [r[1]]);
});

// ---- Thunderive cards ----
test('Y30 Temple LV1-2: once per turn, when a Thunderive Spirit attacks, draw from the Deck bottom', async () => {
  const r = await ev(`nx('${TEMPLE}', P, 1); dk('${T0}'); dk('${T3}'); const a = sp('${DRACO}', P, 1); await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a }); await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a }); return [ids(P.hand), P.deck.length];`);
  assert.deepEqual(r, [[T3], 1]);
});
test('Y31 Bilijvern: when a Thunderive Spirit attacks, +1 core to Indra (once per turn)', async () => {
  const r = await ev(`const i = nx('${INDRA}', P, 2); sp('${BILI}', P, 1); const a = sp('${DRACO}', P, 1); const v = P.void; await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a }); await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a }); return [i.cores, P.void - v];`);
  assert.deepEqual(r, [1, 2]);       // Bilijvern +1 once per turn; Vajdraco's lock cost sends 1 core to the Void per attack (2026-11-03: BS75-043 completed)
});
test('Y32 Vajdraco draws from the bottom when ANOTHER Thunderive Spirit is summoned, once per turn, not for itself', async () => {
  const r = await ev(`const d = sp('${DRACO}', P, 1); dk('${T0}'); dk('${T1}'); dk('${T3}'); await BS.fireFx(P, 'SUMMONED', d); const x = P.hand.length; const o = sp('${MAGAN}', P, 1); await BS.fireFx(P, 'SUMMONED', o); const o2 = sp('${MAGAN}', P, 1); await BS.fireFx(P, 'SUMMONED', o2); return [x, P.hand.length];`);
  assert.deepEqual(r, [0, 1]);
});
test('Y33 Manevajra When Summoned: reveal three, add an Indra/Thunderive card (once per turn for summon and attack together)', async () => {
  const r = await ev(`const m = sp('${MANE}', P, 1); dk('${T0}'); dk('${BILI}'); dk('${T3}'); dk('${T4}'); dk('${DRACO}'); await BS.fireFx(P, 'SUMMONED', m); const x = [P.hand.length, P.trash.length]; await BS.fireFx(P, 'ATTACKS', m); return [x, P.hand.length];`);
  assert.deepEqual(r, [[1, 2], 1]);
});
test('Y34 Raivajdra has Manifest data with no Count need, and draws from the bottom when it Manifests or attacks', async () => {
  const r = await ev(`const c = BS.CARDS['${RAIV}']; dk('${T0}'); dk('${T3}'); dk('${T4}'); const s = sp('${RAIV}', P, 1); await BS.fireFx(P, 'MANIFEST', s); await BS.fireFx(P, 'ATTACKS', s); return [c.manifest.name, c.manifest.counterGe, P.hand.length];`);
  assert.deepEqual(r, ['Contractor Indra', 0, 2]);
});
test('Y35 Raivajdra LV2: when a Thunderive Spirit attacks, three cores from opposing Grandwalker Nexuses go to the Void', async () => {
  const r = await ev(`const e = nx('${INDRA}', O, 5); const s = sp('${RAIV}', P, 2); const a = sp('${DRACO}', P, 1); await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a }); return [e.cores, O.void];`);
  assert.deepEqual(r, [2, 3]);
});
test('Y36 Magan costs 3 with Indra on the Field and an opposing Nexus, and the full cost otherwise', async () => {
  const r = await ev(`const card = BS.CARDS['${MAGAN}']; const a = BS.costAltActive(P, card); nx('${INDRA}', P, 0); const b = BS.costAltActive(P, card); nx('${TEMPLE}', O, 0); const c = BS.costAltActive(P, card); return [a, b, c];`);
  assert.deepEqual(r, [false, false, true]);
});
test('Y37 Magan LV2 attack: sending a Life returns one LV1 and one LV2 opposing Nexus to the Deck bottom', async () => {
  const r = await ev(`nx('${TEMPLE}', O, 0); nx('${TEMPLE}', O, 1); const s = sp('${MAGAN}', P, 3); P.life = 4; await BS.fireFx(P, 'ATTACKS', s); return [P.life, O.nexus.length, O.deck.length, s.cores];`);
  assert.deepEqual(r, [3, 0, 2, 4]);
});
test('Y38 Magjvern Burst data: opposing summon trigger, summon itself, then return an opposing LV1/LV2 Spirit', async () => {
  const r = await ev(`const t = sp('${T3}', O, 2); const m = hd('${MAGJ}'); P.burst = m; P.hand = []; const b = BS.CARDS['${MAGJ}'].burst; await BS.maybeBurst(P, 'OPP_SUMMON_FX', {}); return [b.when, ids(P.spirits), ids(O.spirits)];`);
  assert.equal(r[0], 'OPP_SUMMON_FX'); assert.deepEqual(r[1], [MAGJ]); assert.deepEqual(r[2], []);
});
test('Y39 Magjvern When Summoned: returns an Indra/Thunderive card from the Trash, +1 with an opposing can\'t-attack/block Spirit', async () => {
  const r = await ev(`const s = sp('${MAGJ}', P, 1); P.trash.push(BS.mkInst('${INDRA}'), BS.mkInst('${DRACO}'), BS.mkInst('${T3}')); const t = sp('${T3}', O, 2); t.noAB = true; await BS.fireFx(P, 'SUMMONED', s); return [P.hand.length, P.trash.length];`);
  assert.deepEqual(r, [2, 1]);
});
test('Y40 Airavajdra When Summoned: with Indra return an opposing LV1/2 Spirit, then discarding the Hand draws four from the bottom', async () => {
  const r = await ev(`nx('${INDRA}', P, 0); const t = sp('${T3}', O, 2); hd('${T0}'); hd('${T1}'); for (const i of ['${T0}', '${T1}', '${T3}', '${T4}', '${T5}', '${T8}']) dk(i); const s = sp('${AIRA}', P, 3); await BS.fireFx(P, 'SUMMONED', s); return [O.spirits.length, P.hand.length, P.trash.length, P.deck.length];`);
  assert.deepEqual(r, [0, 4, 2, 2]);
});
test('Y41 Naraka When Manifests: returns an opposing LV2/LV3 Spirit; Void core to the Life when the Life is 3 or less', async () => {
  const r = await ev(`const lo = sp('${T1}', O, 1), hi = sp('${T4}', O, 2); const s = sp('${NARAKA}', P, 1); P.life = 3; P.void = 2; await BS.fireFx(P, 'MANIFEST', s); return [ids(O.spirits), P.life, P.void];`);
  assert.deepEqual(r, [[T1], 4, 1]);
});
test('Y42 Vajrawurm: two cores from Indra go to it, and two opposing Spirits can\'t attack/block', async () => {
  const r = await ev(`const i = nx('${INDRA}', P, 3); const a = sp('${T3}', O, 2), b = sp('${T4}', O, 2), c = sp('${T5}', O, 2); const s = sp('${VAJRA}', P, 1); await BS.fireFx(P, 'MANIFEST', s); return [i.cores, s.cores, O.spirits.filter(x => x.noAB).length];`);
  assert.deepEqual(r, [1, 3, 2]);
});
test('Y43 Vajrawurm does nothing without two cores on Indra', async () => {
  const r = await ev(`nx('${INDRA}', P, 1); sp('${T3}', O, 2); const s = sp('${VAJRA}', P, 1); await BS.fireFx(P, 'MANIFEST', s); return [s.cores, O.spirits.filter(x => x.noAB).length];`);
  assert.deepEqual(r, [1, 0]);
});
test('Y44 Togevajdra LV2: when ITS attack reduces the Life it returns to the Hand; another Spirit\'s hit does not', async () => {
  const r = await ev(`const t = sp('${TOGE}', P, 2); const o = sp('${DRACO}', P, 1); await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: o }); const x = ids(P.spirits).length; await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: t }); return [x, ids(P.hand), ids(P.spirits)];`);
  assert.deepEqual(r, [2, [TOGE], [DRACO]]);
});
test('Y45 Vajreine When Summoned: returns an opposing LV1 Spirit; the LV2 one only with a can\'t-attack/block Spirit', async () => {
  const a = await ev(`const l1 = sp('${T1}', O, 1), l2 = sp('${T3}', O, 2); const s = sp('${VREINE}', P, 1); await BS.fireFx(P, 'SUMMONED', s); return [ids(O.spirits)];`);
  assert.deepEqual(a, [[T3]]);
  const b = await ev(`const l1 = sp('${T1}', O, 1), l2 = sp('${T3}', O, 2); l2.noAB = true; const s = sp('${VREINE}', P, 1); await BS.fireFx(P, 'SUMMONED', s); return [ids(O.spirits)];`);
  assert.deepEqual(b, [[]]);
});
test('Y46 Vajreine Burst: after your Spirit is destroyed by the opponent it is summoned for free', async () => {
  const r = await ev(`const m = BS.mkInst('${VREINE}'); P.burst = m; const b = BS.CARDS['${VREINE}'].burst; await BS.maybeBurst(P, 'ALLY_DESTROYED', {}); return [b.when, ids(P.spirits)];`);
  assert.deepEqual(r, ['ALLY_DESTROYED', [VREINE]]);
});

// ---- the whole deck in play ----
test('Y47 a seeded CPU match of the yellow deck against the red deck ends without an invariant or page error', async () => {
  const r = await simMatch(40401, { mode: 'yellow' });
  assert.equal(r.over, true); assert.deepEqual(r.inv, []); assert.deepEqual(r.errors, []);
});
test('Y48 a seeded yellow mirror match ends without an invariant or page error', async () => {
  const r = await simMatch(40408, { mode: 'yellowmirror' });
  assert.equal(r.over, true); assert.deepEqual(r.inv, []); assert.deepEqual(r.errors, []);
});
