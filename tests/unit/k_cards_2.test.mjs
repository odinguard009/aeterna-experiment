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
