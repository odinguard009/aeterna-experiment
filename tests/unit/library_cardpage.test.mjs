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
    const rel = [...document.querySelectorAll('#cp-page .cp-art')].map(b => b.dataset.v);     // v0.155.0: the Art block lists the card's own picture first, then every other printing
    document.querySelector('#cp-page [data-a="art"][data-v="26RBS03-X02"]').click();
    const picked = BS.ART_ALT['BS01-X01'], on = document.querySelector('#cp-page .cp-art.on').dataset.v;
    document.querySelector('#cp-page [data-a="art"][data-v="BS01-X01"]').click();
    return { rel, picked, on, after: BS.ART_ALT['BS01-X01'] || '' };
  });
  assert.deepEqual(r.rel, ['BS01-X01', '26RBS03-X02']); assert.equal(r.picked, '26RBS03-X02'); assert.equal(r.on, '26RBS03-X02'); assert.equal(r.after, '');
});
test('CP2 the saved decks that hold the card are listed with their count', async () => {
  const r = await page.evaluate(() => { const id = Object.keys(SLOTS[0].cards)[0], n = SLOTS[0].cards[id]; openZoom(id); return { n, txt: [...document.querySelectorAll('#cp-page .sec')].find(h => h.textContent === 'Used in your decks').nextElementSibling.textContent, name: SLOTS[0].name }; });
  assert.ok(r.txt.includes(r.name + ' ×' + r.n), r.txt);
});
test('CP3 no card page during a match; phone fits', async () => {
  const r = await page.evaluate(() => { BS.switchView('view-lobby'); openZoom('BS01-X01'); return document.querySelectorAll('#zoom-overlay .cpage').length; });   // v0.137.0: in the Library the card is a page, elsewhere the overlay has none
  assert.equal(r, 0);
  await ctx.close(); await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const w = await page.evaluate(() => { openZoom('BS01-X01'); return [document.documentElement.scrollWidth, innerWidth, document.querySelectorAll('#cp-page .cp-arts').length]; });
  assert.equal(w[0], w[1]); assert.equal(w[2], 1);
});
test('CP4 the Library card is a page: prev/next, Add to deck and the back button', async () => {
  const r = await page.evaluate(() => {
    openZoom('BS01-X01');
    const v = document.querySelector('.app-view.active').id, n = document.querySelector('#cp-page .mut').textContent;
    document.querySelector('#cp-page [data-a="cp-nav"][data-v="1"]').click();
    const nx = document.querySelector('#cp-page .mut').textContent;
    const id = document.querySelector('#cp-page h2 + span').textContent.split(' · ')[0], before = PLAYER_DECK[id] || 0;
    document.querySelector('#cp-page [data-a="cp-add"]').click();
    const added = (PLAYER_DECK[id] || 0) - before;
    document.querySelector('#cp-page [data-a="go-lib"]').click();
    return { v, moved: n !== nx, added, back: document.querySelector('.app-view.active').id };
  });
  assert.deepEqual(r, { v: 'view-card', moved: true, added: 1, back: 'view-library' });
});
