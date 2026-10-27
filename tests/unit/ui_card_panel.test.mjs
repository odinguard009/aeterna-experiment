// v0.122.0 U14b battle PC: the Card Panel (hover shows a card), Options from the match and BACK TO MATCH.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async (viewport) => {
  ctx = await (await getBrowser()).newContext({ viewport }); page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
};
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const deal = () => page.evaluate(() => { BS.testSetup(); const p = BS.G.p.player, ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit').slice(0, 2); p.hand = ids.map(i => BS.mkInst(i)); BS.render(); return ids; });

test('CP01 PC: the panel exists, starts with a hint, and a hover shows the hovered card', async () => {
  await open({ width: 1366, height: 768 });
  const ids = await deal();
  assert.match(await page.textContent('#card-panel'), /Hover Or Tap A Card/);
  await page.hover('.hand-area .tcg-card >> nth=1');
  const name = await page.evaluate(i => BS.CARDS[i].name, ids[1]);
  assert.ok((await page.textContent('#card-panel')).includes(name));
});
test('CP02 the panel keeps the last card after a re-render', async () => {
  await page.evaluate(() => BS.render());
  assert.doesNotMatch(await page.textContent('#card-panel'), /Point at a card/);
});
test('CP03 Options opens Settings with BACK TO MATCH; back returns to the same match', async () => {
  const before = await page.evaluate(() => BS.G.turnNo);
  await page.click('[data-a="options"]');
  assert.equal(await page.evaluate(() => document.querySelector('.app-view.active').id), 'view-settings');
  assert.equal(await page.isVisible('#set-back'), true);
  await page.click('#set-back');
  assert.equal(await page.evaluate(() => document.querySelector('.app-view.active').id), 'view-playmat');
  assert.equal(await page.evaluate(() => BS.G.turnNo), before);
});
test('CP04 phone: no panel and the layout is unchanged', async () => {
  await ctx.close(); await open({ width: 390, height: 844 });
  await deal();
  assert.equal(await page.locator('#card-panel').count(), 0);
});
