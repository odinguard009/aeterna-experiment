// v0.129.0 U14f2: long-press for card info (touch, setting), the fly-to-deck cue (Full only).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const open = async () => {
  ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); return 1; });
};
const press = () => page.evaluate(() => {
  const c = document.querySelector('#db-card-list [data-a="dbcard"]');
  c.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })); return c.dataset.v;
});

test('LP1 holding a grid card on touch opens its info and the following tap adds nothing', async () => {
  await open();
  const id = await press();
  const before = await page.evaluate(i => BS.PLAYER_DECK[i] || 0, id);
  await page.waitForSelector('#action-modal.active', { timeout: 3000 });
  await page.evaluate(() => BS.closeModal(null));
  await page.evaluate(i => { BS.dbTap(i); return 1; }, id);
  assert.equal(await page.evaluate(i => BS.PLAYER_DECK[i] || 0, id), before);
});
test('LP2 with the setting Off a hold does nothing', async () => {
  await page.evaluate(() => { BS.SETTINGS.longpress = 'off'; return 1; });
  await press(); await page.waitForTimeout(800);
  assert.equal(await page.locator('#action-modal.active').count(), 0);
  await page.evaluate(() => { delete BS.SETTINGS.longpress; return 1; });
});
test('FL1 adding a card flies a small card to the deck in Full, nothing in Off', async () => {
  const run = m => page.evaluate(m => {
    BS.SETTINGS.anim = m; document.querySelectorAll('#ae-fx .ae-a-flyc').forEach(e => e.remove());
    const id = document.querySelector('#db-card-list [data-a="dbcard"]').dataset.v; BS.dbChange(id, 1);
    return document.querySelectorAll('#ae-fx .ae-a-flyc').length;
  }, m);
  assert.equal(await run('full'), 1);
  assert.equal(await run('off'), 0);
});
test('ST1 Settings has the Long-press row and it is saved', async () => {
  await page.evaluate(() => BS.switchView('view-settings'));
  await page.click('#set-menu [data-v="access"]');
  await page.selectOption('#set-lp', 'off');
  assert.equal(await page.evaluate(() => BS.SETTINGS.longpress), 'off');
  await page.selectOption('#set-lp', 'on');
  assert.equal(await page.evaluate(() => BS.SETTINGS.longpress || null), null);
});
