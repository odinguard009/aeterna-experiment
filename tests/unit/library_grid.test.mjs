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
  await page.waitForFunction(() => document.querySelectorAll('#lib-grid .tcg-card').length > 0);
  const initial = await page.evaluate(() => ({
    cards: document.querySelectorAll('#lib-grid .tcg-card').length,
    sets: document.querySelectorAll('#lib-set option').length,
    types: [...document.querySelectorAll('#lib-type option')].map(o => o.value),
    count: document.getElementById('lib-count').textContent,
  }));
  assert.ok(initial.cards > 0, 'the grid renders a window of cards');
  assert.ok(initial.sets > 10, 'the set selector is populated');
  assert.deepEqual(initial.types, ['', 'Spirit', 'Nexus', 'Magic', 'Brave', 'Contract']);
  assert.match(initial.count, /\d[\d,]* card\(s\) shown/, 'the count note reports how many cards are shown');

  // search narrows the grid to the one card (its id is the unique search key)
  await page.fill('#lib-search', 'BS44-001');
  await page.waitForFunction(() => /1 card\(s\) shown/.test(document.getElementById('lib-count').textContent));
  const narrowed = await page.evaluate(() => document.querySelectorAll('#lib-grid .tcg-card').length);
  assert.ok(narrowed <= 2, 'search narrowed the grid to the matching card');

  // the set filter also narrows, then clearing restores the full grid
  await page.fill('#lib-search', '');
  await page.selectOption('#lib-set', 'BS44');
  await page.waitForFunction((before) => {
    const t = document.getElementById('lib-count').textContent;
    return /card\(s\) shown/.test(t) && t !== before;
  }, initial.count);
  await page.selectOption('#lib-set', '');
  await page.waitForFunction(() => document.querySelectorAll('#lib-grid .tcg-card').length > 0);

  // tapping a card opens the zoom overlay with the card face
  await page.click('#lib-grid .tcg-card');
  await page.waitForFunction(() => document.getElementById('zoom-overlay').classList.contains('active'));
  const zoom = await page.evaluate(() => ({
    active: document.getElementById('zoom-overlay').classList.contains('active'),
    hasFace: !!document.querySelector('#zoom-overlay .cface'),
  }));
  assert.equal(zoom.active, true, 'the zoom overlay opened');
  assert.equal(zoom.hasFace, true, 'the zoom shows the card face');
  assert.deepEqual(g.errors, [], 'no page errors while browsing the Library grid');
});
