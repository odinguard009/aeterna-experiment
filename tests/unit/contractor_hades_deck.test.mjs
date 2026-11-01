// v0.39 colour expansion, purple: Contractor Hades / Sorcerer (Infernal Lord) deck. Card data from the owner-supplied Fandom export; Hades' Neo-Core Charge target,
// Lv2 threshold (5 cores) and the Nether Temple Lv2 threshold read from yuyu-tei.jp.
// New engine vocabulary: MILL, DISCARD_HAND, OPP_CORES_TO_RESERVE, COUNTER_ONCE, DESTROY coresLe, match.color, condition oppSpiritsLe. Quiet boards only.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const HADES = 'BS68-CX01', TEMPLE = 'BS68-070', SOLD = 'BS68-012', HOUND = 'BS68-014', GALA = 'BS68-015', HEIN = 'BS68-016', NAB = 'BS68-017', PHEN = 'BS68-018',
  JAVIR = 'BS68-019', VOLG = 'BS68-020', GADI = 'BS68-022', VAP = 'BS68-023', DELLS = 'BS68-NX01', ALVAN = 'BS68-021';
// red targets from the built-in pack: cost 0 (1 core to stay), 3, 4, 5, 8
const T0 = 'BS75-001', T1 = 'BS75-004', T3 = 'BS75-006', T4 = 'BS75-008', T5 = 'BS75-011', T8 = 'BS75-013';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; }, dk = (id, q = P) => { const i = BS.mkInst(id); q.deck.push(i); return i; };
  const ids = L => L.map(x => x.id);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);
const PURPLE = [HADES, TEMPLE, SOLD, HOUND, GALA, HEIN, NAB, PHEN, JAVIR, VOLG, GADI, VAP, DELLS, ALVAN];

// ---- data ----
test('P01 the 14 purple cards of the deck are in the pack, all purple, with an image name', async () => {
  const r = await g.page.evaluate(L => L.map(i => { const c = BS.CARDS[i]; return !!c && (c.colors || [c.symbol]).includes('purple') && !!c.image; }), PURPLE);
  assert.deepEqual(r, PURPLE.map(() => true));
});
test('P02 Contractor Hades: Contract Grandwalker Nexus (cost 2, one symbol), Revive, Lv2 at 5 cores', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [c.type, c.cost, c.symbols, c.contract, c.revive, c.levels.map(l => l.cores), c.families.includes('Grandwalker'), c.reduction]; }, HADES);
  assert.deepEqual(r, ['Nexus', 2, 1, true, true, [0, 5], true, { purple: 1 }]);
});
test('P03 the prebuilt purple deck has 40 cards, is legal in Eternal and uses only pack cards', async () => {
  const r = await g.page.evaluate(() => { const d = BS.PREBUILT.find(x => x.id === 'purple'); const v = BS.validateDeck(d.cards, 'eternal'); return [v.total, v.errors, Object.keys(d.cards).every(i => !!BS.CARDS[i]), Object.keys(d.cards).length]; });
  assert.deepEqual(r, [40, [], true, 14]);
});
test('P04 the purple deck file matches the prebuilt deck', async () => {
  const fs = await import('node:fs'); const txt = fs.readFileSync(new URL('../../data/decks/purple-hades-sorcerer.txt', import.meta.url), 'utf8');
  const file = {}; for (const l of txt.split('\n')) { const t = l.split('#')[0].trim().split(/\s+/); if (t.length === 2) file[t[1]] = Number(t[0]); }
  assert.deepEqual(file, await g.page.evaluate(() => BS.PREBUILT.find(x => x.id === 'purple').cards));
});
test('P05 Hades Nether Temple is a Nexus with Lv2 at 1 core', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [c.type, c.cost, c.levels.map(l => l.cores)]; }, TEMPLE);
  assert.deepEqual(r, ['Nexus', 3, [0, 1]]);
});

