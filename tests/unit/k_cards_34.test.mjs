// Lane K tests, file 34 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 20 of v0.202.0: 26RDB01-X05 (Rei-Ohba).
// Engine piece: STATIC flag LIFE_HIT_PLUS {n} read by the life-damage calculation.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-397 data: Rei-Ohba carries both printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RDB01-X05'];
    return [c.implemented === true, c.effects.map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(',')];
  });
  assert.deepEqual(r, [true, 'SUMMONED,STATIC:LIFE_HIT_PLUS'], JSON.stringify(r));
});

test('K-398 26RDB01-X05 LV1-2 (When Summoned): discarding a Sword Eye Magic gives an opposing Spirit -7000 BP and destroys it at 0', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.reiOhba, opp = window.SC.oppA;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'SUMMONED', t);
    const on = [P.hand.length, P.trash.length, !O.spirits.includes(opp)];
    const other = BS.mkInst('26RBS01-004'); other.cores = 1; O.spirits.push(other);
    P.hand.length = 0;                                     // no Sword Eye Magic in the Hand: nothing happens
    await BS.fireFx(P, 'SUMMONED', t);
    return [on, O.spirits.includes(other)];
  }, SPEC('rei-ohba'));
  assert.deepEqual(r[0], [0, 3, true], JSON.stringify(r));      // two in the Trash + the discarded one
  assert.equal(r[1], true, JSON.stringify(r));
});

test('K-399 26RDB01-X05 LV2: two Sword Eye Magic cards in the Trash add one extra Life damage to its attack', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.reiOhba;
    G.step = 5; G.active = P.key; G.active = P.key;
    const l0 = O.life;
    await BS.doBattle(P.key, t);
    const on = l0 - O.life;
    if (G.over) return [on];
    O.life = 5; t.exhausted = false; O.spirits.length = 0;
    P.trash = [];                                          // fewer than two Sword Eye Magic cards: no extra
    const l1 = O.life;
    await BS.doBattle(P.key, t);
    return [on, l1 - O.life];
  }, SPEC('rei-ohba'));
  assert.deepEqual(r, [2, 1], JSON.stringify(r));
});
