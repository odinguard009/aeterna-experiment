// 2026-11-02 owner report: Eternal toggle on My decks was empty; renamed decks fell back to "Deck N"; lore page jumped in size.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

after(closeBrowser);
const open = async (w = 1366, h = 768) => {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: w, height: h } }), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return { ctx, page };
};

test('DE1 the Eternal toggle on My decks lists Eternal starter decks; each is 40 cards, valid as Eternal and names a Key Spirit', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const B = window.BS, tick = () => new Promise(x => setTimeout(x, 60));
    B.switchView('view-decks'); await tick();
    document.querySelector('#dk-starters [data-a="dk-sfmt"][data-v="eternal"], [data-a="dk-sfmt"][data-v="eternal"]').click(); await tick();
    const eternal = B.PREBUILT.filter(d => d.kind === 'starter' && d.format === 'eternal');
    return { shown: document.querySelectorAll('#dk-starters .dk-st-row').length, n: eternal.length,
      bad: eternal.map(d => [d.id, Object.values(d.cards).reduce((a, b) => a + b, 0), B.validateDeck(d.cards, 'eternal', d.key).errors.join(' / ')]).filter(x => x[1] !== 40 || x[2]) };
  });
  assert.ok(r.n >= 30, 'Eternal starters exist: ' + r.n);
  assert.ok(r.shown >= 30, 'the Eternal toggle shows them: ' + r.shown);
  assert.deepEqual(r.bad, []);
  await ctx.close();
});

test('DE2 the CPU random pick stays on Standard decks (Eternal starters are not CPU opponents)', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(() => { const keep = BS.SETTINGS.cpuDeck, out = []; BS.SETTINGS.cpuDeck = 'random'; for (let s = 1; s <= 40; s++) { BS.seedRng(s); const d = BS.cpuDeckFor('standard'); out.push(BS.validateDeck(d, 'standard').ok); } BS.SETTINGS.cpuDeck = keep; return out; });
  assert.ok(r.every(Boolean));
  await ctx.close();
});

test('DE3 a renamed empty deck keeps its name and stays listed; an emptied name field never turns a name into "Deck N"', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const B = window.BS, tick = () => new Promise(x => setTimeout(x, 700)), S = B.SLOTS();
    B.switchSlot(2); B.switchView('view-deckbuilder'); await tick();
    const nm = document.getElementById('db-name');
    nm.value = 'Mine A'; nm.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    const kept = S[2].name, used = S[2].used;
    nm.value = ''; nm.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    return { kept, used, after: S[2].name };
  });
  assert.equal(r.kept, 'Mine A'); assert.equal(r.used, true); assert.equal(r.after, 'Mine A');
  await ctx.close();
});

test('DL1 Lore: the filter button sits beside the Cards/Lore tabs, and series vs saga keep the same page size (phone)', async () => {
  const { ctx, page } = await open(390, 844);
  await page.evaluate(() => BS.switchView('view-library'));
  const box = () => page.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.height)]; }; return { tabs: r('#lib-tabs'), min: r('#lib-min'), nav: r('#lib-lore-nav'), body: r('.lorebody'), hd: r('.lib-hd') }; });
  const c = await box();
  assert.equal(c.tabs[1], c.min[1], 'same row as the tabs');
  assert.ok(c.min[0] > c.tabs[0], 'to the right of the tabs');
  await page.evaluate(() => document.querySelector('#lib-tabs [data-v="lore"]').click()); await page.waitForTimeout(300);
  const get = async v => { await page.evaluate(v => document.querySelector(`#lib-lore-by [data-v="${v}"]`).click(), v); await page.waitForTimeout(250); return box(); };
  const s = await get('series'), g = await get('saga');
  assert.deepEqual(s.nav, g.nav, 'nav list'); assert.deepEqual(s.body, g.body, 'lore text'); assert.deepEqual(s.hd, g.hd, 'header');
  await ctx.close();
});
