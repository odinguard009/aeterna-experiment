// sharedBoard(): one page per file, reset by BS.testSetup() on every call (cuts ~1.2 s of page load per test).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('SB-01 sharedBoard reuses the page and gives every test a fresh quiet board', async () => {
  const a = await sharedBoard();
  await a.page.evaluate(() => { BS.G.p.player.spirits.push(BS.mkInst(Object.keys(BS.CARDS)[0])); return 1; });
  const b = await sharedBoard();
  assert.equal(a.page, b.page);
  assert.equal(await b.page.evaluate(() => BS.G.p.player.spirits.length), 0);
  assert.deepEqual(b.errors, []);
});
