// Lane K tests, file 52 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 12 (Eternal): BS40-024 Masked Tanager.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-454 data: Masked Tanager carries High Speed and the LV2 clause', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['BS40-024'];
    return [c.implemented === true, c.highSpeed === true, c.effects.map(e => e.trigger).join(',')];
  });
  assert.deepEqual(r, [true, true, 'DESTROYED'], JSON.stringify(r));
});

test('K-455 BS40-024 LV2 (When Destroyed): by exhausting an opposing Spirit it returns to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.tanager, opp = window.SC.oppA;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [opp.exhausted, P.hand.includes(t), P.trash.includes(t)];
  }, SPEC('masked-tanager'));
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});