// ---- new vocabulary ----
test('P06 condition oppSpiritsLe: true with no opposing Spirit, false with one', async () => {
  const r = await ev(`const f = () => BS.fxIf(P, O, { oppSpiritsLe: 0 }, {}); const a = f(); sp('${T3}', O); return [a, f()];`);
  assert.deepEqual(r, [true, false]);
});
test('P07 DESTROY coresLe only reaches Spirits with that many cores or less', async () => {
  const r = await ev(`const a = sp('${T3}', O, 4), b = sp('${T4}', O, 2); const h = sp('${HEIN}', P, 4); await BS.runActions({ p: P, opp: O, src: h, ctx: {} }, { actions: [{ do: 'DESTROY', coresLe: 2 }] }, 'ATTACKS'); return [ids(O.spirits), ids(O.trash)];`);
  assert.deepEqual(r, [[T3], [T4]]);
});
test('P08 parseEffects rejects a bad coresLe and a MILL without n', async () => {
  const r = await g.page.evaluate(() => [!!BS.parseEffects([{ trigger: 'ATTACKS', actions: [{ do: 'DESTROY', coresLe: -1 }] }]).error, !!BS.parseEffects([{ trigger: 'ATTACKS', actions: [{ do: 'MILL' }] }]).error, !!BS.parseEffects([{ trigger: 'ATTACKS', actions: [{ do: 'DESTROY', coresLe: 2 }] }]).error]);
  assert.deepEqual(r, [true, true, false]);
});

// ---- Contractor Hades ----
test('P09 Neo-Core Charge: a Cost 3+ Infernal Lord/Devotee Spirit gives Hades a core, a Cost 1 Spirit does not', async () => {
  const r = await ev(`const h = nx('${HADES}', P, 0); const a = sp('${HEIN}', P, 1); await BS.fireFx(P, 'SUMMONED', a); const x = h.cores; const b = sp('${T1}', P, 1); await BS.fireFx(P, 'SUMMONED', b); return [x, h.cores];`);
  assert.deepEqual(r, [1, 1]);
});
test('P10 Hades deploy: three cards from the Deck go to the Trash, +1 core for each Infernal Lord/Devotee/Concluser Cost 3+', async () => {
  const r = await ev(`const h = nx('${HADES}', P, 0); dk('${HEIN}'); dk('${SOLD}'); dk('${T0}'); dk('${T3}'); await BS.fireFx(P, 'SUMMONED', h); return [h.cores, P.trash.length, P.deck.length];`);
  assert.deepEqual(r, [2, 3, 1]);
});
test('P11 Hades Contract Skill: discard a Purple card, up to 2 cores of an opposing Spirit go to the Reserve, counter +2', async () => {
  const r = await ev(`const h = nx('${HADES}', P, 4); hd('${SOLD}'); const t = sp('${T4}', O, 4); const ok = await BS.activateFx(P, h, 2); return [ok, h.cores, t.cores, P.hand.length, P.trash.length, P.count, O.reserve.n];`);
  assert.deepEqual(r, [true, 2, 2, 0, 1, 2, 12]);
});
test('P12 Hades Contract Skill is not available without a Purple card in the Hand', async () => {
  const r = await ev(`const h = nx('${HADES}', P, 4); hd('${T3}'); sp('${T4}', O, 4); return [BS.activatable(P, h, 'FLASH').length];`);
  assert.deepEqual(r, [0]);
});
test('P13 Hades Contract Skill: the counter +2 is once per turn, the core removal is not', async () => {
  const r = await ev(`const h = nx('${HADES}', P, 8); hd('${SOLD}'); hd('${HEIN}'); const t = sp('${T8}', O, 8); await BS.activateFx(P, h, 2); await BS.activateFx(P, h, 2); return [t.cores, P.count, h.cores];`);
  assert.deepEqual(r, [4, 2, 4]);
});
test('P14 Hades Nether Temple deploy: counter +1, reveal 3, a Purple Sorcerer goes to the Hand and the rest to the Trash', async () => {
  const r = await ev(`const t = nx('${TEMPLE}', P, 1); dk('${T0}'); dk('${SOLD}'); dk('${T3}'); dk('${T4}'); await BS.fireFx(P, 'SUMMONED', t); return [P.count, ids(P.hand), ids(P.trash), ids(P.deck)];`);
  assert.deepEqual(r, [1, [SOLD], [T0, T3], [T4]]);
});
test('P15 Hades Nether Temple: no Purple Sorcerer among the three cards means all three are discarded', async () => {
  const r = await ev(`const t = nx('${TEMPLE}', P, 1); dk('${T0}'); dk('${T3}'); dk('${T4}'); await BS.fireFx(P, 'SUMMONED', t); return [P.count, P.hand.length, P.trash.length];`);
  assert.deepEqual(r, [1, 0, 3]);
});

