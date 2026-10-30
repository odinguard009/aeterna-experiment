// Lane K tests, file 2 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SETUP = `const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; q.hand.length = 0; }`;

test('K-122 NO_BP_DESTROY_TURN (26RBS02-X13): marks one own Cost 6 or less Spirit for this turn only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = G.turnNo || 1;
    const c = BS.mkInst('26RBS02-X13'); c.cores = 4; P.spirits.push(c);
    const fx = BS.CARDS['26RBS02-X13'].effects.find(e => e.trigger === 'START_ATTACK');
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx);
    const set = P.spirits.filter(s => s.noBpTurn === G.turnNo).length; const cost = BS.CARDS[P.spirits.find(s => s.noBpTurn).id].cost;
    return [set, cost <= 6]; })()`);
  assert.deepEqual(r, [1, true], JSON.stringify(r));
});

test('K-123 26RBS02-X13 LV2: draws on the second or later attack of a Wailwraith/Hexcraft Spirit, not the first', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; P.deck.push(BS.mkInst('26RBS01-001'), BS.mkInst('26RBS01-001'));
    const c = BS.mkInst('26RBS02-X13'); c.cores = BS.CARDS['26RBS02-X13'].levels[1].cores; P.spirits.push(c);
    const go = async n => { P.attacksThisTurn = n; const h = P.hand.length; await BS.fireFx(P, 'ALLY_ATTACKS', c, { attacker: c, subject: c }); return P.hand.length - h; };
    return [await go(1), await go(2)]; })()`);
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-124 MUST_ATTACK_OPP (26RBS02-081): marks one opposing Cost 3 or less Spirit for this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = 9;
    const c = BS.mkInst('26RBS02-081'); c.cores = 3; P.spirits.push(c);
    const lo = BS.mkInst('BS48-001'); lo.cores = 1; O.spirits.push(lo);
    const fx = BS.CARDS['26RBS02-081'].effects.find(e => e.trigger === 'OPP_START_ATTACK');
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx);
    return [lo.mustAtk === 9, BS.CARDS['BS48-001'].cost <= 3]; })()`);
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-125 26RBS02-081 LV2: end step refreshes a Spirit that prints a When Blocks effect, not one that does not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RBS02-081'); c.cores = BS.CARDS['26RBS02-081'].levels[1].cores; P.spirits.push(c);
    const a = BS.mkInst('BS50-040'), b = BS.mkInst('BS48-001'); a.exhausted = b.exhausted = true; a.cores = b.cores = 1; P.spirits.push(a, b);
    await BS.fireFx(P, 'END_STEP', c, {});
    return [a.exhausted, b.exhausted]; })()`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-126 26RCB01-035 LV1: opposing Spirit must attack only when all your Spirits/Nexuses are RYUKI', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = O.key; G.turnNo = 11;
    const z = BS.mkInst('26RCB01-035'); z.cores = 3; P.spirits.push(z);
    const foe = BS.mkInst('BS48-001'); foe.cores = 1; O.spirits.push(foe);
    const fx = BS.CARDS['26RCB01-035'].effects.find(e => e.trigger === 'OPP_START_ATTACK');
    const ok = BS.fxIf ? BS.fxIf(P, O, fx.if) : null;
    const other = BS.mkInst('BS48-001'); other.cores = 1; P.spirits.push(other);
    const no = BS.fxIf ? BS.fxIf(P, O, fx.if) : null;
    return [ok, no]; })()`);
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-127 26RDB01-038: needs the Soul Core in the Reserve; the picked opposing Spirit must be LV1', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.battleNo = 5;
    const c = BS.mkInst('26RDB01-038'); c.cores = 1; P.spirits.push(c); G.attacker = c;
    const lo = BS.mkInst('BS48-001'); lo.cores = 1; O.spirits.push(lo);
    const fx = BS.CARDS['26RDB01-038'].effects.find(e => e.trigger === 'ALLY_ATTACKS');
    P.reserve.soul = false; const no = BS.fxIf(P, O, fx.if);
    P.reserve.soul = true; const yes = BS.fxIf(P, O, fx.if);
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx); G.attacker = null;
    return [no, yes, lo.noBlockB === 5]; })()`);
  assert.deepEqual(r, [false, true, true], JSON.stringify(r));
});

