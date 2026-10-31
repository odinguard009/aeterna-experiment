// Lane K tests, file 31 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 17 of v0.202.0: 26RDB01-X06 (Tia Madoola).
// Engine pieces: REVEAL_DEPLOY.maxSummon, STATIC BLOCK_TAX {match, pay} read by payBlockTax.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-386 data: Tia carries both printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RDB01-X06'];
    return [c.implemented === true, c.effects.map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(',')];
  });
  assert.deepEqual(r, [true, 'ATTACKS,STATIC:BLOCK_TAX'], JSON.stringify(r));
});

test('K-387 26RDB01-X06 LV1-2 (When Attacks): with the Soul Core in the Reserve it summons up to two Blue Beat Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.tia;
    G.step = 5; G.active = P.key;
    P.reserve.soul = false;
    const n0 = P.spirits.length;
    await BS.fireFx(P, 'ATTACKS', t);                     // no Soul Core: nothing
    const off = P.spirits.length - n0;
    P.reserve.soul = true;
    await BS.fireFx(P, 'ATTACKS', t);
    const summoned = P.spirits.slice(n0);
    return [off, summoned.map(x => x.id)];
  }, SPEC('tia-madoola'));
  assert.deepEqual(r[0], 0, JSON.stringify(r));
  assert.equal(r[1].length, 2, JSON.stringify(r));
  assert.ok(r[1].every(id => ['26RDB01-034', '26RDB01-035'].includes(id)), JSON.stringify(r));
});

test('K-388 26RDB01-X06 LV2: a block costs the opponent two Reserve cores', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.tia, bb = window.SC.blueBeat, blk = window.SC.blocker;
    G.step = 5; G.active = P.key; G.battleNo = 9; G.attacker = bb;
    const r0 = O.reserve.n;
    const paid = await BS.payBlockTax(O, bb, blk);
    const spent = r0 - O.reserve.n;
    O.reserve.n = 0;
    const broke = await BS.payBlockTax(O, bb, blk);
    return [paid, spent, broke];
  }, SPEC('tia-madoola'));
  assert.deepEqual(r, [true, 2, false], JSON.stringify(r));
});
