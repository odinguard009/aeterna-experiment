// Lane K tests, file 16 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 2 of v0.202.0: 26RDB01-010 (Senri Taiga), 26RDB01-021 (Seina Ryumin), 26RBS03-073 (Druksar).
// Engine piece: DESTROY.costPerOwn also takes a match object ("for each <matching> Spirit you control the cost limit +1").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-308 data: the bundle cards carry their printed clauses (High Speed flag included)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RDB01-010', '26RDB01-021', '26RBS03-073'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true, !!c.highSpeed];
  }));
  assert.deepEqual(r, [
    ['26RDB01-010', 'ATTACKS,END_STEP', true, false],
    ['26RDB01-021', 'SUMMONED', true, true],
    ['26RBS03-073', 'SUMMONED,ATTACKS', true, false],
  ], JSON.stringify(r));
});

test('K-309 26RDB01-010 (When Attacks): destroys the opposing Spirit with the same BP while two exhausted Red Stella Spirits are in play', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const t = window.SC.taiga, big = window.SC.oppBig, small = window.SC.oppSmall;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'ATTACKS', t);
    const withTwo = [!O.spirits.includes(big), O.spirits.includes(small)];
    window.SC.stella1.exhausted = false;                       // only one exhausted Red Stella Spirit left
    await BS.fireFx(P, 'ATTACKS', t);
    return [withTwo, O.spirits.includes(big), O.spirits.includes(small)];
  }, SPEC('red-stella-and-druksar'));
  assert.deepEqual(r, [[true, true], false, true], JSON.stringify(r));
});

test('K-310 26RDB01-010 LV2 (Your End Step): refreshes itself while two exhausted Red Stella Spirits are in play', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.taiga;
    t.cores = 3;                    // LV2 for the End Step effect
    t.exhausted = true;
    await BS.fireFx(P, 'END_STEP', t);
    const on = !t.exhausted;
    t.exhausted = true; window.SC.stella1.exhausted = false; window.SC.stella2.exhausted = false;      // Taiga itself is Red Stella too: only one exhausted remains
    await BS.fireFx(P, 'END_STEP', t);
    return [on, t.exhausted];
  }, SPEC('red-stella-and-druksar'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-311 26RDB01-021 (When Summoned): two Trash cores move onto it while an exhausted Green Wave Spirit is in play', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const seina = BS.mkInst('26RDB01-021'); seina.cores = 1; P.spirits.push(seina);
    const trash0 = P.trashCores.n;
    await BS.fireFx(P, 'SUMMONED', seina);
    const on = [trash0 - P.trashCores.n, seina.cores - 1];
    window.SC.greenWave.exhausted = false; P.trashCores.n = 2;
    await BS.fireFx(P, 'SUMMONED', seina);
    return [on, P.trashCores.n, seina.cores];
  }, SPEC('red-stella-and-druksar'));
  assert.deepEqual(r, [[2, 2], 2, 3], JSON.stringify(r));
});

test('K-312 26RDB01-021 High Speed: the card can be flashed from the Hand in the opposing Attack Step only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const inst = BS.mkInst('26RDB01-021'); P.hand.push(inst);
    G.step = 5; G.active = G.p.opponent.key;
    const oppStep = BS.highSpeedOK(P, inst);
    G.step = 4; G.active = P.key;
    const myMain = BS.highSpeedOK(P, inst);
    return [oppStep, myMain];
  }, SPEC('red-stella-and-druksar'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-313 26RBS03-073 (When Summoned): each Blue Spirit with no printed effects raises the destroy cost limit by one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const big = window.SC.oppBig;                               // Cost 6: destroyed only with the +1s from the vanilla Blue Spirits
    await BS.fireFx(P, 'SUMMONED', window.SC.druksar);
    const withTwo = !O.spirits.includes(big);
    const big2 = BS.mkInst('26RBS01-011'); big2.cores = 1; O.spirits.push(big2);      // a fresh Cost 6 Spirit (the destroyed instance keeps no cores)
    P.spirits = P.spirits.filter(s => !['26RBS03-061', '26RBS03-065', '26RBS03-071'].includes(s.id));
    await BS.fireFx(P, 'SUMMONED', window.SC.druksar);
    return [withTwo, O.spirits.includes(big2)];
  }, SPEC('red-stella-and-druksar'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-314 26RBS03-073 LV2 (When Attacks): refreshes one Cost 6 or more Blue Spirit with no printed effects, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, big = window.SC.vanillaBig;
    G.step = 5; G.active = P.key;
    const before = big.exhausted;
    await BS.fireFx(P, 'ATTACKS', window.SC.druksar);
    const after = big.exhausted;
    big.exhausted = true;
    await BS.fireFx(P, 'ATTACKS', window.SC.druksar);           // once per turn: the second attack does not refresh it
    return [before, after, big.exhausted];
  }, SPEC('red-stella-and-druksar'));
  assert.deepEqual(r, [true, false, true], JSON.stringify(r));
});
