// v0.37 colour expansion, blue: Contractor Nuadha / Scalostle (Dana) deck. Card data from the owner-supplied Fandom export; gaps filled from cardrush-bs.jp.
// New engine vocabulary: DESTROY costLe / costLeSelf / costLeDiscarded / costRank / costBoost, STATIC COST_DESTROY_PLUS (Cost Destruction limit),
// LOOT (draw then discard), CORE_OR_COUNTER (Neo-Core Charge Contract Field), DESTROY_TOTAL byCost, CORE_TO_NEXUS perDestroyedCost,
// effect gate "braved", condition nexusBraved, a Brave card summoned as a Spirit by SUMMON_HAND / REVEAL_DEPLOY (allowBrave). Quiet boards only.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const NUA = 'BS71-CX03', SCOUT = 'BS71-053', SOLDIER = 'BS71-056', MUSK = 'BS71-057', AIDMAN = 'BS72-049', MADEA = 'BS72-050', DIAN = 'BS71-058', VAHA = 'BS72-054', BRO = 'BS71-060';
const SPEAR = 'BS71-063', RIFLE = 'BS71-064', SWORD = 'BS72-068', RAIL = 'BS74-067', TEMPLE = 'BS71-072';
// red targets from the built-in pack: cost 0, 1, 3, 4, 5, 8
const T0 = 'BS75-001', T1 = 'BS75-004', T3 = 'BS75-006', T4 = 'BS75-008', T5 = 'BS75-011', T8 = 'BS75-013';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; }, dk = (id, q = P) => { const i = BS.mkInst(id); q.deck.push(i); return i; };
  const ids = L => L.map(x => x.id);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);
const BLUE = [NUA, TEMPLE, SCOUT, 'BS71-054', SOLDIER, MUSK, AIDMAN, MADEA, 'BS72-051', DIAN, VAHA, BRO, 'BS71-061', 'BS71-X09', SPEAR, RIFLE, SWORD, RAIL];

// ---- data ----
test('B01 the 18 blue cards of the deck are in the pack, all blue, with an image name', async () => {
  const r = await g.page.evaluate(L => L.map(i => { const c = BS.CARDS[i]; return !!c && (c.colors || [c.symbol]).includes('blue') && !!c.image; }), BLUE);
  assert.deepEqual(r, BLUE.map(() => true));
});
test('B02 Contractor Nuadha: Contract Grandwalker Nexus (cost 2, one symbol), Revive, Lv2 at 2 cores', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [c.type, c.cost, c.symbols, c.contract, c.revive, c.levels.map(l => l.cores), c.families.includes('Grandwalker'), c.reduction]; }, NUA);
  assert.deepEqual(r, ['Nexus', 2, 1, true, true, [0, 2], true, { blue: 1 }]);
});
test('B03 the four Saga Braves carry the BP+ and the combine conditions read from cardrush-bs.jp', async () => {
  const r = await g.page.evaluate(L => L.map(i => BS.CARDS[i].brave), [SPEAR, RIFLE, SWORD, RAIL]);
  assert.deepEqual(r, [
    { bp: 3000, family: ['Scalostle'], nexus: { name: ['Contractor Nuadha'] } },
    { bp: 3000, costGe: 4, nexus: { name: ['Contractor Nuadha'] } },
    { bp: 4000, costGe: 4, nexus: { name: ['Contractor Nuadha'] } },
    { bp: 2000, family: ['Scalostle'], costGe: 4, nexus: { name: ['Contractor Nuadha'] } }]);
});
test('B04 the prebuilt blue deck has 40 cards, is legal in Eternal and uses only pack cards', async () => {
  const r = await g.page.evaluate(() => { const d = BS.PREBUILT.find(x => x.id === 'blue'); const v = BS.validateDeck(d.cards, 'eternal'); return [v.total, v.errors, Object.keys(d.cards).every(i => !!BS.CARDS[i]), Object.keys(d.cards).length]; });
  assert.deepEqual(r, [40, [], true, 18]);
});
test('B05 the blue deck file matches the prebuilt deck', async () => {
  const fs = await import('node:fs'); const txt = fs.readFileSync(new URL('../../data/decks/blue-nuadha-scalostle.txt', import.meta.url), 'utf8');
  const file = {}; for (const l of txt.split('\n')) { const t = l.split('#')[0].trim().split(/\s+/); if (t.length === 2) file[t[1]] = Number(t[0]); }
  const r = await g.page.evaluate(() => BS.PREBUILT.find(x => x.id === 'blue').cards);
  assert.deepEqual(file, r);
});
test('B06 the Magic cards and Dagda / Magic Soldier are in the pack after the 2026-11-01 playable pass', async () => {
  const r = await g.page.evaluate(() => ['BS71-083', 'BS71-084', 'BS72-083', 'BS72-X07', 'BS71-059'].map(i => !!BS.CARDS[i]));
  assert.deepEqual(r, [true, true, true, true, true]);
});

