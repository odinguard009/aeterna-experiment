// Lane K tests, file 39 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 25 of v0.202.0 (Eternal): BS41-013 (Grudge Dragon) and BS16-081 (Magic-of-Oz) - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-413 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const g = BS.CARDS['BS41-013'], m = BS.CARDS['BS16-081'];
    return [g.implemented === true, g.effects.map(e => e.trigger).join(','), m.implemented === true, m.magic.timing.join('+'), m.magic.by.MAIN.actions.map(a => a.do).join(',')];
  });
  assert.deepEqual(r, [true, 'BLOCKS,DESTROYED', true, 'MAIN+FLASH', 'DISCARD_ALL_HAND,DRAW'], JSON.stringify(r));
});

test('K-414 BS41-013: the colour and symbol are also White', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    return [BS.CARDS['BS41-013'].colors, BS.symbolAttrs(BS.CARDS['BS41-013'])[0], BS.symbolsOn(P).purple, BS.symbolsOn(P).white];
  }, SPEC('grudge-and-oz'));
  assert.deepEqual(r, [['purple', 'white'], ['purple', 'white'], 1, 1], JSON.stringify(r));
});

test('K-415 BS41-013 LV2: it draws when it blocks and when it is destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.grudge;
    G.step = 5; G.active = G.p.opponent.key;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'BLOCKS', t, { subject: t });
    const blocked = P.hand.length - h0;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    const h1 = P.hand.length;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [blocked, P.hand.length - h1];
  }, SPEC('grudge-and-oz'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});

test('K-416 BS16-081 Main: discarding the entire Hand draws three cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const h0 = P.hand.length;
    const m = BS.CARDS['BS16-081'];
    await BS.runActions({ p: P, opp: G.p.opponent, src: P.spirits[0], ctx: {} }, { actions: m.magic.by.MAIN.actions });
    return [h0, P.hand.length];
  }, SPEC('grudge-and-oz'));
  assert.deepEqual(r, [3, 3], JSON.stringify(r));      // three discarded, three drawn
});
