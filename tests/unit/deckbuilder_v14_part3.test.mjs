// v0.130.0 U14f3: Group dropdown (PC and phone) and Colour dropdown (phone); one pick; "Several" when chips set more than one.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const ctxs = [];
after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });
const open = async (mobile) => {
  const ctx = await (await getBrowser()).newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 768 } }); ctxs.push(ctx);
  const page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); BS.dbResetFilters(); return 1; });
  return page;
};

test('DD1 PC: the Group dropdown filters by one group; the colour dropdown is phone only', async () => {
  const page = await open(false);
  assert.equal(await page.isVisible('#db-dd-groups'), true);
  assert.equal(await page.isVisible('#db-dd-colors'), false);
  const opts = await page.$$eval('#db-dd-groups option', o => o.map(x => x.textContent));
  assert.ok(opts.includes('Any group') && opts.includes('Mirage'), opts.join());
  await page.selectOption('#db-dd-groups', 'mirage');
  assert.deepEqual(await page.evaluate(() => [...BS.DBF.groups]), ['mirage']);
  await page.selectOption('#db-dd-groups', '');
  assert.equal(await page.evaluate(() => BS.DBF.groups.size), 0);
});
test('DD2 phone: both dropdowns show; Several appears when chips set two colours', async () => {
  const page = await open(true);
  await page.evaluate(() => { document.getElementById('db-filter-btn').click(); return 1; });
  await page.waitForTimeout(400);
  assert.equal(await page.isVisible('#db-dd-colors'), true);
  await page.selectOption('#db-dd-colors', 'red');
  assert.deepEqual(await page.evaluate(() => [...BS.DBF.colors]), ['red']);
  await page.evaluate(() => { document.querySelector('[data-a="db-chip"][data-v="colors:blue"]').click(); return 1; });
  assert.equal(await page.inputValue('#db-dd-colors'), '*');
  assert.match(await page.textContent('#db-dd-colors'), /Several/);
});