// ---- cost based destruction ----
test('B07 Dana Soldier LV2 attack: destroys a Cost 3 Spirit, never a Cost 4 one', async () => {
  const r = await ev(`nx('${NUA}', P, 2); const s = sp('${SOLDIER}', P, 3); const a = sp('${T3}', O), b = sp('${T4}', O); await BS.fireFx(P, 'ATTACKS', s); return ids(O.spirits);`);
  assert.deepEqual(r, [T4]);
});
test('B08 Dana Soldier at LV1 does not destroy (the destruction is LV2 only)', async () => {
  const r = await ev(`nx('${NUA}', P, 2); const s = sp('${SOLDIER}', P, 1); sp('${T3}', O); await BS.fireFx(P, 'ATTACKS', s); return ids(O.spirits);`);
  assert.deepEqual(r, [T3]);
});
test('B09 Musketeer: limit 3, +5 with five counters (destroys a Cost 8 Spirit only then)', async () => {
  const r = await ev(`const m = sp('${MUSK}', P, 1); sp('${T8}', O); P.count = 4; await BS.fireFx(P, 'SUMMONED', m); const a = ids(O.spirits); P.count = 5; await BS.fireFx(P, 'SUMMONED', m); return [a, ids(O.spirits)];`);
  assert.deepEqual(r, [[T8], []]);
});
test('B10 Bulwark Temple LV2: +1 limit per Saga Brave for a Scalostle source (Cost 4 falls, Cost 5 stays)', async () => {
  const r = await ev(`nx('${TEMPLE}', P, 1); const sc = sp('${SCOUT}', P, 2); const b = hd('${SPEAR}'); BS.combineBrave(P, b, sc); const m = sp('${MUSK}', P, 1); sp('${T4}', O); sp('${T5}', O); await BS.fireFx(P, 'SUMMONED', m); return ids(O.spirits);`);
  assert.deepEqual(r, [T5]);
});
test('B11 Bulwark Temple at LV1 gives no bonus', async () => {
  const r = await ev(`nx('${TEMPLE}', P, 0); const sc = sp('${SCOUT}', P, 2); const b = hd('${SPEAR}'); BS.combineBrave(P, b, sc); const m = sp('${MUSK}', P, 1); sp('${T4}', O); await BS.fireFx(P, 'SUMMONED', m); return ids(O.spirits);`);
  assert.deepEqual(r, [T4]);
});
test('B12 Railgun combined with Nuadha: Cost Destruction limit +1', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); const b = hd('${RAIL}'); BS.combineBrave(P, b, n); const m = sp('${MUSK}', P, 1); sp('${T4}', O); await BS.fireFx(P, 'SUMMONED', m); return ids(O.spirits);`);
  assert.deepEqual(r, []);
});
test('B13 Railgun as a Spirit (not on a Nexus) gives no bonus', async () => {
  const r = await ev(`nx('${NUA}', P, 2); sp('${RAIL}', P, 1); const m = sp('${MUSK}', P, 1); sp('${T4}', O); await BS.fireFx(P, 'SUMMONED', m); return ids(O.spirits);`);
  assert.deepEqual(r, [T4]);
});
test('B14 Madea attack (LV2): destroy cost <= its own cost 4, not Cost 5', async () => {
  const r = await ev(`nx('${NUA}', P, 2); const m = sp('${MADEA}', P, 2); sp('${T4}', O); sp('${T5}', O); await BS.fireFx(P, 'ATTACKS', m); return ids(O.spirits);`);
  assert.deepEqual(r, [T5]);
});
test('B15 Vaha destroys the lowest cost Spirit and then a core comes from the Void to one of your Spirits', async () => {
  const r = await ev(`const v = sp('${VAHA}', P, 1); sp('${T1}', O); sp('${T3}', O); const before = P.spirits.reduce((n, s) => n + s.cores, 0); await BS.fireFx(P, 'SUMMONED', v); return [ids(O.spirits), P.spirits.reduce((n, s) => n + s.cores, 0) - before];`);
  assert.deepEqual(r, [[T3], 1]);
});
test('B16 Vaha with an empty opposing Field does nothing', async () => {
  const r = await ev(`const v = sp('${VAHA}', P, 1); const c0 = v.cores; await BS.fireFx(P, 'SUMMONED', v); return [O.spirits.length, v.cores - c0];`);
  assert.deepEqual(r, [0, 0]);
});
test('B17 Brodeur attack: destroys a Spirit up to its Cost 7 and then summons a Scalostle Brave from the Hand as a Spirit', async () => {
  const r = await ev(`const b = sp('${BRO}', P, 1); sp('${T8}', O); sp('${T5}', O); const sw = hd('${SPEAR}'); await BS.fireFx(P, 'ATTACKS', b); return [ids(O.spirits), ids(P.spirits), ids(P.hand)];`);
  assert.deepEqual(r, [[T8], [BRO, SPEAR], []]);
});
test('B18 Brodeur: no Brave summon when nothing was destroyed (prev false)', async () => {
  const r = await ev(`const b = sp('${BRO}', P, 1); sp('${T8}', O); hd('${SPEAR}'); await BS.fireFx(P, 'ATTACKS', b); return [ids(O.spirits), ids(P.hand)];`);
  assert.deepEqual(r, [[T8], [SPEAR]]);
});

// ---- LOOT ----
test('B19 Dana Magic Aidman: draw one, discard one', async () => {
  const r = await ev(`const a = sp('${AIDMAN}', P, 1); dk('${T5}'); dk('${T0}'); await BS.fireFx(P, 'SUMMONED', a); return [P.hand.length, P.trash.length, P.deck.length];`);
  assert.deepEqual(r, [0, 1, 1]);
});
test('B20 Dana Soldier: +1 core to Nuadha, draw two and discard two (draws three with a braved Nuadha)', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); for (let k = 0; k < 6; k++) dk('${T5}'); const s = sp('${SOLDIER}', P, 1); await BS.fireFx(P, 'SUMMONED', s); const a = [n.cores, P.hand.length, P.trash.length];
    const b = hd('${SPEAR}'); BS.combineBrave(P, b, n); P.onceUsed = {}; for (const f of P.spirits.concat(P.nexus)) f.fxUsed = {}; await BS.fireFx(P, 'ATTACKS', s); return [a, P.hand.length, P.trash.length];`);
  assert.equal(r[0][0], 3); assert.deepEqual(r[0].slice(1), [0, 2]); assert.equal(r[1] + r[2], 2 + 3);
});
test('B21 Dana Soldier effect is once per turn across Summoned and Attacks', async () => {
  const r = await ev(`nx('${NUA}', P, 2); for (let k = 0; k < 8; k++) dk('${T5}'); const s = sp('${SOLDIER}', P, 1); await BS.fireFx(P, 'SUMMONED', s); const d1 = P.deck.length; await BS.fireFx(P, 'ATTACKS', s); return [d1, P.deck.length];`);
  assert.deepEqual(r, [6, 6]);
});
test('B22 Type-93 Blaster Rifle as a Spirit: discards a Scalostle card -> destroys a Spirit with cost up to the discarded card', async () => {
  const r = await ev(`const b = sp('${RIFLE}', P, 1); dk('${DIAN}'); sp('${T5}', O); sp('${T8}', O); await BS.fireFx(P, 'SUMMONED', b); return [ids(O.spirits), ids(P.trash)];`);
  assert.deepEqual(r, [[T8], [DIAN]]);
});
test('B23 Type-93 Blaster Rifle: a non-Scalostle discard destroys nothing', async () => {
  const r = await ev(`const b = sp('${RIFLE}', P, 1); dk('${T0}'); sp('${T1}', O); await BS.fireFx(P, 'SUMMONED', b); return [ids(O.spirits), ids(P.trash)];`);
  assert.deepEqual(r, [[T1], [T0]]);
});

