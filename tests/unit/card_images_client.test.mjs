// v0.112.0 (card images online): the client fallback chain. cardImgSrc returns the player's own image
// (IndexedDB blob) when present, else the online server's mirror URL for the card's official art when an
// online origin exists, else '' (offline, no image -> the text/colour placeholder). imgCls/imgSty follow it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, openGame } from './lib/game.mjs';

let ctx = null;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('CIMG-2 cardImgSrc prefers the player image, then the online mirror, then nothing', async () => {
  const b = await getBrowser(); ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const g = await openGame();
  const page = g.page;
  await page.waitForFunction(() => window.BS && window.BS.cardImgSrc);

  // Offline (file://): no player image and no server -> empty, so the placeholder shows.
  const offline = await page.evaluate(() => ({
    src: BS.cardImgSrc('BS01-001'),
    cls: BS.imgCls('BS01-001'),
    sty: BS.imgSty('BS01-001'),
  }));
  assert.equal(offline.src, '', 'offline has no card image');
  assert.equal(offline.cls, '');
  assert.equal(offline.sty, '');

  // An online origin points at the server mirror for the card's official art.
  await page.evaluate(() => { BS.SETTINGS.onlineUrl = 'http://localhost:8080'; });
  const online = await page.evaluate(() => ({
    src: BS.cardImgSrc('BS01-001'),
    cls: BS.imgCls('BS01-001'),
    sty: BS.imgSty('BS01-001'),
  }));
  assert.equal(online.src, 'http://localhost:8080/assets/card-images/BS01-001');
  assert.equal(online.cls, ' has-img');
  assert.equal(online.sty, `;background-image:url('http://localhost:8080/assets/card-images/BS01-001')`);

  // The player's own image always wins over the mirror.
  await page.evaluate(() => { BS.IMG['BS01-001'] = 'blob:player-supplied'; });
  const own = await page.evaluate(() => ({
    src: BS.cardImgSrc('BS01-001'),
    cls: BS.imgCls('BS01-001'),
  }));
  assert.equal(own.src, 'blob:player-supplied');
  assert.equal(own.cls, ' has-img');
});
