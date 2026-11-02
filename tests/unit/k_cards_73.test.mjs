// Lane K tests, file 73 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 9 (v0.203.0+): permanent colour treatments stored as the card colours list.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-532 data: the six colour-treatment cards are complete with both colours', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS09-001', 'BS09-019', 'BS09-028', 'BS09-037', 'BS09-046', 'BS10-021'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.colors || []).slice().sort()];
  }));
  assert.deepEqual(r, [
    ['BS09-001', true, ['blue', 'red']],
    ['BS09-019', true, ['green', 'white']],
    ['BS09-028', true, ['white', 'yellow']],
    ['BS09-037', true, ['purple', 'yellow']],
    ['BS09-046', true, ['blue', 'green']],
    ['BS10-021', true, ['green', 'purple']],
  ], JSON.stringify(r));
});

test('K-533 the colour list makes the Spirit answer a colour check for both colours', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const yes = (id, col) => {
      const c = BS.CARDS[id];
      return [].concat(c.colors || [c.color, c.symbol]).includes(col);
    };
    return [yes('BS09-019', 'green'), yes('BS09-019', 'white'), yes('BS09-019', 'red')];
  });
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});