// ---- Saga Braves on Nuadha ----
test('B24 Electromagnetic Long Sword as a Spirit: destroys the lowest cost Spirit and Nuadha gets +1 core per cost (max 5)', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 0); const b = sp('${SWORD}', P, 1); sp('${T3}', O); sp('${T5}', O); await BS.fireFx(P, 'SUMMONED', b); return [ids(O.spirits), n.cores];`);
  assert.deepEqual(r, [[T5], 3]);
});
test('B25 the core gain is capped at 5 for a Cost 8 target', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 0); const b = sp('${SWORD}', P, 1); sp('${T8}', O); await BS.fireFx(P, 'SUMMONED', b); return [ids(O.spirits), n.cores];`);
  assert.deepEqual(r, [[], 5]);
});
test('B26 Nexus Brave: Beam Spear (5 cores to the Void) destroys the highest cost Spirit at a Flash timing', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 5); const b = hd('${SPEAR}'); BS.combineBrave(P, b, n); sp('${T3}', O); sp('${T8}', O); G.step = 5; const L = BS.activatable(P, n, 'FLASH').map(x => x.idx); await BS.activateFx(P, n, L[0]); return [L.length, ids(O.spirits), n.cores];`);
  assert.deepEqual(r, [1, [T3], 0]);
});
test('B27 Nexus Brave Beam Spear cannot be used without five cores on Nuadha', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 4); const b = hd('${SPEAR}'); BS.combineBrave(P, b, n); sp('${T8}', O); G.step = 5; return BS.activatable(P, n, 'FLASH').length;`);
  assert.equal(r, 0);
});
test('B28 Nexus Brave Rifle (2 cores): destroys a Cost 5 Spirit, not a Cost 8', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); const b = hd('${RIFLE}'); BS.combineBrave(P, b, n); sp('${T8}', O); sp('${T5}', O); G.step = 5; const L = BS.activatable(P, n, 'FLASH').map(x => x.idx); await BS.activateFx(P, n, L[0]); return [ids(O.spirits), n.cores];`);
  assert.deepEqual(r, [[T8], 0]);
});
test('B29 Nexus Brave Long Sword (3 cores): up to a total Cost 6 (the CPU takes the Cost 5 first, 1 left cannot pay a Cost 3)', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 3); const b = hd('${SWORD}'); BS.combineBrave(P, b, n); sp('${T3}', O); sp('${T3}', O); sp('${T5}', O); G.step = 5; const L = BS.activatable(P, n, 'FLASH').map(x => x.idx); await BS.activateFx(P, n, L[0]); return ids(O.spirits);`);
  assert.deepEqual(r, [T3, T3]);
});
test('B30 Dana Standard Beam Spear combines only with a Scalostle Spirit or Nuadha (not a red Spirit)', async () => {
  const r = await ev(`const b1 = hd('${SPEAR}'), b2 = hd('${SPEAR}'); const red = sp('${T4}', P), sc = sp('${SCOUT}', P), n = nx('${NUA}', P, 2); return [BS.braveFits(b1, red), BS.braveFits(b1, sc), BS.braveFits(b2, n)];`);
  assert.deepEqual(r, [false, true, true]);
});

