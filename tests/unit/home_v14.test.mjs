// v0.133.0 U14h: home page extras (Card of the Day, three steps with a summary, deck tiles), the Profile statistics and the Glossary.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const open = async (vp) => { ctx = await (await getBrowser()).newContext(vp); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };

test('HM1 Card of the Day is stable within a day, changes the next day and opens the card', async () => {
  await open({ viewport: { width: 1366, height: 768 } });
  const r = await page.evaluate(() => { const d = new Date(Date.UTC(2026, 9, 26, 3)), e = new Date(Date.UTC(2026, 9, 26, 20)), f = new Date(Date.UTC(2026, 9, 27, 3)); return [BS.cardOfDay(d) === BS.cardOfDay(e), BS.cardOfDay(d) !== BS.cardOfDay(f), !!CARDS[BS.cardOfDay()]]; });
  assert.deepEqual(r, [true, true, true]);
  await page.click('#cotd .cfw'); await page.waitForSelector('#zoom-overlay.active');
});
test('HM2 the Continue panel names the active deck and the four tiles are shown', async () => {
  await page.evaluate(() => document.getElementById('zoom-overlay').classList.remove('active'));
  const r = await page.evaluate(() => { BS.switchSlot(2); BS.switchView('view-lobby'); return { cont: document.getElementById('home-cont').textContent, tiles: document.querySelectorAll('#home-tiles .tile2').length }; });
  assert.match(r.cont, /Continue with/); assert.equal(r.tiles, 4);
});
test('HM3 phone: the home page fits the width', async () => {
  await ctx.close(); await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.querySelectorAll('#home-tiles .tile2').length]);
  assert.equal(w[0], w[1]); assert.equal(w[2], 4);
});
test('HM4 profile statistics come from the history; the glossary lists every keyword', async () => {
  const r = await page.evaluate(() => {
    const h = [{ won: true, fmt: 'eternal', turns: 6 }, { won: true, fmt: 'standard', turns: 8 }, { won: false, fmt: 'eternal', turns: 10 }, { won: true, fmt: 'eternal', turns: 4 }, { won: true, fmt: 'eternal', turns: 2 }];
    const s = BS.profileStats(h); BS.switchView('view-howto');
    return { s, gl: document.querySelectorAll('#howto-gloss .gl-item').length, kw: Object.keys(KEYWORD_GLOSSARY).length, empty: BS.profileStats([]).rate };
  });
  assert.deepEqual([r.s.n, r.s.won, r.s.rate, r.s.streak, r.s.best, r.s.turns], [5, 4, 80, 2, 2, 6]); assert.deepEqual(r.s.byFmt.eternal, [3, 1]);
  assert.equal(r.gl, r.kw); assert.equal(r.empty, 0);
});
