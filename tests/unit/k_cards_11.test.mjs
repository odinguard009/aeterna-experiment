// Lane K tests, file 11 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v196: 26RBS03-079, 26RSD08-X02, 26RBS03-X02, 26RBS01-X05
// (UNAFFECTED Magic / LIFE_CAP_ONE / TREAT_LV1 / CORE_ANY_FROM_ALLY / BP_MINUS.perTrash / OPP_CORES_TO_RESERVE.costLe).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-265 data: the four bundle cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS03-079', '26RSD08-X02', '26RBS03-X02', '26RBS01-X05'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger + (e.flag ? ':' + e.flag : '') + (e.invoke ? ':invoke' : '')).join(',')];
  }));
  assert.deepEqual(r, [
    ['26RBS03-079', 2, 'STATIC:UNAFFECTED,ACTIVATE:invoke'],
    ['26RSD08-X02', 2, 'ATTACKS,ACTIVATE:invoke'],
    ['26RBS03-X02', 2, 'ACTIVATE:invoke,DESTROYED'],
    ['26RBS01-X05', 2, 'SUMMONED,ATTACKS'],
  ], JSON.stringify(r));
});

test('K-266 26RBS03-079 LV1-2: unaffected by opposing Magic effects only, not by opposing Spirit effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const n = window.SC.warToll;
    const magic = BS.mkInst('26RSD08-012'), spirit = BS.mkInst('26RBS01-002'); spirit.cores = 1;
    return [BS.fxImmune(P, n, { p: O, opp: P, src: magic }), BS.fxImmune(P, n, { p: O, opp: P, src: spirit }),
      BS.CARDS['26RBS03-079'].effects[0].from.types.join()];
  }, SPEC('war-toll-wollaguard'));
  assert.deepEqual(r, [true, false, 'Magic'], JSON.stringify(r));
});

test('K-267 26RBS03-079 LV2 (Opposing Attack Step): the Invoke exhausts the Nexus and caps that Spirit\'s Life damage at one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const n = window.SC.warToll, a = window.SC.oppAttacker;
    G.attacker = a;
    const st = BS.activatable(P, n, 'FLASH').map(x => x.idx);
    const ok = await BS.activateFx(P, n, 1);
    return [st, ok, n.exhausted, a.lifeCapTurn && a.lifeCapTurn.turn === G.turnNo && a.lifeCapTurn.cap === 1];
  }, SPEC('war-toll-wollaguard'));
  assert.deepEqual(r, [[1], true, true, true], JSON.stringify(r));
});

test('K-268 26RBS03-079 LV2: an attack with three symbols only takes one Life after the cap', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    P.spirits = []; P.nexus = []; G.blocker = null;
    const a = BS.mkInst('26RSD08-X02'); a.cores = 1; O.spirits.push(a); a.symBattle = 2;
    a.lifeCapTurn = { turn: G.turnNo, cap: 1 };
    G.attacker = a; G.step = 5; G.active = O.key;
    const sym = BS.attackSymbols(a), life0 = P.life;
    await BS.doBattle(O.key, a);
    return [sym, life0 - P.life];
  }, SPEC('war-toll-wollaguard'));
  assert.deepEqual(r, [3, 1], JSON.stringify(r));
});

test('K-269 26RSD08-X02 LV1-2 (When Attacks): the Flash effect of a Sword Eye Magic card is used from the Hand for free', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.reiOhba;
    G.step = 5; G.active = P.key; G.attacker = x;
    const res0 = P.reserve.n;
    const m0 = P.hand.find(h => h.id === '26RSD08-012');
    await BS.fireFx(P, 'ATTACKS', x, { attacker: x });
    return [!!m0, P.hand.includes(m0), P.trash.includes(m0), res0 - P.reserve.n];
  }, SPEC('sword-eye-rei-ohba'));
  assert.deepEqual(r, [true, false, true, 0], JSON.stringify(r));
});

