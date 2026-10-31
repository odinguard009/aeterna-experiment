// Lane K tests, file 20 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 6 of v0.202.0: 26RBS02-005 (Cornhilo) and 26RBS02-075 (The Floating Crag Citadel).
// Engine piece: action GRANT_FLAG {flag, match} - a one-turn flag mark read by flagActive ("give it: Clash this turn").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-333 data: the bundle cards grant Clash through the new action', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS02-005', '26RBS02-075'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true, (c.effects[0].actions[0].do + ':' + c.effects[0].actions[0].flag)];
  }));
  assert.deepEqual(r, [
    ['26RBS02-005', 'SUMMONED,ALLY_BATTLE_WIN', true, 'GRANT_FLAG:MUST_BLOCK'],
    ['26RBS02-075', 'SUMMONED,ALLY_BATTLE_WIN', true, 'GRANT_FLAG:MUST_BLOCK'],
  ], JSON.stringify(r));
});

test('K-334 26RBS02-005 (When Summoned): one of your Red Spirits gains Clash for this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.cornhilo, red = window.SC.redTarget;
    await BS.fireFx(P, 'SUMMONED', t);
    const got = [red, t].map(x => [x.grantFlag, x.grantFlagTurn === G.turnNo]).find(x => x[0]);
    const on = got || [null, false];
    red.grantFlag = null; red.grantFlagTurn = 0;
    const red2 = red; P.spirits = P.spirits.filter(s => s !== red2);      // no Red Spirit: nothing to give
    await BS.fireFx(P, 'SUMMONED', t);
    return [on, red2.grantFlag];
  }, SPEC('clash-grant'));
  assert.deepEqual(r, [['MUST_BLOCK', true], null], JSON.stringify(r));
});

test('K-335 26RBS02-075 (When Deployed): one of your Spirits gains Clash for this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, n = window.SC.crag, red = window.SC.redTarget;
    await BS.fireFx(P, 'SUMMONED', n);
    return [red.grantFlag === 'MUST_BLOCK' || window.SC.cornhilo.grantFlag === 'MUST_BLOCK', red.grantFlagTurn === G.turnNo || window.SC.cornhilo.grantFlagTurn === G.turnNo];
  }, SPEC('clash-grant'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-336 26RBS02-005 LV2 (Your Attack Step): a Clash Spirit winning by BP comparison refreshes it, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.cornhilo, red = window.SC.redTarget;
    G.step = 5; G.active = P.key; G.battleNo = 4;
    const clash = BS.mkInst('26RDB01-010'); clash.cores = 1; P.spirits.push(clash);      // a Spirit with the Clash keyword
    t.exhausted = true;
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: clash });
    const on = !t.exhausted;
    t.exhausted = true; G.battleNo = 5;
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: clash });
    return [on, t.exhausted];
  }, SPEC('clash-grant'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-337 26RBS02-075 LV2 (Your Attack Step): a battle win gives one of your Spirits +5000 BP during this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, n = window.SC.crag, red = window.SC.redTarget;
    G.step = 5; G.active = P.key; G.battleNo = 6; G.attacker = red;      // battle BP needs a fighting Spirit
    const before = P.spirits.map(x => BS.bpOf(x));
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: red });
    const after = P.spirits.map(x => BS.bpOf(x));
    return [0, Math.max(...after.map((b, i) => b - before[i]))];
  }, SPEC('clash-grant'));
  assert.deepEqual(r[1], 5000, JSON.stringify(r));
});
