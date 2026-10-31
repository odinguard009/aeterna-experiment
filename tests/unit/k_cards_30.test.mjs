// Lane K tests, file 30 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 16 of v0.202.0: 26RBS02-X10 (White Beard) and 26RBS03-044 (Synthetic Dragon).
// Engine pieces: condition blocksGe, STATIC BLOCKS_AS_ATTACKS, action GRANT_BLOCKS_AS_ATTACKS, collectFx folding BLOCKS into ATTACKS.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-381 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS02-X10', '26RBS03-044'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS02-X10', 'BLOCKS,STATIC:BLOCKS_AS_ATTACKS', true],
    ['26RBS03-044', 'SUMMONED,BLOCKS,BLOCKS', true],
  ], JSON.stringify(r));
});

test('K-382 26RBS02-X10 LV1-2 (When Blocks): with four or less cards in Hand it draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.whiteBeard;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'BLOCKS', t);
    const on = P.hand.length;
    for (let i = 0; i < 4; i++) P.hand.push(BS.mkInst('26RBS01-005'));
    const h1 = P.hand.length;
    await BS.fireFx(P, 'BLOCKS', t);
    return [on, h1, P.hand.length];
  }, SPEC('white-beard-and-synthetic'));
  assert.deepEqual(r, [1, 5, 5], JSON.stringify(r));
});

test('K-383 26RBS02-X10 LV2: a Leucomyst attacker activates its When Blocks effects at When Attacks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.whiteBeard;
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', t);                      // whiteBeard is Leucomyst: its BLOCKS draw folds in
    const on = P.hand.length - h0;
    G.step = 4;                                            // outside the Attack Step: off
    const h1 = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', t);
    return [on, P.hand.length - h1];
  }, SPEC('white-beard-and-synthetic'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-384 26RBS03-044 (When Summoned): all Leucomyst Spirits get the When Blocks-as-When Attacks grant this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.synthetic, wb = window.SC.whiteBeard;
    G.step = 5; G.active = P.key;
    wb.cores = 1;                                          // LV1: the static flag is off, only the grant can fold the draw
    wb.lostLv = 0;
    await BS.fireFx(P, 'SUMMONED', t);
    const marked = wb.blocksAsAtkTurn === G.turnNo;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', wb);
    return [marked, P.hand.length - h0];
  }, SPEC('white-beard-and-synthetic'));
  assert.deepEqual(r, [true, 1], JSON.stringify(r));
});

test('K-385 26RBS03-044 LV2 (When Blocks): three Spirits with When Blocks effects bounce two opposing Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.synthetic, ally = window.SC.blocksAlly;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'BLOCKS', t);
    const two = [O.hand.length, O.spirits.length];
    const oppA = BS.mkInst('26RBS01-004'); oppA.cores = 1; O.spirits.push(oppA);
    const oppB = BS.mkInst('26RBS01-002'); oppB.cores = 1; O.spirits.push(oppB);
    P.spirits = P.spirits.filter(s => s !== ally);          // only two blocks Spirits left: one target
    O.hand.length = 0;
    await BS.fireFx(P, 'BLOCKS', t);
    return [two, O.hand.length, O.spirits.length];
  }, SPEC('white-beard-and-synthetic'));
  assert.deepEqual(r[0], [2, 0], JSON.stringify(r));
  assert.deepEqual(r[1], 1, JSON.stringify(r));
});
