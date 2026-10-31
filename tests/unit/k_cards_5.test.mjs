// Lane K tests, file 5 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v190: 26RDB01-025, 26RBS03-030, 26RBS01-091 (core protection, "Can't Stack").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));
const CORE = { do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 };

test('K-214 data: 26RDB01-025, 26RBS03-030 and 26RBS01-091 carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RDB01-025', '26RBS03-030', '26RBS01-091'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx[0].trigger + ':' + (fx[0].flag || ''), fx[fx.length - 1].trigger];
  }));
  assert.deepEqual(r, [
    ['26RDB01-025', 2, 'STATIC:CORE_SAFE', 'OPP_START_ATTACK'],
    ['26RBS03-030', 3, 'STATIC:CORE_SAFE', 'ALLY_ATTACKS'],
    ['26RBS01-091', 2, 'ALLY_BATTLE_END:', 'STATIC'],
  ], JSON.stringify(r));
});

test('K-215 26RDB01-025 LV1-2: an opposing effect cannot move the cores on this Spirit (mode move)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const s = window.SC.aries;
    P.spirits = [s];                               // only the protected Spirit is a candidate
    const src = window.SC.opponentSource;
    const before = [s.cores, P.reserve.n];
    await BS.runActions({ p: O, opp: P, src, ctx: {} }, { actions: [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 }] });
    return [before, s.cores, P.reserve.n];
  }, SPEC('core-safe-own-cards'));
  assert.deepEqual(r, [[2, 6], 2, 6], JSON.stringify(r));
});

test('K-216 26RBS03-030 LV1-2: the number of cores on this Spirit cannot be brought below one by an opposing effect (mode floor)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const s = window.SC.naudalie;
    P.spirits = [s];
    await BS.runActions({ p: O, opp: P, src: window.SC.opponentSource, ctx: {} }, { actions: [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 }] });
    return [s.cores, P.reserve.n];
  }, SPEC('core-safe-own-cards'));
  assert.deepEqual(r, [1, 7], JSON.stringify(r));
});

test('K-217 26RBS03-030 LV1-2: "all your Swordish" includes the Swordish Token (floor)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const tok = BS.mkInst('26RSD10-T001'); tok.cores = 3; tok.bpMod = 50000; P.spirits.push(tok);   // the CPU picks the strongest candidate
    await BS.runActions({ p: O, opp: P, src: window.SC.opponentSource, ctx: {} }, { actions: [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 }] });
    return [tok.cores, tok.id === '26RSD10-T001'];
  }, SPEC('core-safe-own-cards'));
  assert.deepEqual(r, [1, true], JSON.stringify(r));
});

test('K-218 26RBS03-030 LV1-2: another own Spirit without the Swordish name is not protected', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const big = BS.mkInst('26RBS01-X09'); big.cores = 3; P.spirits.push(big);   // 13000 BP, the CPU's first pick
    await BS.runActions({ p: O, opp: P, src: window.SC.opponentSource, ctx: {} }, { actions: [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 }] });
    return [big.cores, window.SC.naudalie.cores];
  }, SPEC('core-safe-own-cards'));
  assert.deepEqual(r, [1, 2], JSON.stringify(r));
});

test('K-219 26RDB01-025 LV2 (Start of Opposing Attack Step): allHave team Green Wave, exhaust an opposing Cost 3 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const s = window.SC.aries; s.cores = 4;                       // LV2
    P.spirits = [s];                                             // 025's team line is Green Wave/CoZ12
    O.spirits = [];
    const c5 = BS.mkInst('26RBS02-041'); c5.cores = 1; O.spirits.push(c5);     // cost 5
    const c2 = BS.mkInst('BS48-047'); c2.cores = 1; O.spirits.push(c2);        // cost 2
    const cond = () => BS.fxIf(P, O, { allHave: { team: 'Green Wave' } });
    const allGreen = cond();
    const twoGreen = [c2];
    const first = (await BS.fireFx(P, 'OPP_START_ATTACK'), [c5.exhausted, c2.exhausted]);
    const other = BS.mkInst('26RBS01-002'); other.cores = 1; P.spirits.push(other);   // no Green Wave team
    const mixed = cond();
    return [allGreen, first, mixed, BS.CARDS['26RDB01-025'].effects[1].actions[0].costLe];
  }, SPEC('core-safe-own-cards'));
  assert.deepEqual(r, [true, [false, true], false, 3], JSON.stringify(r));
});

test('K-220 26RBS03-030 LV2 (Your Attack Step): when your Swordish attacks, exhaust an opposing Cost 4 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const s = window.SC.naudalie; s.cores = 3;                    // LV2
    const tok = BS.mkInst('26RSD10-T001'); tok.cores = 1; P.spirits.push(tok);
    O.spirits = [];
    const c4 = BS.mkInst('26RBS01-002'); c4.cores = 1; O.spirits.push(c4);     // cost 4
    const c8 = BS.mkInst('26RBS03-X07'); c8.cores = 1; O.spirits.push(c8);     // cost 9
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'ALLY_ATTACKS', tok, { attacker: tok, subject: tok });
    const byToken = [c4.exhausted, c8.exhausted];
    c4.exhausted = false;
    await BS.fireFx(P, 'ALLY_ATTACKS', s, { attacker: s, subject: s });        // not a Swordish attacker
    return [byToken, c4.exhausted];
  }, SPEC('core-safe-own-cards'));
  assert.deepEqual(r, [[true, false], false], JSON.stringify(r));
});

test('K-221 26RBS01-091 LV1-2 (Your Attack Step): at the end of your Spirit\'s battle, exhaust this Nexus for +2000 BP to a Clash Spirit; a second end does nothing', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const n = window.SC.vermilion, clash = window.SC.clashAttacker;
    G.step = 5; G.active = P.key; G.attacker = clash;
    const bp0 = BS.bpOf(clash);
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: clash, attacker: clash });
    const first = [n.exhausted, BS.bpOf(clash) - bp0];
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: clash, attacker: clash });
    return [first, BS.bpOf(clash) - bp0, BS.CARDS['26RBS01-091'].effects[0].actions[1].do];
  }, SPEC('core-safe-blocker'));
  assert.deepEqual(r, [[true, 2000], 2000, 'BP_TARGET'], JSON.stringify(r));
});

test('K-222 26RBS01-091 LV2: the opposing Spirit blocking your Clash Spirit cannot be brought below one core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const blk = window.SC.blocker, clash = window.SC.clashAttacker;
    O.spirits = [blk];
    G.battleNo = 7; G.attacker = clash; G.blocker = blk;
    const src = BS.mkInst('26RBS01-002'); src.cores = 1; P.spirits.push(src);
    const act = [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 }];
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: act });
    const inBattle = blk.cores;
    G.blocker = null; blk.cores = 2;
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: act });
    return [inBattle, blk.cores];
  }, SPEC('core-safe-blocker'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-223 26RBS01-091 LV2: a non-Clash attacker gets no protection for the blocker', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const blk = window.SC.blocker;
    O.spirits = [blk];
    const other = BS.mkInst('BS48-047'); other.cores = 1; P.spirits.push(other);   // not Clash
    const src = BS.mkInst('26RBS01-002'); src.cores = 1; P.spirits.push(src);
    G.battleNo = 8; G.attacker = other; G.blocker = blk;
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 }] });
    return [blk.cores, BS.CARDS['26RBS01-091'].effects[1].match.keyword];
  }, SPEC('core-safe-blocker'));
  assert.deepEqual(r, [0, 'Clash'], JSON.stringify(r));
});