// ---- Sorcerers ----
test('P16 Infernal Soldier summon: a core goes to the Reserve, discarding a card sends a second one', async () => {
  const r = await ev(`const s = sp('${SOLD}', P, 1); hd('${T3}'); const t = sp('${T4}', O, 4); await BS.fireFx(P, 'SUMMONED', s); return [t.cores, P.hand.length, P.trash.length];`);
  assert.deepEqual(r, [2, 0, 1]);
});
test('P17 Infernal Soldier: once per turn across summon and attack', async () => {
  const r = await ev(`const s = sp('${SOLD}', P, 1); const t = sp('${T8}', O, 8); await BS.fireFx(P, 'SUMMONED', s); const a = t.cores; await BS.fireFx(P, 'ATTACKS', s); return [a, t.cores];`);
  assert.deepEqual(r, [7, 7]);
});
test('P18 Hound-Beros with Hades: an Infernal Lord among the two milled cards gives counter +1 and a draw', async () => {
  const r = await ev(`nx('${HADES}', P, 0); const h = sp('${HOUND}', P, 1); dk('${HEIN}'); dk('${T0}'); dk('${T3}'); await BS.fireFx(P, 'SUMMONED', h); return [P.count, P.hand.length, P.trash.length];`);
  assert.deepEqual(r, [1, 1, 2]);
});
test('P19 Hound-Beros: no Infernal Lord means no counter or draw, and without Hades nothing is milled', async () => {
  const a = await ev(`nx('${HADES}', P, 0); const h = sp('${HOUND}', P, 1); dk('${T0}'); dk('${T3}'); await BS.fireFx(P, 'SUMMONED', h); return [P.count, P.hand.length, P.trash.length];`);
  const b = await ev(`const h = sp('${HOUND}', P, 1); dk('${HEIN}'); dk('${T0}'); await BS.fireFx(P, 'SUMMONED', h); return [P.count, P.hand.length, P.trash.length];`);
  assert.deepEqual(a, [0, 0, 2]); assert.deepEqual(b, [0, 0, 0]);
});
test('P20 Galatiark summon: draws a card, and with six counters destroys an opposing Spirit with three cores or less', async () => {
  const a = await ev(`const s = sp('${GALA}', P, 1); dk('${T0}'); const t = sp('${T4}', O, 3); await BS.fireFx(P, 'SUMMONED', s); return [P.hand.length, O.spirits.length];`);
  const b = await ev(`P.count = 6; const s = sp('${GALA}', P, 1); dk('${T0}'); const t = sp('${T4}', O, 3), u = sp('${T5}', O, 4); await BS.fireFx(P, 'SUMMONED', s); return [P.hand.length, ids(O.spirits)];`);
  assert.deepEqual(a, [1, 1]); assert.deepEqual(b, [1, [T5]]);
});
test('P21 Galatiark destroyed: draws a card as well', async () => {
  const r = await ev(`const s = sp('${GALA}', P, 1); dk('${T0}'); BS.removeSpirit(P, s, 'destroyed', true); await BS.flushBursts(); return [P.hand.length];`);
  assert.deepEqual(r, [1]);
});
test('P22 Heineza summon: two cards milled, Contractor Hades returns from the Trash to the Hand', async () => {
  const r = await ev(`const h = sp('${HEIN}', P, 1); P.trash.push(BS.mkInst('${HADES}')); dk('${T0}'); dk('${T3}'); await BS.fireFx(P, 'SUMMONED', h); return [ids(P.hand), P.trash.length];`);
  assert.deepEqual(r, [[HADES], 2]);
});
test('P23 Heineza LV2 attack: destroys a Spirit with two cores or less and draws when you control Hades; LV1 does nothing', async () => {
  const a = await ev(`nx('${HADES}', P, 0); dk('${T0}'); const h = sp('${HEIN}', P, 2); const t = sp('${T4}', O, 2); await BS.fireFx(P, 'ATTACKS', h); return [O.spirits.length, P.hand.length];`);
  const b = await ev(`dk('${T0}'); const h = sp('${HEIN}', P, 1); const t = sp('${T4}', O, 2); await BS.fireFx(P, 'ATTACKS', h); return [O.spirits.length, P.hand.length];`);
  assert.deepEqual(a, [0, 1]); assert.deepEqual(b, [1, 0]);
});
test('P24 Naberidus: by discarding a card draw two, once per turn; with an empty Hand nothing happens', async () => {
  const a = await ev(`const s = sp('${NAB}', P, 1); hd('${T3}'); dk('${T0}'); dk('${T4}'); dk('${T5}'); await BS.fireFx(P, 'SUMMONED', s); const x = [P.hand.length, P.trash.length]; await BS.fireFx(P, 'ATTACKS', s); return [x, P.hand.length];`);
  const b = await ev(`const s = sp('${NAB}', P, 1); dk('${T0}'); dk('${T4}'); await BS.fireFx(P, 'SUMMONED', s); return [P.hand.length];`);
  assert.deepEqual(a, [[2, 1], 2]); assert.deepEqual(b, [0]);
});
test('P25 Phenlese: draws two once per turn and carries the Contractor Hades Manifest data (5 counters, either Attack Step)', async () => {
  const r = await ev(`const s = sp('${PHEN}', P, 1); dk('${T0}'); dk('${T3}'); dk('${T4}'); await BS.fireFx(P, 'SUMMONED', s); return [P.hand.length, BS.CARDS['${PHEN}'].manifest];`);
  assert.deepEqual(r, [2, { name: 'Contractor Hades', counterGe: 5, turn: 'EITHER_ATTACK' }]);
});
test('P26 Javir summon: destroying a Spirit with three cores or less draws two; nothing to destroy means no draw', async () => {
  const a = await ev(`const s = sp('${JAVIR}', P, 1); dk('${T0}'); dk('${T3}'); sp('${T4}', O, 3); await BS.fireFx(P, 'SUMMONED', s); return [O.spirits.length, P.hand.length];`);
  const b = await ev(`const s = sp('${JAVIR}', P, 1); dk('${T0}'); dk('${T3}'); sp('${T4}', O, 5); await BS.fireFx(P, 'SUMMONED', s); return [O.spirits.length, P.hand.length];`);
  assert.deepEqual(a, [0, 2]); assert.deepEqual(b, [1, 0]);
});
test('P27 Javir LV2 attack: an extra symbol only while the opponent controls no Spirit', async () => {
  const r = await ev(`const s = sp('${JAVIR}', P, 3); G.attacker = s; await BS.fireFx(P, 'ATTACKS', s); const a = s.symBattle || 0; s.symBattle = 0; sp('${T3}', O, 1); await BS.fireFx(P, 'ATTACKS', s); return [a, s.symBattle || 0];`);
  assert.deepEqual(r, [1, 0]);
});
test('P28 Gadirac: LV2 attack refreshes only when the opponent controls no Spirit; the Burst data destroys two Spirits with three cores or less', async () => {
  const r = await ev(`const s = sp('${GADI}', P, 2); s.exhausted = true; sp('${T3}', O, 1); await BS.fireFx(P, 'ATTACKS', s); const a = s.exhausted; O.spirits = []; P.onceUsed = {}; s.fxUsed = {}; await BS.fireFx(P, 'ATTACKS', s);
    const b = BS.CARDS['${GADI}'].burst; return [a, s.exhausted, b.when, b.actions.map(x => x.do + (x.coresLe != null ? x.coresLe : ''))];`);
  assert.deepEqual(r, [true, false, 'LIFE_DECREASE', ['DESTROY3', 'DESTROY3', 'MILL', 'SUMMON_SELF']]);
});
test('P29 Gadirac burst actions: two opposing Spirits with three cores or less are destroyed, then the card is summoned without paying', async () => {
  const r = await ev(`const s = BS.mkInst('${GADI}'); P.hand.push(s); const a = sp('${T3}', O, 2), b = sp('${T4}', O, 3), c = sp('${T5}', O, 5); dk('${T0}'); dk('${T3}');
    await BS.runActions({ p: P, opp: O, src: s, ctx: {}, burst: true }, { actions: BS.CARDS['${GADI}'].burst.actions }, 'BURST'); return [ids(O.spirits), P.spirits.some(x => x === s), P.trash.length];`);
  assert.deepEqual(r[0], [T5]); assert.equal(r[1], true);
});
test('P30 Vaplus attack: 2 cores each from two Spirits, a card is drawn for each depleted Spirit', async () => {
  const r = await ev(`const v = sp('${VAP}', P, 3); dk('${T0}'); dk('${T3}'); const a = sp('${T0}', O, 2), b = sp('${T8}', O, 4); await BS.fireFx(P, 'ATTACKS', v); return [O.spirits.length, a.cores, b.cores, P.hand.length, O.reserve.n];`);
  assert.equal(r[0], 1); assert.equal(r[2], 2); assert.equal(r[3], 1); assert.equal(r[4], 14);
});
test('P31 Dells-Vajram summon: three cores from opposing Spirits go to the Reserve (CPU takes them where a Spirit is depleted first)', async () => {
  const r = await ev(`const d = sp('${DELLS}', P, 1); const a = sp('${T0}', O, 1), b = sp('${T8}', O, 5); await BS.fireFx(P, 'SUMMONED', d); return [O.spirits.length, O.spirits.reduce((n, s) => n + s.cores, 0), O.reserve.n];`);
  assert.deepEqual(r, [1, 3, 13]);
});
test('P32 Alvanshell summon: three cores from one opposing Spirit; a Spirit with fewer loses what it has', async () => {
  const r = await ev(`const v = sp('${ALVAN}', P, 1); const a = sp('${T8}', O, 5); await BS.fireFx(P, 'SUMMONED', v); const x = a.cores; const w = sp('${ALVAN}', P, 1); const b = sp('${T3}', O, 1); O.spirits = [b]; await BS.fireFx(P, 'SUMMONED', w); return [x, O.spirits.length];`);
  assert.deepEqual(r, [2, 0]);
});
test('P33 sending cores never affects Spirits with no cores or an empty opposing field (no error, nothing happens)', async () => {
  const r = await ev(`const v = sp('${ALVAN}', P, 1); await BS.fireFx(P, 'SUMMONED', v); return [O.spirits.length, O.reserve.n];`);
  assert.deepEqual(r, [0, 10]);
});
test('P34 Volgoat is a plain Spirit for now: no effects, residual text lists what is missing', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [!c.effects, c.fxComplete === true]; }, VOLG);
  assert.deepEqual(r, [true, false]);
});
test('P35 DISCARD_HAND with a Purple filter only offers Purple cards', async () => {
  const r = await ev(`hd('${T3}'); hd('${SOLD}'); const h = nx('${HADES}', P, 0); return [BS.FX_ACTIONS.DISCARD_HAND.cands({ p: P, opp: O, src: h, ctx: {} }, { n: 1, match: { color: 'purple' } }).map(x => x.id)];`);
  assert.deepEqual(r, [[SOLD]]);
});
