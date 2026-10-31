// Lane K tests, file 48 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 8 (Eternal): BS19-027 and BS35-037 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-442 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS19-027', 'BS35-037'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS19-027', true, 'ATTACKS,ATTACKS'], ['BS35-037', true, 'BLOCKS,STATIC,OPP_ATTACKS']], JSON.stringify(r));
});

test('K-443 BS19-027 LV2 (When Attacks): the first attack of the turn refreshes it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.firstAttack;
    G.step = 5; G.active = P.key;
    t.exhausted = true; P.attacksThisTurn = 1;
    await BS.fireFx(P, 'ATTACKS', t);
    const first = t.exhausted;
    t.exhausted = true; P.attacksThisTurn = 2;
    await BS.fireFx(P, 'ATTACKS', t);
    return [first, t.exhausted];
  }, SPEC('refresh-two'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-444 BS35-037 (Opposing Attack Step): an opposing attack refreshes it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.oppAttack;
    G.step = 5; G.active = G.p.opponent.key;
    t.exhausted = true;
    await BS.fireFx(P, 'OPP_ATTACKS', window.SC.oppA, { attacker: window.SC.oppA });
    return t.exhausted;
  }, SPEC('refresh-two'));
  assert.equal(r, false, String(r));
});
