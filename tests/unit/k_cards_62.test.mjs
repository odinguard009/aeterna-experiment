// Lane K tests, file 62 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 22 (Eternal): BS62-029 and BS07-003 (per.side/costLe).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-487 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS62-029', 'BS07-003'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS62-029', true, 'SUMMONED'], ['BS07-003', true, 'ATTACKS']], JSON.stringify(r));
});

test('K-488 BS62-029 (When Summoned): exhausts an opposing Spirit only while Gataru is on your field', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.bug, gataru = window.SC.gataru;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'SUMMONED', t);
    const withGataru = O.spirits.filter(s => s.exhausted).length;
    P.spirits = P.spirits.filter(s => s !== gataru);
    for (const s of O.spirits) s.exhausted = false;
    await BS.fireFx(P, 'SUMMONED', t);
    return [withGataru, O.spirits.filter(s => s.exhausted).length];
  }, SPEC('gataru-and-costs'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-489 BS07-003 (When Attacks): +1000 BP for each opposing Cost 3 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.counter;
    G.step = 5; G.active = P.key;
    const bp0 = BS.bpOf(t);
    await BS.fireFx(P, 'ATTACKS', t);
    const withOne = BS.bpOf(t) - bp0;
    const extra = BS.mkInst('BS01-006'); extra.cores = 1; O.spirits.push(extra);      // a second Cost 2 Spirit
    const bp1 = BS.bpOf(t);
    await BS.fireFx(P, 'ATTACKS', t);
    return [withOne, BS.bpOf(t) - bp1];
  }, SPEC('gataru-and-costs'));
  assert.deepEqual(r, [1000, 2000], JSON.stringify(r));
});
