// v0.190.0 (R9): the Sort dropdown of the Deck Builder and the Library (keys, direction inside the menu, empty values last).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const pages = {};
async function open(screen) {
  if (pages[screen]) return pages[screen];
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { localStorage.clear(); BS.switchView('view-deckbuilder'); BS.dbResetFilters(); });
  return (pages[screen] = { page, ctx });
}
after(async () => { for (const k of Object.keys(pages)) await pages[k].ctx.close(); await closeBrowser(); });
const SHOTS = join(ROOT, 'build', 'shots'); mkdirSync(SHOTS, { recursive: true });

test('R9-01 comparator: every key orders the cards, desc reverses, empty values stay last', async () => {
  const { page } = await open('pc');
  const r = await page.evaluate(() => {
    const ids = Object.keys(BS.CARDS).filter(id => !BS.CARDS[id].token).map(id => ({ id })), out = {};
    const val = { cost: c => c.cost, bp: c => c.levels && c.levels[0] ? c.levels[0].bp : null, cores: c => c.levels && c.levels[0] ? c.levels[0].cores : null, rarity: c => c.rcode || null, block: c => (c.bicon || [])[0] || null, family: c => (c.families || [])[0] || null };
    for (const k of ['cost', 'bp', 'cores', 'red', 'rarity', 'block', 'family', 'complete', 'colour', 'type', 'name', 'set']) for (const d of ['asc', 'desc']) {
      const l = ids.slice().sort(BS.dbSortCmp(k, d)).map(e => e.id), f = val[k];
      let ok = true;
      if (f) {
        const v = l.map(id => f(BS.CARDS[id])), firstNull = v.findIndex(x => x == null);
        ok = firstNull < 0 || v.slice(firstNull).every(x => x == null);           // empty values only at the end
        const real = v.filter(x => x != null);
        if (typeof real[0] === 'number') ok = ok && real.every((x, i) => !i || (d === 'asc' ? real[i - 1] <= x : real[i - 1] >= x));
      }
      out[k + ':' + d] = { ok, n: l.length };
    }
    const bpDesc = ids.slice().sort(BS.dbSortCmp('bp', 'desc')).map(e => BS.CARDS[e.id]), top = bpDesc[0].levels[0].bp;
    return { out, top, max: Math.max(...ids.map(e => (BS.CARDS[e.id].levels || [{ bp: 0 }])[0].bp || 0)), none: BS.dbSortCmp('default', 'asc') };
  });
  for (const [k, v] of Object.entries(r.out)) assert.ok(v.ok && v.n > 1000, k);
  assert.equal(r.top, r.max);
  assert.equal(r.none, null);
});

for (const screen of ['pc', 'phone']) {
  test(`R9-02-${screen} Deck Builder: the Sort button replaces the select, the menu picks key and direction, Clear resets`, async () => {
    const { page } = await open(screen);
    const r = await page.evaluate(() => {
      BS.switchView('view-deckbuilder'); BS.dbResetFilters();
      const click = sel => document.querySelector(sel).click(), shown = () => [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(e => e.dataset.v);
      const o = { select: !!document.getElementById('db-sort'), btn: document.querySelector('#db-sortbtn [data-v="sort"]').textContent };
      click('#db-sortbtn [data-v="sort"]');
      o.menu = [...document.querySelectorAll('#db-tbar .ddmenu .ddi')].map(b => b.textContent.replace('✓', '').trim());
      click('#db-tbar .ddmenu [data-a="db-ddpick"][data-v="cost"]');
      const c1 = shown().slice(0, 60).map(id => BS.CARDS[id].cost); o.asc = c1.every((x, i) => !i || c1[i - 1] <= x);
      click('#db-tbar .ddmenu [data-a="db-ddpick"][data-v="desc"]');
      const c2 = shown().slice(0, 60).map(id => BS.CARDS[id].cost); o.desc = c2.every((x, i) => !i || c2[i - 1] >= x) && c2[0] > c2[c2.length - 1];
      o.btn2 = document.querySelector('#db-sortbtn [data-v="sort"]').textContent; o.on = document.querySelector('#db-sortbtn [data-v="sort"]').classList.contains('on');
      o.menuOpen = !!document.querySelector('#db-tbar .ddmenu');
      click('#db-tbar .ddmenu [data-a="db-ddclear"]');
      o.reset = BS.DBF.sort === 'default' && BS.DBF.sortDir === 'asc';
      o.noScroll = document.documentElement.scrollWidth <= innerWidth;
      return o;
    });
    assert.equal(r.select, false);
    assert.match(r.btn, /Sort: Default/);
    assert.deepEqual(r.menu.slice(0, 5), ['Ascending', 'Descending', 'Default', 'Set', 'Name']);
    assert.ok(r.menu.includes('BP (Lv1)') && r.menu.includes('Complete first') && r.menu.includes('Reduction') && r.menu.includes('Rarity') && r.menu.includes('Block'));
    assert.ok(r.asc && r.desc && r.menuOpen && r.on && r.reset && r.noScroll, JSON.stringify(r));
    assert.match(r.btn2, /Sort: Cost ↓/);
    await page.screenshot({ path: join(SHOTS, `r9-sort-${screen}.png`) });
  });

  test(`R9-03-${screen} Library: the Sort button sorts the grid, no page scroll sideways`, async () => {
    const { page } = await open(screen);
    const r = await page.evaluate(() => {
      BS.switchView('view-library');
      const click = sel => document.querySelector(sel).click();
      const o = { select: !!document.getElementById('lib-sort'), btn: document.querySelector('#lib-sortbtn [data-v="sort"]').textContent };
      click('#lib-sortbtn [data-v="sort"]'); click('#lib-tbar .ddmenu [data-a="lib-ddpick"][data-v="name"]'); click('#lib-tbar .ddmenu [data-a="lib-ddpick"][data-v="desc"]');
      o.btn2 = document.querySelector('#lib-sortbtn [data-v="sort"]').textContent;
      const names = [...document.querySelectorAll('#lib-grid [data-v]')].slice(0, 40).map(e => BS.CARDS[e.dataset.v] && BS.CARDS[e.dataset.v].name).filter(Boolean), coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
      o.desc = names.length > 5 && names.every((n, i) => !i || coll.compare(names[i - 1], n) >= 0);
      o.noScroll = document.documentElement.scrollWidth <= innerWidth;
      return o;
    });
    assert.equal(r.select, false);
    assert.match(r.btn, /Sort: Set/);
    assert.match(r.btn2, /Sort: Name ↓/);
    assert.ok(r.desc && r.noScroll);
    await page.screenshot({ path: join(SHOTS, `r9-sort-lib-${screen}.png`) });
  });
}
