// v0.131.0 U14g: the Library's Lore section reads the English flavor texts by series (data/index/flavor.json via tools/fetch_flavor.py).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const flavor = JSON.parse(readFileSync(new URL('../../data/index/flavor.json', import.meta.url), 'utf8'));
const open = async (vp) => {
  ctx = await (await getBrowser()).newContext(vp); page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.switchView('view-library'); return 1; });
  await page.click('#lib-tabs [data-v="lore"]');
};

test('LO1 the flavor index is data: ids of the library, plain English text, no wiki markup', () => {
  const ids = Object.keys(flavor); assert.ok(ids.length > 3000, String(ids.length));
  for (const id of ids.slice(0, 400)) { assert.match(id, /^[0-9A-Z]+-/); assert.doesNotMatch(flavor[id], /\[\[|\{\{|<br|'''/); assert.ok(flavor[id].length > 3); }
});
test('LO2 PC: the Lore section lists the first series in order and a card opens from it', async () => {
  await open({ viewport: { width: 1366, height: 768 } });
  const r = await page.evaluate(() => { const s = BS.loreSeries(); return { n: s.length, keys: s.map(x => x[0]), first: s[0][1].length, shown: document.querySelectorAll('#lib-lore .lore-item').length, opt: document.querySelectorAll('#lib-lore-set option').length }; });
  assert.ok(r.n > 5 && r.shown === r.first && r.opt === r.n, JSON.stringify([r.n, r.first, r.shown, r.opt]));
  const sorted = await page.evaluate(k => k.slice().sort(BS.DB_COLL.compare).join() === k.join(), r.keys); assert.equal(sorted, true);
  await page.click('#lib-lore .lore-item >> nth=0');
  await page.waitForSelector('#zoom-overlay.active');
});
test('LO3 the series list switches the list; the text is the flavor of that card', async () => {
  const r = await page.evaluate(() => { const s = BS.loreSeries(), pick = s[s.length - 1]; document.querySelector(`#lib-lore-nav [data-v="${pick[0]}"]`).click(); const it = document.querySelector('#lib-lore .lore-item'); return { shown: document.querySelectorAll('#lib-lore .lore-item').length, want: pick[1].length, ok: it.querySelector('p').textContent === '“' + BS.lore()[it.dataset.v] + '”' }; });
  assert.equal(r.shown, r.want); assert.equal(r.ok, true);
});
test('LO4 phone: the Lore section fits the screen', async () => {
  await ctx.close();
  await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, n: document.querySelectorAll('#lib-lore .lore-item').length }));
  assert.equal(r.sw, r.vw); assert.ok(r.n > 0);
});
