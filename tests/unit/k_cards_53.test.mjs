// Lane K tests, file 53 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 13 (Eternal): BS61-023, BS42-029, BS38-RV013 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-456 data: the three Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS61-023', 'BS42-029', 'BS38-RV013'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS61-023', true, 'ATTACKS,ATTACKS,SUMMONED'], ['BS42-029', true, 'ATTACKS'], ['BS38-RV013', true, 'STATIC,BLOCKS']], JSON.stringify(r));
});

test('K-457 BS61-023 (When Summoned): counters +1 and a Void core to it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.woodPony;
    G.step = 5; G.active = P.key;
    const n0 = P.count, c0 = t.cores;
    await BS.fireFx(P, 'SUMMONED', t);
    return [P.count - n0, t.cores - c0];
  }, SPEC('core-by-three'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});

test('K-458 BS42-029 (When Attacks): a Void core, then an opposing Spirit is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.higekoga, opp = window.SC.oppA;
    G.step = 5; G.active = P.key;
    const c0 = t.cores;
    await BS.fireFx(P, 'ATTACKS', t);
    return [t.cores - c0, opp.exhausted];
  }, SPEC('core-by-three'));
  assert.deepEqual(r, [1, true], JSON.stringify(r));
});

test('K-459 BS38-RV013 (When Blocks): a Void core, then it refreshes once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.northernbeard;
    G.step = 5; G.active = G.p.opponent.key;
    t.exhausted = true;
    const c0 = t.cores;
    await BS.fireFx(P, 'BLOCKS', t, { subject: t });
    const on = [t.cores - c0, t.exhausted];
    t.exhausted = true;
    const c1 = t.cores;
    await BS.fireFx(P, 'BLOCKS', t, { subject: t });      // once per turn
    return [on, t.cores - c1, t.exhausted];
  }, SPEC('core-by-three'));
  assert.deepEqual(r[0], [1, false], JSON.stringify(r));
  assert.deepEqual(r[1], 0, JSON.stringify(r));
});