// ---- Manifest, reveal, Neo-Core Charge ----
test('B31 Dian Manifest needs Contractor Nuadha and two counters', async () => {
  const r = await ev(`const d = hd('${DIAN}'); const n = nx('${NUA}', P, 2); P.reserve.soul = true; G.step = 4; G.active = 'player'; const a = BS.manifestTargets(P, d, 'main').length; P.count = 2; const b = BS.manifestTargets(P, d, 'main').length; return [a, b];`);
  assert.deepEqual(r, [0, 1]);
});
test('B32 Dian summons a revealed Saga Brave as a Spirit (without paying the cost)', async () => {
  const r = await ev(`const d = sp('${DIAN}', P, 1); for (const i of ['${T0}', '${SPEAR}', '${T1}', '${T3}', '${T4}']) dk(i); await BS.fireFx(P, 'SUMMONED', d); return [ids(P.spirits), P.deck.length, P.revealed.length];`);
  assert.deepEqual(r, [[DIAN, SPEAR], 4, 0]);
});
test('B33 Dian reveals but cannot summon when no Saga Brave is among the four cards', async () => {
  const r = await ev(`const d = sp('${DIAN}', P, 1); for (const i of ['${T0}', '${T1}', '${T3}', '${T4}']) dk(i); await BS.fireFx(P, 'SUMMONED', d); return [ids(P.spirits), P.deck.length];`);
  assert.deepEqual(r, [[DIAN], 4]);
});
test('B34 Madea reveals four cards and deploys a Scalostle Spirit from them', async () => {
  const r = await ev(`const m = sp('${MADEA}', P, 1); for (const i of ['${T0}', '${SCOUT}', '${T1}', '${T3}']) dk(i); await BS.fireFx(P, 'ATTACKS', m); return [ids(P.spirits), P.deck.length];`);
  assert.deepEqual(r, [[MADEA, SCOUT], 3]);
});
test('B35 Neo-Core Charge: a Cost 3+ Scalostle Spirit summoned -> Nuadha gives +1 counter (CPU builds the Count first)', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); const s = sp('${SOLDIER}', P, 1); await BS.fireFx(P, 'SUMMONED', s); return [P.count, n.cores];`);
  assert.equal(r[0], 1);
});
test('B36 Neo-Core Charge does not trigger for a Cost 1 Spirit (Cost 3 or more is needed)', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); const s = sp('${T1}', P, 1); await BS.fireFx(P, 'SUMMONED', s); return [P.count, n.cores];`);
  assert.deepEqual(r, [0, 2]);
});
test('B37 with five counters the CPU takes the core instead (CORE_OR_COUNTER)', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); P.count = 5; const s = sp('${SCOUT}', P, 1); const c0 = n.cores; await BS.fireFx(P, 'SUMMONED', s); return [P.count, n.cores - c0];`);
  assert.equal(r[0], 5); assert.ok(r[1] >= 1);
});
test('B38 Neo-Core Charge also works for a Scalostle Brave summoned as a Spirit', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); const b = sp('${SPEAR}', P, 1); await BS.fireFx(P, 'SUMMONED', b); return P.count;`);
  assert.equal(r, 1);
});

