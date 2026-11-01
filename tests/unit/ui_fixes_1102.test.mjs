// 2026-11-02: card-info fixes - Family row, glossary popups on keywords, wiki templates resolved in effect text,
// Constellation image names on the official mirror, deck cover persistence.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

after(closeBrowser);
async function open() {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(GAME_URL);
  await page.waitForFunction(() => !!window.BS && typeof cardDetailHTML === 'function');
  return { ctx, page };
}

test('UF-01 the card detail shows a Family row for a card with families', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(() => { const id = Object.keys(CARDS).find(x => (CARDS[x].families || []).length); return [CARDS[id].families[0], cardDetailHTML(CARDS[id])]; });
  assert.ok(r[1].includes('cd-fam') && r[1].includes(r[0]));
  await ctx.close();
});

test('UF-02 no raw wiki template survives in any effect text', async () => {
  const { ctx, page } = await open();
  const bad = await page.evaluate(() => Object.keys(CARDS).filter(x => /\{\{|\}\}|[⟦⟧]/.test(effectTextHTML(CARDS[x], false))).slice(0, 5));
  assert.deepEqual(bad, []);
  await ctx.close();
});

test('UF-03 Legacy and Rush carry a glossary note and render as clickable terms', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(() => [glossText('Legacy'), glossText('Rush'), effectTextHTML(CARDS['26RBS01-012'], false)]);
  assert.ok(r[0].length > 10 && r[1].length > 10);
  assert.ok(r[2].includes('data-a="gloss"'));
  await ctx.close();
});

test('UF-04 the image proxies map 10th-anniversary ids to the official file name', () => {
  for (const f of ['apps/server/src/card-images.mjs', 'functions/assets/card-images/[file].js'])
    assert.ok(readFileSync(join(ROOT, f), 'utf8').includes("-10THX/, '-X'"), f);
});

test('UF-05 a chosen deck cover survives loadSlots', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(() => {
    const ids = Object.keys(CARDS).filter(x => !CARDS[x].token).slice(0, 4), pick = ids[3];
    SLOTS[0].cards = Object.fromEntries(ids.map(x => [x, 1])); SLOTS[0].cover = pick;
    PLAYER_DECK = Object.assign({}, SLOTS[0].cards); ACTIVE_SLOT = 0; saveDeck(); loadSlots();
    switchView('view-decks'); renderDecks();
    return [SLOTS[0].cover, pick, document.querySelector('#view-decks').innerHTML.includes(pick)];
  });
  assert.equal(r[0], r[1]);
  await ctx.close();
});
