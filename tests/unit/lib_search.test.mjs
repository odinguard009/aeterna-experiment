// Library and Deck Builder search: a typed query finds partial cards (the Library defaults to Complete) and family names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

async function open(view) {
  const b = await getBrowser(), ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  if (view === 'lib') await page.evaluate(() => document.querySelector('[data-a="go-lib"]').click());
  else { await page.evaluate(() => document.querySelector('[data-a="go-decks"]').click()); await page.waitForTimeout(300); await page.evaluate(() => document.querySelector('[data-a="dk-edit"]').click()); }
  await page.waitForTimeout(400);
  return { ctx, page };
}
const shown = (page, input, count) => async (q) => {
  await page.fill(input, q); await page.waitForTimeout(600);
  return page.evaluate((id) => Number((document.getElementById(id).textContent.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, '')), count);
};

test('LS01 Library: a typed name finds a partial product-only card and a family name finds cards', async () => {
  const { ctx, page } = await open('lib');
  try {
    const n = shown(page, '#lib-search', 'lib-count');
    assert.ok(await n('SD33-X01') >= 1);
    assert.ok(await n('HorseTwelve') >= 1);
    assert.ok(await n('Red Cloud') >= 10);
  } finally { await ctx.close(); await closeBrowser(); }
});

test('LS02 Deck Builder: the same queries find the card and the family', async () => {
  const { ctx, page } = await open('db');
  try {
    const n = shown(page, '#db-search', 'db-count');
    assert.ok(await n('SD33-X01') >= 1);
    assert.ok(await n('Red Cloud') >= 10);
  } finally { await ctx.close(); await closeBrowser(); }
});