// ---- validation of the new vocabulary ----
const parseA = a => g.page.evaluate(x => { const r = BS.parseActionList([x]); return r.error ? r.error : 'ok'; }, a);
test('B39 DESTROY cost options are validated', async () => {
  assert.equal(await parseA({ do: 'DESTROY', costLe: 3 }), 'ok');
  assert.equal(await parseA({ do: 'DESTROY', costRank: 'lowest' }), 'ok');
  assert.match(await parseA({ do: 'DESTROY', costRank: 'middle' }), /invalid/);
  assert.match(await parseA({ do: 'DESTROY', costLe: -1 }), /invalid/);
  assert.match(await parseA({ do: 'DESTROY', costLe: 3, costBoost: { counterGe: 5 } }), /invalid/);
});
test('B40 LOOT, CORE_OR_COUNTER and DESTROY_TOTAL byCost are validated', async () => {
  assert.equal(await parseA({ do: 'LOOT', draw: 2, discard: 2, drawPlus: { n: 1, if: { nexusBraved: 'Nuadha' } } }), 'ok');
  assert.match(await parseA({ do: 'LOOT', draw: 0, discard: 1 }), /invalid/);
  assert.match(await parseA({ do: 'LOOT', draw: 1, discard: 1, drawPlus: { n: 1, if: { bogus: 1 } } }), /invalid/);
  assert.equal(await parseA({ do: 'CORE_OR_COUNTER', n: 1 }), 'ok');
  assert.match(await parseA({ do: 'CORE_OR_COUNTER', n: 2 }), /invalid/);
  assert.equal(await parseA({ do: 'DESTROY_TOTAL', total: 6, byCost: true }), 'ok');
  assert.match(await parseA({ do: 'DESTROY_TOTAL', total: 6000, byCost: true }), /invalid/);
});
test('B41 allowBrave is only valid for free summons; COST_DESTROY_PLUS needs a whole n', async () => {
  assert.equal(await parseA({ do: 'SUMMON_HAND', match: { family: ['Scalostle'], type: 'Brave' }, allowBrave: true }), 'ok');
  assert.match(await parseA({ do: 'SUMMON_HAND', match: { family: ['Scalostle'] }, allowBrave: true, pay: true }), /invalid/);
  const r = await g.page.evaluate(() => [BS.parseEffects([{ trigger: 'STATIC', flag: 'COST_DESTROY_PLUS', n: 1 }]).error || 'ok', BS.parseEffects([{ trigger: 'STATIC', flag: 'COST_DESTROY_PLUS', n: 0 }]).error ? 'bad' : 'ok', BS.parseEffects([{ trigger: 'SUMMONED', braved: true, actions: [{ do: 'DRAW', n: 1 }] }]).error || 'ok']);
  assert.deepEqual(r, ['ok', 'bad', 'ok']);
});

