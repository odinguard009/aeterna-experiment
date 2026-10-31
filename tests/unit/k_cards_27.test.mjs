// Lane K tests, file 27 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 13 of v0.202.0: 26RBS02-073 (Ordolily) and 26RDB01-X02 (Noa Fleur).
// Engine piece: action EXHAUST_NEXUS_DESTROY {costLe}.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-368 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS02-073', '26RDB01-X02'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS02-073', 'ATTACKS,START_ATTACK', true],
    ['26RDB01-X02', 'SUMMONED,ATTACKS', true],
  ], JSON.stringify(r));
});

test('K-369 26RBS02-073 (When Attacks): every Nexus exhausts and one Cost 4 or less opposing Spirit dies per Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.ordolily;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'ATTACKS', t);
    return [P.nexus.filter(n => n.exhausted).length, O.spirits.length];
  }, SPEC('ordolily-and-noa'));
  assert.deepEqual(r, [2, 0], JSON.stringify(r));
});

test('K-370 26RBS02-073 LV2: a Cyantree Nexus becomes a LV1 5000 BP Spirit with a core from the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.ordolily;
    G.step = 5; G.active = P.key;
    const r0 = P.reserve.n, n0 = P.nexus.length;
    await BS.fireFx(P, 'START_ATTACK', t);
    const made = P.spirits.filter(s => s.asSpirit);
    return [n0 - P.nexus.length, made.length, made.length ? BS.bpOf(made[0]) : -1, r0 - P.reserve.n];
  }, SPEC('ordolily-and-noa'));
  assert.deepEqual(r, [1, 1, 5000, 1], JSON.stringify(r));
});

test('K-371 26RDB01-X02 LV1-2 (When Summoned): three or more Legacy-banished Red Stella cards destroy opposing Spirits up to 10000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.noa;
    G.step = 5; G.active = P.key;
    t.legacyN = 2;
    await BS.fireFx(P, 'SUMMONED', t);                     // only two Legacy cards: nothing happens
    const off = O.spirits.length;
    t.legacyN = 3;
    await BS.fireFx(P, 'SUMMONED', t);
    return [off, O.spirits.length];
  }, SPEC('ordolily-and-noa'));
  assert.deepEqual(r, [2, 0], JSON.stringify(r));
});

test('K-372 26RDB01-X02 LV2 (When Attacks): three exhausted Red Stella Spirits give it an extra Red symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.noa;
    G.step = 5; G.active = P.key;
    for (const id of ['26RDB01-001', '26RDB01-002', '26RDB01-003']) {
      const a = BS.mkInst(id); a.cores = 1; a.exhausted = true; P.spirits.push(a);
    }
    const red0 = BS.symbolsOn(P).red || 0;
    await BS.fireFx(P, 'ATTACKS', t);
    return [1, (BS.symbolsOn(P).red || 0) - red0];
  }, SPEC('ordolily-and-noa'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));      // the extra Red symbol lands on Noa only
});
