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
  assert.equal(await page.isVisible('#db-groups .ddb'), true);
  assert.equal(await page.isVisible('#db-colbtn .ddb'), false);
  await page.click('#db-groups .ddb');
  const opts = await page.$$eval('#db-tbar .ddmenu .ddi', o => o.map(x => x.textContent.replace('✓', '').trim()));
  assert.ok(opts.includes('Mirage'), opts.join());
  await page.click('#db-tbar .ddmenu [data-v="mirage"]');
  assert.deepEqual(await page.evaluate(() => [...BS.DBF.groups]), ['mirage']);
  assert.match(await page.textContent('#db-groups .ddb'), /Mirage/);
  await page.click('#db-tbar .ddmenu [data-v="mirage"]');
  assert.equal(await page.evaluate(() => BS.DBF.groups.size), 0);
});
test('DD2 phone: both dropdowns show; picks add up and the button lists them', async () => {
  const page = await open(true);
  assert.equal(await page.isVisible('#db-colbtn .ddb'), true);
  await page.click('#db-colbtn .ddb');
  await page.click('#db-tbar .ddmenu [data-v="red"]');
  assert.deepEqual(await page.evaluate(() => [...BS.DBF.colors]), ['red']);
  await page.click('#db-tbar .ddmenu [data-v="blue"]');
  assert.deepEqual(await page.evaluate(() => [...BS.DBF.colors].sort()), ['blue', 'red']);
  assert.match(await page.textContent('#db-colbtn .ddb'), /Red, Blue|Blue, Red/);
});