// ---- the [During Brave] gate ----
test('B42 a "braved" effect fires only while a Brave is combined with the Spirit', async () => {
  const r = await g.page.evaluate(async () => {
    BS.importCards(JSON.stringify([{ id: 'B-DB', name: 'During Brave Test', type: 'Spirit', color: 'blue', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'SUMMONED', braved: true, actions: [{ do: 'COUNTER', n: 1 }] }], fxComplete: true },
      { id: 'B-BR', name: 'Test Brave', type: 'Brave', color: 'blue', cost: 1, symbols: 0, levels: [{ cores: 1, bp: 1000 }], brave: { bp: 1000 } }]));
    BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player; P.cpu = true; P.spirits = []; P.nexus = []; P.count = 0; P.reserve.n = 10;
    const s = BS.mkInst('B-DB'); s.cores = 1; P.spirits.push(s); await BS.fireFx(P, 'SUMMONED', s); const a = P.count;
    const b = BS.mkInst('B-BR'); P.hand.push(b); BS.combineBrave(P, b, s); await BS.fireFx(P, 'SUMMONED', s); return [a, P.count];
  });
  assert.deepEqual(r, [0, 1]);
});
test('B43 nexusBraved is false without a braved Nexus and true with one', async () => {
  const r = await ev(`const n = nx('${NUA}', P, 2); const a = BS.fxIf ? BS.fxIf(P, O, { nexusBraved: 'Nuadha' }) : null; const b = hd('${SPEAR}'); BS.combineBrave(P, b, n); return [a, BS.fxIf(P, O, { nexusBraved: 'Nuadha' })];`);
  assert.deepEqual(r, [false, true]);
});
test('B44 no page errors', () => { assert.deepEqual(g.errors, []); });
