// Lane K tests, file 21 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 7 of v0.202.0: 26RBS03-019 (Jackalpio) and 26RBS01-X16 (Panjang).
// Engine piece: STATIC flag RUMBLE_PLUS {n} ("the number of cards specified by your Rumble gets +n").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-338 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS03-019', '26RBS01-X16'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS03-019', 'ALLY_DIED,ATTACKS', true],
    ['26RBS01-X16', 'SUMMONED,STATIC:RUMBLE_PLUS', true],
  ], JSON.stringify(r));
});

test('K-339 26RBS03-019 (Your Attack Step): a destroyed Dark Puce Spirit makes an opposing Spirit send a core to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.jackalpio, puce = window.SC.darkPuce, opp = window.SC.oppA;
    G.step = 5; G.active = P.key;
    const res0 = O.reserve.n, total0 = O.spirits.reduce((n, x) => n + x.cores, 0);
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: puce });
    const on = [total0 - O.spirits.reduce((n, x) => n + x.cores, 0), O.reserve.n - res0];
    G.step = 3;                                     // not the Attack Step: no trigger
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: puce });
    return [on, O.spirits.reduce((n, x) => n + x.cores, 0) === total0 - 1];
  }, SPEC('jackalpio-and-panjang'));
  assert.deepEqual(r, [[1, 1], true], JSON.stringify(r));
});

test('K-340 26RBS03-019 (When Attacks): one core each from two opposing Cost 4 or less Spirits, and a depletion draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.jackalpio;
    const a = window.SC.oppA, b = window.SC.oppB;
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length, res0 = O.reserve.n;
    await BS.fireFx(P, 'ATTACKS', t);
    return [a.cores, b.cores, O.reserve.n - res0, P.hand.length - h0];
  }, SPEC('jackalpio-and-panjang'));
  assert.deepEqual(r, [1, 1, 2, 0], JSON.stringify(r));
});

test('K-341 26RBS01-X16 (When Summoned): reveal three, add a Rumble Spirit to the Hand, rest to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.panjang;
    await BS.fireFx(P, 'SUMMONED', t);
    return [P.hand.map(x => x.id), P.deck.map(x => x.id)];
  }, SPEC('jackalpio-and-panjang'));
  assert.deepEqual(r[0], ['26RBS01-079'], JSON.stringify(r));
  assert.deepEqual(r[1], ['26RBS01-004', '26RBS01-005', '26RBS01-006'], JSON.stringify(r));
});

test('K-342 26RBS01-X16 LV2 (Your Attack Step): your Rumble discards two more cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.fergus;
    G.step = 5; G.active = P.key; G.attacker = t; G.battleNo = 3; G.eob = [];      // the end-of-battle queue
    const deck0 = O.deck.length;
    await BS.fireFx(P, 'ATTACKS', t);            // RUMBLE 3 queued
    await BS.endOfBattle();
    return [deck0, O.deck.length];
  }, SPEC('jackalpio-and-panjang'));
  assert.deepEqual(r, [10, 5], JSON.stringify(r));
});

test('K-343 26RBS01-X16 LV2: outside the Attack Step the Rumble stays at its printed number', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.fergus;
    G.step = 7; G.active = P.key; G.attacker = t; G.battleNo = 4; G.eob = [];
    const deck0 = O.deck.length;
    await BS.fireFx(P, 'ATTACKS', t);
    await BS.endOfBattle();
    return [deck0, O.deck.length];
  }, SPEC('jackalpio-and-panjang'));
  assert.deepEqual(r, [10, 7], JSON.stringify(r));
});