test('K-270 26RSD08-X02 LV2: each Sword Eye Magic in the Trash adds -1000 BP (two cards: 6000 -> 1000, three: destroyed)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.reiOhba, t = window.SC.oppTarget;
    G.step = 5; G.active = P.key; G.attacker = x; G.battleNo = 21;
    const idx = BS.activatable(P, x, 'FLASH').map(a => a.idx);
    const ok2 = await BS.activateFx(P, x, idx[0]);
    const two = [BS.bpOf(t), O.spirits.includes(t)];
    // a new board with three Sword Eye cards in the Trash
    const l2 = BS.loadScenario(spec); if (l2.error) return ['scenario2', l2.error];
    const G2 = BS.G, P2 = G2.p.player, O2 = G2.p.opponent;
    P2.trash.push(BS.mkInst('26RSD08-014'));
    const x2 = window.SC.reiOhba;
    G2.step = 5; G2.active = P2.key; G2.attacker = x2; G2.battleNo = 22;
    const idx2 = BS.activatable(P2, x2, 'FLASH').map(a => a.idx);
    const ok3 = await BS.activateFx(P2, x2, idx2[0]);
    return [ok2, two, ok3, O2.spirits.some(s => s.id === '26RBS01-004')];
  }, SPEC('sword-eye-rei-ohba'));
  assert.deepEqual(r, [true, [1000, true], true, false], JSON.stringify(r));
});

test('K-271 26RBS03-X02 LV1-2 Re Awaken: cores move to this Spirit and Red Cloud gets +1000 BP in your Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.siegfried, donor = window.SC.coreDonor, rc = window.SC.redCloudAlly;
    G.step = 5; G.active = P.key; G.battleNo = 23;
    const b0 = [x.cores, donor.cores, BS.bpOf(rc)];
    const idx = BS.activatable(P, x, 'FLASH').map(a => a.idx);
    const ok = await BS.activateFx(P, x, idx[0]);
    return [ok, x.cores, donor.cores, BS.bpOf(rc) - b0[2], idx[0]];
  }, SPEC('siegfried-reawaken'));
  assert.deepEqual(r, [true, 3, 1, 1000, 0], JSON.stringify(r));
});

test('K-272 26RBS03-X02 LV1-2 Re Awaken: in the opposing Attack Step the cores move but Red Cloud gets no BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.siegfried, donor = window.SC.coreDonor, rc = window.SC.redCloudAlly;
    G.step = 5; G.active = O.key; G.battleNo = 24;
    const b0 = BS.bpOf(rc), c0 = x.cores;
    await BS.activateFx(P, x, 0);
    return [x.cores - c0, donor.cores, BS.bpOf(rc) - b0];
  }, SPEC('siegfried-reawaken'));
  assert.deepEqual(r, [2, 1, 0], JSON.stringify(r));
});

test('K-273 26RBS03-X02 LV2 (When Destroyed): the Void core goes to Life only when Life is three or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const z = window.SC.siegfried; z.cores = 5; P.life = 3; P.void = 5;
    await BS.removeSpirit(P, z, 'destroyed', true); await BS.flushBursts();
    const low = [P.life, P.void];
    const l2 = BS.loadScenario(spec); if (l2.error) return ['scenario2', l2.error];
    const G2 = BS.G, P2 = G2.p.player;
    const z2 = window.SC.siegfried; z2.cores = 5; P2.life = 5; P2.void = 5;
    await BS.removeSpirit(P2, z2, 'destroyed', true); await BS.flushBursts();
    return [low, [P2.life, P2.void]];
  }, SPEC('siegfried-reawaken'));
  assert.deepEqual(r, [[4, 4], [5, 5]], JSON.stringify(r));
});

test('K-274 26RBS01-X05 LV1-2: a Cost 5 or less Dark Puce Spirit is summoned from the Trash by paying its cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.queenBabianaros;
    const res0 = P.reserve.n, trash0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', x);
    return [P.spirits.some(s => s.id === '26RBS01-017'), res0 - P.reserve.n, trash0 - P.trash.length];
  }, SPEC('queen-babianaros'));
  assert.deepEqual(r, [true, 2, 1], JSON.stringify(r));      // Imseid: cost 3, paid 2 after its reduction symbol
});

test('K-275 26RBS01-X05 LV2: one core moves per Shamanism Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.queenBabianaros, t = window.SC.oppCost5;
    G.step = 5; G.active = P.key;
    const c0 = t.cores;
    await BS.fireFx(P, 'ATTACKS', x, { attacker: x });
    return [c0 - t.cores, O.reserve.n, BS.CARDS['26RBS01-X05'].effects[1].actions[0].costLe];
  }, SPEC('queen-babianaros'));
  assert.deepEqual(r, [3, 6, 5], JSON.stringify(r));      // 3 Spirits with Shamanism: the Queen prints the Shaman keyword, plus Spectrous and Papilioni (each 0 + eachPer = one core per Spirit, no +1 baseline)
});
