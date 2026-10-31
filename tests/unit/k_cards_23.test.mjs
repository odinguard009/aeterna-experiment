// Lane K tests, file 23 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 9 of v0.202.0: 26RBS02-079 (Deep Opening Hole) and 26RBS03-X06 (Desperado).
// Engine pieces: condition `depleted` (ALLY_LOST carries depl/byOpp), `viaLegacy` reads the summoned card on ALLY_SUMMONED,
// action CORES_ANY_TO_RESERVE {total, excludeSelf, thenVoidCore}.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-349 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS02-079', '26RBS03-X06'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS02-079', 'ALLY_LOST,ALLY_SUMMONED', true],
    ['26RBS03-X06', 'SUMMONED,ATTACKS', true],
  ], JSON.stringify(r));
});

test('K-350 26RBS02-079 LV1-2 (Opposing Turn): a Green Spirit depleted by an opposing effect puts a Void core on one of your Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, v0 = P.void, own = window.SC.ownCore2;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: window.SC.greenAlly, depl: true, byOpp: true });
    const on = [v0 - P.void, own.cores];
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: window.SC.greenAlly });      // destroyed: the clause is off
    const off = [v0 - P.void, own.cores];
    G.active = P.key;                                                            // your turn: also off
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: window.SC.greenAlly, depl: true, byOpp: true });
    return [on, off, [v0 - P.void, own.cores]];
  }, SPEC('deep-opening-and-desperado'));
  assert.deepEqual(r[0], [1, 2], JSON.stringify(r));
  assert.deepEqual(r[1], [1, 2], JSON.stringify(r));
});

test('K-351 26RBS02-079 LV2 (Your Turn): a Legacy summon puts a Void core into your Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.active = P.key;
    const legacy = BS.mkInst('26RBS01-004'); legacy.cores = 1; legacy.legacyN = 2; P.spirits.push(legacy);
    const t0 = P.trashCores.n, v0 = P.void;
    await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: legacy });
    const on = [P.trashCores.n - t0, v0 - P.void];
    const plain = BS.mkInst('26RBS01-005'); plain.cores = 1; P.spirits.push(plain);      // no Legacy: nothing
    const v1 = P.void, t1 = P.trashCores.n;
    await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: plain });
    return [on, P.trashCores.n - t1, v1 - P.void];
  }, SPEC('deep-opening-and-desperado'));
  assert.deepEqual(r, [[1, 1], 0, 0], JSON.stringify(r));
});

test('K-352 26RBS03-X06 (When Summoned): one core each from three Spirits on either side, and a depletion puts a Void core on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.desperado, weak = window.SC.oppOneCore;
    const total0 = P.spirits.reduce((n, x) => n + x.cores, 0) + O.spirits.reduce((n, x) => n + x.cores, 0);
    const res0 = P.reserve.n + O.reserve.n, void0 = P.void;
    await BS.fireFx(P, 'SUMMONED', t);
    const gone = !O.spirits.includes(weak);
    return [total0 - (P.spirits.reduce((n, x) => n + x.cores, 0) + O.spirits.reduce((n, x) => n + x.cores, 0)), P.reserve.n + O.reserve.n - res0, gone, void0 - P.void];
  }, SPEC('deep-opening-and-desperado'));
  assert.equal(r[1], 3, JSON.stringify(r));      // three cores went to the Reserves
  assert.equal(r[3], 1, JSON.stringify(r));      // a depletion put a Void core on Desperado
  assert.ok(r[0] >= 2, JSON.stringify(r));       // the spirits lost those cores (a depleted 1-core Spirit leaves the field)
});

test('K-353 26RBS03-X06 LV2 (When Attacks): an opposing Cost 5 or less Spirit sends cores until one remains', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.desperado;
    const target = BS.mkInst('26RBS01-008'); target.cores = 3; O.spirits.push(target);      // Cost 5, three cores
    G.step = 5; G.active = P.key;
    const res0 = O.reserve.n;
    await BS.fireFx(P, 'ATTACKS', t);
    return [target.cores, O.reserve.n - res0];
  }, SPEC('deep-opening-and-desperado'));
  assert.deepEqual(r, [1, 2], JSON.stringify(r));
});