test('K-128 26RDB01-061 Main: Blue Beat Nexus only, any Blue Beat card when the Soul Core is in the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const m = BS.mkInst('26RDB01-061'), run = async () => { await BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: BS.CARDS['26RDB01-061'].magic.by.MAIN.actions }); };
    const out = [];
    for (const soul of [false, true]) {
      P.reserve.soul = soul; P.trash.length = 0; P.hand.length = 0;
      const s = BS.mkInst('26RDB01-033'); P.trash.push(s); await run(); out.push(P.hand.includes(s));
    }
    return out; })()`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-129 26RDB01-039 LV2: reveals two, summons one Blue Beat Cost<=5 with another name, rest to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RDB01-039'); c.cores = 1; P.spirits.push(c);
    const fx = BS.CARDS['26RDB01-039'].effects.find(e => e.trigger === 'ATTACKS');
    P.reserve.soul = false; const no = BS.fxIf(P, O, fx.if);
    P.reserve.soul = true; const yes = BS.fxIf(P, O, fx.if);
    P.deck = ['BS48-001', '26RDB01-033', 'BS48-001', 'BS48-001'].map(id => BS.mkInst(id));
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx);
    return [no, yes, P.spirits.map(x => x.id).join(), P.deck.length, P.revealed.length]; })()`);
  assert.deepEqual(r, [false, true, '26RDB01-039,26RDB01-033', 3, 0], JSON.stringify(r));
});

test('K-130 26RBS02-087: the picked Spirit is armed for this turn (flag only; the battle hook is not fought out here)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = 9;
    const s = BS.mkInst('26RDB01-039'); s.cores = 1; P.spirits.push(s);
    const m = BS.mkInst('26RBS02-087'), ctx = { picked: s };
    const fx = BS.CARDS['26RBS02-087'].magic.by ? BS.CARDS['26RBS02-087'].magic.by.FLASH : BS.CARDS['26RBS02-087'].magic;
    await BS.runActions({ p: P, opp: O, src: m, ctx }, { actions: fx.actions.filter(a => a.do === 'LIFE_HIT_NEXUS') });
    return [JSON.stringify(s.lifeHitNexus)]; })()`);
  assert.equal(r[0], JSON.stringify({ turn: 9, costLe: 4 }), JSON.stringify(r));
});

test('K-131 26RDB01-031: reveals three, adds a Yellow Rise Spirit/Magic with another name; LV2 gives a Rei-Ohba +5000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RDB01-031'); c.cores = 1; P.spirits.push(c);
    const fx = BS.CARDS['26RDB01-031'].effects;
    P.deck = ['BS48-001', '26RSD08-X02', 'BS48-001', 'BS48-001'].map(id => BS.mkInst(id));
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'SUMMONED'));
    const rei = BS.mkInst('26RDB01-X05'); rei.cores = 1; P.spirits.push(rei); const b0 = rei.bpMod || 0;
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'ATTACKS'));
    return [P.hand.map(x => x.id).join(), P.deck.length, (rei.bpMod || 0) - b0]; })()`);
  assert.deepEqual(r, ['26RSD08-X02', 3, 5000], JSON.stringify(r));
});

test('K-132 26RSD01-006: pulls up to two cores from the Trash; LV2 End Step sends the Soul Core to a Windfang Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RSD01-006'); c.cores = 1; P.spirits.push(c);
    const fx = BS.CARDS['26RSD01-006'].effects;
    P.trashCores.n = 3; P.trashCores.soul = true;
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'SUMMONED'));
    const w = BS.mkInst('26RBS02-003'); w.cores = 1; P.spirits.push(w);
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'END_STEP'));
    return [c.cores, P.trashCores.n, P.trashCores.soul, !!w.soul, !!c.soul]; })()`);
  assert.deepEqual(r[0] === 3 && r[1] === 1, true, JSON.stringify(r));
  assert.ok(r[2] === false && (r[3] || r[4]), JSON.stringify(r));
});
