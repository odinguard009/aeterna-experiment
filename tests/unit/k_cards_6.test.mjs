// Lane K tests, file 6 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v191: 26RBS01-096, 26RBS03-038, 26RBS01-055, 26RSD02-X02 (byBattle / LIFE_UP / LIFE_CORE_TO_TRASH).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-224 data: the four bundle cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS01-096', '26RBS03-038', '26RBS01-055', '26RSD02-X02'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [
    ['26RBS01-096', 2, 'ALLY_DIED,ALLY_DIED'],
    ['26RBS03-038', 2, 'ALLY_BATTLE_END,LIFE_UP'],
    ['26RBS01-055', 2, 'BP_REACHED,STATIC'],
    ['26RSD02-X02', 2, 'SUMMONED,ATTACKS'],
  ], JSON.stringify(r));
});

test('K-225 26RBS01-096 LV1-2: a Bloodrouse Spirit destroyed by BP comparison sends a core from the opposing blocker to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const br = window.SC.bloodrouse, blk = window.SC.blocker;
    G.step = 5; G.battleNo = 7; G.attacker = br; G.blocker = blk;
    BS.removeSpirit(P, br, 'destroyed', 'battle'); await BS.flushBursts();
    const byBattle = [blk.cores, O.reserve.n];
    blk.cores = 2;
    const br2 = BS.mkInst('26RBS01-023'); br2.cores = 2; P.spirits.push(br2);
    G.attacker = br2;
    BS.removeSpirit(P, br2, 'destroyed', false); await BS.flushBursts();     // by an effect, not BP comparison
    return [byBattle, blk.cores];
  }, SPEC('hunting-tree-bp-death'));
  assert.deepEqual(r, [[1, 4], 2], JSON.stringify(r));
});

test('K-226 26RBS01-096 LV2: the same destruction draws a card (both effects at LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    window.SC.huntingTree.cores = 3;                       // LV2
    P.deck = [BS.mkInst('BS48-047'), BS.mkInst('BS48-047')];
    const br = window.SC.bloodrouse;
    G.step = 5; G.battleNo = 8; G.attacker = br; G.blocker = window.SC.blocker;
    const hand0 = P.hand.length;
    BS.removeSpirit(P, br, 'destroyed', 'battle'); await BS.flushBursts();
    return [P.hand.length - hand0, window.SC.blocker.cores, BS.CARDS['26RBS01-096'].effects[1].actions[0].do];
  }, SPEC('hunting-tree-bp-death'));
  assert.deepEqual(r, [1, 1, 'DRAW'], JSON.stringify(r));
});

test('K-227 26RBS01-096: the trigger window is Your Attack Step only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.step = 4; G.battleNo = 9; G.attacker = window.SC.bloodrouse; G.blocker = window.SC.blocker;
    BS.removeSpirit(P, window.SC.bloodrouse, 'destroyed', 'battle'); await BS.flushBursts();
    return [window.SC.blocker.cores, BS.CARDS['26RBS01-096'].effects[0].if.byBattle];
  }, SPEC('hunting-tree-bp-death'));
  assert.deepEqual(r, [2, true], JSON.stringify(r));
});

test('K-228 26RBS03-038 LV2: at the end of its battle while refreshed with Life 2 or less, a Reserve core moves to the Life; the Life-up then bounces an opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const dia = window.SC.diaMold, opp = window.SC.oppSpirit;
    dia.exhausted = false; G.step = 5; G.battleNo = 10; G.attacker = dia;
    const before = [P.life, P.reserve.n];
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: dia, attacker: dia });
    return [before, P.life, P.reserve.n, O.hand.includes(opp), O.spirits.includes(opp)];
  }, SPEC('dia-mold-life-up'));
  assert.deepEqual(r, [[2, 5], 3, 4, true, false], JSON.stringify(r));
});

test('K-229 26RBS03-038 LV1-2: no Reserve-to-Life while exhausted or with Life 3 or more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const dia = window.SC.diaMold;
    G.step = 5; G.battleNo = 11; G.attacker = dia;
    dia.exhausted = true;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: dia, attacker: dia });
    const exhausted = [P.life, P.reserve.n];
    dia.exhausted = false; P.life = 3;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: dia, attacker: dia });
    return [exhausted, P.life, P.reserve.n];
  }, SPEC('dia-mold-life-up'));
  assert.deepEqual(r, [[2, 5], 3, 5], JSON.stringify(r));
});

