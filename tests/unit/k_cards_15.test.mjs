// Lane K tests, file 15 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v206: 26RSD08-002 (Chaori Pegasuros), 26RBS02-X05 (The Composed Molunar), 26RBS02-076 (War Phase: Barrier of Scale Dust),
// plus 26RSD06-011 (The Barrage Forest) LV1-2 only.
// New engine pieces: condition `trashNoEx`, condition `ownDestroyedTurn {color|hasTrigger}` (per-turn attribute list in
// removeSpirit), OPP_CORES_TO_RESERVE.exhausted; "(Can't Stack)" is the existing noStack field (now glossary-wired).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-299 data: the bundle cards carry their printed clauses and the glossary knows (Can\'t Stack)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RSD08-002', '26RBS02-X05', '26RBS02-076', '26RSD06-011'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger + (e.noStack ? '*' : '')).join(','), c.implemented === true, (c.residual || []).length];
  }));
  assert.deepEqual(r, [
    ['26RSD08-002', 'SUMMONED,ALLY_LIFE_HIT', true, 0],
    ['26RBS02-X05', 'SUMMONED,END_STEP*', true, 0],
    ['26RBS02-076', 'SUMMONED,END_STEP*', true, 0],
    ['26RSD06-011', 'SUMMONED', false, 1],
  ], JSON.stringify(r));
});

test('K-300 26RBS02-X05 (When Summoned): destroys your Spirit with a When Destroyed effect, then one core of an opposing Spirit goes to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const wdf = window.SC.wdf, mol = window.SC.molunar, opp = window.SC.oppExhausted;
    const res0 = O.reserve.n, cores0 = opp.cores;
    await BS.fireFx(P, 'SUMMONED', mol);
    return [P.spirits.includes(wdf), P.trash.includes(wdf), cores0, opp.cores, O.reserve.n - res0];
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.deepEqual(r, [false, true, 2, 1, 1], JSON.stringify(r));
});

test('K-301 26RBS02-X05 LV2 (Your End Step): draws only after your own effect destroyed one of your Purple Spirits this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const hand0 = P.hand.length;
    G.step = 4; await BS.fireFx(P, 'END_STEP', window.SC.molunar);
    const before = P.hand.length - hand0;
    await BS.fireFx(P, 'SUMMONED', window.SC.molunar);      // destroys Bonrat (purple, When Destroyed) with your own effect
    await BS.fireFx(P, 'END_STEP', window.SC.molunar);
    return [before, P.hand.length - hand0];
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-302 26RBS02-X05 LV2 (Your End Step): a non-Purple Spirit destroyed by your effect does not draw', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const wdf = window.SC.wdf;
    const real = [BS.CARDS['26RBS01-016'].color, BS.CARDS['26RBS01-016'].colors];
    BS.CARDS['26RBS01-016'].color = 'red'; BS.CARDS['26RBS01-016'].colors = ['red'];      // same card, a non-Purple colour: the colour filter must reject it
    const hand0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', window.SC.molunar);
    await BS.fireFx(P, 'END_STEP', window.SC.molunar);
    BS.CARDS['26RBS01-016'].color = real[0]; BS.CARDS['26RBS01-016'].colors = real[1];
    return [P.spirits.includes(wdf), P.hand.length - hand0];
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.deepEqual(r, [false, 0], JSON.stringify(r));
});

test('K-303 26RBS02-076 (When Deployed): mills two only while your Trash holds no EX Symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, n = window.SC.barrier;
    const deck0 = P.deck.length;
    await BS.fireFx(P, 'SUMMONED', n);
    const first = deck0 - P.deck.length;
    P.trash.push(BS.mkInst('26RBS01-002'));     // an EX-Symbol card in the Trash
    const deck1 = P.deck.length;
    await BS.fireFx(P, 'SUMMONED', n);
    return [first, deck1 - P.deck.length];
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.deepEqual(r, [2, 0], JSON.stringify(r));
});

test('K-304 26RBS02-076 LV2 (Your End Step): one core from an opposing exhausted Spirit after your own effect destroyed a When Destroyed Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const n = window.SC.barrier, opp = window.SC.oppExhausted;
    const fresh = BS.mkInst('26RBS01-008'); fresh.cores = 2; fresh.exhausted = false; O.spirits.push(fresh);      // refreshed: the exhausted filter must skip it
    await BS.fireFx(P, 'SUMMONED', window.SC.molunar);      // own effect destroys your When-Destroyed Spirit
    const res0 = O.reserve.n, cores0 = opp.cores;
    await BS.fireFx(P, 'END_STEP', n);
    return [cores0, opp.cores, O.reserve.n - res0, fresh.cores];
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.deepEqual(r, [2, 1, 1, 1], JSON.stringify(r));
});

test('K-305 26RSD08-002 (When Summoned): an exhausted Yellow Rise Spirit in play returns a Sword Eye Magic card from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, card = window.SC.pegasuros, magic = P.trash[0];
    await BS.fireFx(P, 'SUMMONED', card);
    const got = P.hand.includes(magic) && !P.trash.includes(magic);
    window.SC.yellowRise.exhausted = false;      // no exhausted Yellow Rise Spirit: the clause is off
    P.hand.splice(P.hand.indexOf(magic), 1); P.trash.push(magic);
    await BS.fireFx(P, 'SUMMONED', card);
    return [got, P.trash.includes(magic)];
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-306 26RSD08-002 LV2 (During Attack): a core leaves the Reserve for the Life only while your Life is at two or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, card = window.SC.pegasuros;
    G.step = 5; G.active = P.key;
    const life0 = P.life, res0 = P.reserve.n;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: card });
    const low = [P.life - life0, res0 - P.reserve.n];
    P.life = 3; const life1 = P.life, res1 = P.reserve.n;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: card });
    return [low, P.life - life1, res1 - P.reserve.n];
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.deepEqual(r, [[1, 1], 0, 0], JSON.stringify(r));
});

test('K-307 (Can\'t Stack): two copies of a noStack End Step effect count once', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const twin = BS.mkInst('26RBS02-X05'); twin.cores = 3; P.spirits.push(twin);      // a second copy of the same card
    await BS.fireFx(P, 'SUMMONED', window.SC.molunar);
    const hand0 = P.hand.length;
    await BS.fireFx(P, 'END_STEP', window.SC.molunar);
    return P.hand.length - hand0;
  }, SPEC('war-phase-scale-dust-bundle'));
  assert.equal(r, 1, String(r));
});
