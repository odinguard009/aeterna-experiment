// v0.111.0 (card images): the Library browse grid — every card in a searchable, windowed grid (the player's card
// images show where they were added), filtered by set/type, and a tap zooms the card. Reuses the deck builder's card
// index and grid CSS, so it is UI-only: no engine or rules change.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, openGame } from './lib/game.mjs';

let ctx = null;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('CIMG-1 the Library browse grid shows every card, filters by search and zooms a card', async () => {
  const b = await getBrowser(); ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const g = await openGame();
  const page = g.page;
  await page.click('#app-nav [data-a="go-lib"]');
  await page.waitForFunction(() => document.querySelectorAll('#lib-grid .tile').length > 0);
  const initial = await page.evaluate(() => ({
    cards: document.querySelectorAll('#lib-grid .tile').length,
    sets: document.querySelectorAll('#lib-set option').length,
    types: [...document.querySelectorAll('#lib-types .chip')].map(o => o.textContent),
    count: document.getElementById('lib-count').textContent,
  }));
  assert.ok(initial.cards > 0, 'the grid renders a window of cards');
  assert.ok(initial.sets > 10, 'the set selector is populated');
  assert.deepEqual(initial.types, ['Spirit', 'Ultimate', 'Brave', 'Nexus', 'Magic', 'Contract', 'Mirage', 'Rebirth']);
  assert.match(initial.count, /\d[\d,]* card\(s\) shown/, 'the count note reports how many cards are shown');

  // search narrows the grid to the one card (its id is the unique search key)
  await page.click('#lib-complete');   // the page starts on "Complete Effects Only"; the card below may be a "!" card
  await page.fill('#lib-search', 'BS44-001');
  await page.waitForFunction(() => /1 card\(s\) shown/.test(document.getElementById('lib-count').textContent));
  await page.waitForFunction(() => document.querySelectorAll('#lib-grid .tile').length <= 2, null, { timeout: 5000 }).catch(() => {});      // v0.164: the count note updates before the grid has re-rendered
  const narrowed = await page.evaluate(() => document.querySelectorAll('#lib-grid .tile').length);
  assert.ok(narrowed <= 2, 'search narrowed the grid to the matching card');

  // the set filter also narrows, then clearing restores the full grid
  await page.fill('#lib-search', '');
  await page.selectOption('#lib-set', 'BS44');
  await page.waitForFunction((before) => {
    const t = document.getElementById('lib-count').textContent;
    return /card\(s\) shown/.test(t) && t !== before;
  }, initial.count);
  await page.selectOption('#lib-set', '');
  await page.waitForFunction(() => document.querySelectorAll('#lib-grid .tile').length > 0);

  // toolbar: a type chip narrows, "Clear" restores, the Complete-only chip widens to the "!" cards
  const all = await page.evaluate(() => document.getElementById('lib-count').textContent);
  await page.click('#lib-types [data-v="types:Magic"]');
  await page.waitForFunction(b => document.getElementById('lib-count').textContent !== b, all);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('#lib-grid .tile')].length > 0), 'Magic cards listed');
  await page.click('#lib-clear [data-a="lib-clear"]');
  await page.waitForFunction(b => document.getElementById('lib-count').textContent === b, all);

  // tapping a card opens the card page (v0.137.0) with the card face
  await page.click('#lib-grid .tile');
  await page.waitForFunction(() => document.getElementById('view-card').classList.contains('active'));
  const zoom = await page.evaluate(() => ({
    active: document.getElementById('view-card').classList.contains('active'),
    hasFace: !!document.querySelector('#cp-page .cface, #cp-page .ph'),
  }));
  assert.equal(zoom.active, true, 'the card page opened');
  assert.equal(zoom.hasFace, true, 'the page shows the card face');
  assert.deepEqual(g.errors, [], 'no page errors while browsing the Library grid');
});