test('K-230 26RBS01-055 LV1-2: when an Amplify Spirit reaches 8000 BP in your Attack Step you draw a card, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const amp = window.SC.amplifyAttacker;
    P.deck = [BS.mkInst('BS48-047'), BS.mkInst('BS48-047')];
    amp.bpMod = 6000;                                     // 3000 printed + 6000
    G.step = 5; G.active = P.key;
    const before = P.hand.length;
    await BS.fireFx(P, 'BP_REACHED', amp, { subject: amp, bpFrom: 7000 });
    const first = P.hand.length - before;
    await BS.fireFx(P, 'BP_REACHED', amp, { subject: amp, bpFrom: 7000 });
    return [BS.bpOf(amp), first, P.hand.length - before];
  }, SPEC('fransil-life-to-trash'));
  assert.deepEqual(r, [9000, 1, 1], JSON.stringify(r));
});

test('K-231 26RBS01-055 LV2: the Life cores an Amplify Spirit\'s attack takes go to the Trash instead of the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const amp = window.SC.amplifyAttacker;
    G.step = 5; G.active = P.key; G.battleNo = 12;
    const before = [O.life, O.reserve.n, O.trashCores.n];
    await BS.doBattle(P.key, amp);
    const withFransil = [O.life, O.reserve.n, O.trashCores.n];
    P.spirits = P.spirits.filter(s => s.id !== '26RBS01-055');       // no LIFE_CORE_TO_TRASH
    O.life = 5; amp.exhausted = false;
    await BS.doBattle(P.key, amp);
    return [before, withFransil, [O.life, O.reserve.n, O.trashCores.n]];
  }, SPEC('fransil-life-to-trash'));
  assert.deepEqual(r, [[5, 3, 0], [4, 3, 1], [4, 4, 1]], JSON.stringify(r));
});

test('K-232 26RSD02-X02 LV1-2: two cores from one opposing Spirit, or one from each of two with an exhausted Bloodrouse Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.perigorouge, a = window.SC.oppA, b = window.SC.oppB;
    const acts = BS.CARDS['26RSD02-X02'].effects[0].actions;
    await BS.runActions({ p: P, opp: O, src: x, ctx: {} }, { actions: acts });
    const one = [a.cores, b.cores];
    a.cores = 3; b.cores = 3;
    const br = BS.mkInst('26RBS01-023'); br.cores = 1; br.exhausted = true; P.spirits.push(br);
    await BS.runActions({ p: P, opp: O, src: x, ctx: {} }, { actions: acts });
    return [one, [a.cores, b.cores]];
  }, SPEC('perigorouge-two-targets'));
  assert.deepEqual(r, [[1, 3], [2, 2]], JSON.stringify(r));
});

test('K-233 26RSD02-X02 LV2: after an opposing depletion this turn, Cost 4 or less Spirits cannot block it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.perigorouge; x.cores = 4;           // LV2
    const c4 = BS.mkInst('26RBS01-002'); c4.cores = 1; O.spirits.push(c4);     // cost 4
    const c5 = BS.mkInst('26RBS02-041'); c5.cores = 1; O.spirits.push(c5);     // cost 5
    G.step = 5; G.active = P.key; G.battleNo = 13; G.attacker = x;
    P.oppDepletedTurn = 0;
    await BS.fireFx(P, 'ATTACKS', x, { attacker: x });
    const without = [BS.blockedByMark(x, c4), BS.blockedByMark(x, c5)];
    G.attacker = x; P.oppDepletedTurn = G.turnNo;
    await BS.fireFx(P, 'ATTACKS', x, { attacker: x });
    return [without, [BS.blockedByMark(x, c4), BS.blockedByMark(x, c5)]];
  }, SPEC('perigorouge-two-targets'));
  assert.deepEqual(r, [[false, false], [true, false]], JSON.stringify(r));
});
