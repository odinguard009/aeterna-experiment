// v0.132.0 U14g2: the Library card page: related printings, decks that hold the card, the art picker, tilt.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const open = async (vp) => {
  ctx = await (await getBrowser()).newContext(vp); page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.switchView('view-library'); return 1; });
};

test('CP1 a card with a second printing lists it as related and offers it as art; picking is stored and undone', async () => {
  await open({ viewport: { width: 1366, height: 768 } });
  const r = await page.evaluate(() => {
    openZoom('BS01-X01');
    const rel = [...document.querySelectorAll('.cpage .cp-row')[0].querySelectorAll('button')].map(b => b.dataset.v);
    document.querySelector('.cpage [data-a="art"][data-v="26RBS03-X02"]').click();
    const picked = BS.ART_ALT['BS01-X01'], on = document.querySelector('.cpage .cp-chip.on').dataset.v;
    document.querySelector('.cpage [data-a="art"][data-v="BS01-X01"]').click();
    return { rel, picked, on, after: BS.ART_ALT['BS01-X01'] || '' };
  });
  assert.deepEqual(r.rel, ['26RBS03-X02']); assert.equal(r.picked, '26RBS03-X02'); assert.equal(r.on, '26RBS03-X02'); assert.equal(r.after, '');
});
test('CP2 the saved decks that hold the card are listed with their count', async () => {
  const r = await page.evaluate(() => { const id = Object.keys(SLOTS[0].cards)[0], n = SLOTS[0].cards[id]; openZoom(id); return { n, txt: [...document.querySelectorAll('.cpage h4')].find(h => h.textContent === 'Used in decks').nextElementSibling.textContent, name: SLOTS[0].name }; });
  assert.ok(r.txt.includes(r.name + ' ×' + r.n), r.txt);
});
test('CP3 no card page during a match; phone fits', async () => {
  const r = await page.evaluate(() => { BS.switchView('view-lobby'); openZoom('BS01-X01'); return document.querySelectorAll('.cpage').length; });
  assert.equal(r, 0);
  await ctx.close(); await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const w = await page.evaluate(() => { openZoom('BS01-X01'); return [document.documentElement.scrollWidth, innerWidth, document.querySelectorAll('.cpage').length]; });
  assert.equal(w[0], w[1]); assert.equal(w[2], 1);
});
