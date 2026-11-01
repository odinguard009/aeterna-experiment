// Lane K tests, file 44 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 4 (Eternal): BS14-028 and BS43-RV013 (When Summoned: exhaust all Cost 3 or less Spirits).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-430 data: both Eternal cards carry their printed clause', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS14-028', 'BS43-RV013'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(','), c.effects.at(-1).actions[0].do];
  }));
  assert.deepEqual(r, [['BS14-028', true, 'SUMMONED', 'EXHAUST_ALL_OPP'], ['BS43-RV013', true, 'ATTACKS,SUMMONED', 'EXHAUST_ALL_OPP']], JSON.stringify(r));
});

test('K-431 BS14-028 (When Summoned): every Cost 3 or less Spirit on both sides is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.halfA, ownBig = window.SC.ownBig,
      oppSmall = window.SC.oppSmall, oppBig = window.SC.oppBig;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'SUMMONED', t);
    return [t.exhausted, oppSmall.exhausted, ownBig.exhausted, oppBig.exhausted];
  }, SPEC('exhaust-halves'));
  assert.deepEqual(r, [false, true, false, false], JSON.stringify(r));      // the caster is Cost 4, so it stays refreshed
});

test('K-432 BS43-RV013 behaves the same', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const t = BS.mkInst('BS43-RV013'); t.cores = 2; P.spirits.push(t);
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'SUMMONED', t);
    return [t.exhausted, window.SC.oppSmall.exhausted, window.SC.ownBig.exhausted];
  }, SPEC('exhaust-halves'));
  assert.deepEqual(r, [false, true, false], JSON.stringify(r));
});
