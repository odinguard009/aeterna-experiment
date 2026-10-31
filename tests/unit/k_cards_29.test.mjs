// Lane K tests, file 29 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 15 of v0.202.0: 26RDB01-028 (Ragnareia Rockwell) - printed clauses only, no new engine piece.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-378 data: Ragnareia carries both printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RDB01-028'];
    return [c.implemented === true, c.effects.map(e => e.trigger + (e.invoke ? ':' + e.when + ':' + e.cost.pay : '')).join(',')];
  });
  assert.deepEqual(r, [true, 'SUMMONED,ACTIVATE:duringAttack:3'], JSON.stringify(r));
});

test('K-379 26RDB01-028 LV1-2 (When Summoned): three Legacy-banished Green Wave cards put three Void cores on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.ragnareia;
    G.step = 5; G.active = P.key;
    const c0 = t.cores, v0 = P.void;
    t.legacyN = 2;
    await BS.fireFx(P, 'SUMMONED', t);              // only two: nothing
    const off = [t.cores - c0, v0 - P.void];
    t.legacyN = 3;
    await BS.fireFx(P, 'SUMMONED', t);
    return [off, t.cores - c0, v0 - P.void];
  }, SPEC('ragnareia'));
  assert.deepEqual(r, [[0, 0], 3, 3], JSON.stringify(r));
});

test('K-380 26RDB01-028 LV2: the Invoke needs every card Green Wave', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const cond = { allHave: { team: 'Green Wave' } };
    const on = BS.fxIf(P, G.p.opponent, cond, { selfInst: window.SC.ragnareia });
    const other = BS.mkInst('26RBS01-004'); other.cores = 1; P.spirits.push(other);      // a non-Green-Wave card
    const off = BS.fxIf(P, G.p.opponent, cond, { selfInst: window.SC.ragnareia });
    return [on, off];
  }, SPEC('ragnareia'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});
