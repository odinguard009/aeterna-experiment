// Lane K tests, file 56 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 16 (Eternal): BS31-029 and BS24-051 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-466 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS31-029', 'BS24-051'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS31-029', true, 'SUMMONED'], ['BS24-051', true, 'ALLY_SUMMONED']], JSON.stringify(r));
});

test('K-467 BS31-029 (When Summoned): exhausts an opposing Spirit, and the Soul Core path adds a Void core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.ninja, opp = window.SC.oppA;
    G.step = 5; G.active = P.key;
    const c0 = t.cores;
    await BS.fireFx(P, 'SUMMONED', t);
    const plain = [opp.exhausted, t.cores - c0];
    opp.exhausted = false;
    const c1 = t.cores;
    t.soulPaid = true;                              // the Soul Core paid the summon cost
    await BS.fireFx(P, 'SUMMONED', t, { subject: t });
    return [plain, t.cores - c1];
  }, SPEC('summon-openers'));
  assert.deepEqual(r[0], [true, 0], JSON.stringify(r));
  assert.equal(r[1], 1, JSON.stringify(r));
});

test('K-468 BS24-051 (Your Main Step): a Cost 4 or less Artificial Soldier summon adds one Void core, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.tobby, golem = window.SC.golem;
    G.step = 4; G.active = P.key;                              // MAIN
    const c0 = t.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: golem });
    const first = t.cores - c0;
    await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: golem });
    return [first, t.cores - c0];
  }, SPEC('summon-openers'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});
