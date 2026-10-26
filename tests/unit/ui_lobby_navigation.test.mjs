// v0.65.0 U2 lobby navigation (docs/DESIGN.md section 0, mockup v11): PC top bar, phone header + bottom tab bar,
// Home hero, colour picker + Dark/Light in the header, nav hidden on the battle screen and in the deck builder.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const ctxs = [];
const TABSEL = screen => (screen === 'phone' ? '#mk-tabbar' : '#app-tabs');   // v0.137.0: the phone tabs are the mockup's .tabbar
async function open(screen) {
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}
/*AFTER*/after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });

for (const screen of ['pc', 'phone']) {
  test(`U65-1 ${screen}: Home shows the nav, the motto and the main actions; tabs open every page`, async () => {
    const { page, errors } = await open(screen);
    const r = await page.evaluate(() => {
      const vis = s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const T = innerWidth <= 700 ? '#mk-tabbar' : '#app-tabs';
      const tabs = [...document.querySelectorAll(T + ' [data-nav]')].map(b => b.dataset.nav);
      const cur = document.querySelector(T + ' [aria-current="page"]');
      const tiles = document.querySelectorAll('#home-tiles .tile2').length;
      return { nav: vis(innerWidth <= 700 ? '.phonebar' : '#app-nav'), tabs, cur: cur && cur.dataset.nav, tiles, play: vis('#home-tiles [data-a="go-play"]'), build: vis('#home-cont [data-a="go-deck"]'),
        ver: document.getElementById('home-ver').textContent, over: document.documentElement.scrollWidth > innerWidth + 1,
        tabBottom: document.querySelector(T).getBoundingClientRect().bottom, h: innerHeight };
    });
    assert.ok(r.nav, 'nav visible');
    assert.deepEqual(r.tabs, ['view-lobby', 'view-play', 'view-decks', 'view-library', 'view-howto']);   // v0.93.0 U6: Decks opens My decks
    assert.equal(r.cur, 'view-lobby');
    assert.equal(r.tiles, 4);
    assert.ok(r.play && r.build, 'Match vs CPU tile + Edit deck visible');
    assert.equal(r.ver, 'Aeterna v' + await page.evaluate(() => BS.VERSION));
    assert.ok(!r.over, 'no horizontal overflow');
    if (screen === 'phone') assert.ok(Math.abs(r.tabBottom - r.h) <= 1, 'phone tab bar sits at the bottom');
    else assert.ok(r.tabBottom <= 64, 'PC tabs sit in the top bar');
    for (const [nav, view] of [['view-play', 'view-play'], ['view-decks', 'view-decks'], ['view-library', 'view-library'], ['view-howto', 'view-howto'], ['view-lobby', 'view-lobby']]) {
      await page.click(`${TABSEL(screen)} [data-nav="${nav}"]`);
      const st = await page.evaluate(([v, t]) => [document.getElementById(v).classList.contains('active'), (document.querySelector(`${t} [aria-current="page"]`) || {}).dataset?.nav, document.body.classList.contains('has-nav')], [view, TABSEL(screen)]);
      assert.deepEqual(st, [true, nav, true], nav);
    }
    await page.click(`${TABSEL(screen)} [data-nav="view-decks"]`); await page.click('#view-decks [data-a="dk-edit"]');   // v0.93.0: the builder opens from My decks
    assert.equal(await page.evaluate(() => [document.getElementById('view-deckbuilder').classList.contains('active'), getComputedStyle(document.getElementById('app-nav')).display].join()), screen === 'pc' ? 'true,flex' : 'true,none', 'deck builder follows the mockup: PC keeps the nav, phone uses the bottom bar (v0.137.0)');
    await page.evaluate(() => BS.switchView('view-lobby'));
    assert.deepEqual(errors, []);
  });

  test(`U65-2 ${screen}: colour picker and Dark/Light in the header change and save the theme; Escape closes`, async () => {
    const { page, errors } = await open(screen);
    await page.locator('[data-a="theme-pop"]:visible').first().click();
    assert.equal(await page.evaluate(() => [document.getElementById('theme-pop').hidden, document.getElementById('theme-btn').getAttribute('aria-expanded'), document.querySelectorAll('#theme-grid .pcol').length].join()), 'false,true,9');
    await page.click('#theme-grid [data-v="purple"]');
    if (screen === 'pc') await page.click('#app-nav .seg.mini [data-a="theme-mode"][data-v="light"]'); else await page.evaluate(() => document.querySelector('#app-nav .seg.mini [data-v="light"]').click());   // v0.137.0: the mockup phone bar has no Dark/Light toggle (Settings has it)
    const r = await page.evaluate(() => [BS.THEME.color, BS.THEME.mode, document.documentElement.dataset.mode, JSON.parse(localStorage.getItem('aeterna.theme.v1')).color,
      document.querySelector('#theme-grid [data-v="purple"]').getAttribute('aria-pressed'), document.querySelector('#app-nav .seg.mini [data-a="theme-mode"][data-v="light"]').getAttribute('aria-pressed')]);
    assert.deepEqual(r, ['purple', 'light', 'light', 'purple', 'true', 'true']);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.getElementById('theme-pop').hidden), true);
    await page.locator('[data-a="theme-pop"]:visible').first().click(); await page.evaluate(() => document.getElementById('home-cont').click());
    assert.equal(await page.evaluate(() => document.getElementById('theme-pop').hidden), true, 'outside click closes');
    if (screen === 'pc') await page.click('#app-nav .seg.mini [data-a="theme-mode"][data-v="dark"]'); else await page.evaluate(() => document.querySelector('#app-nav .seg.mini [data-v="dark"]').click());
    assert.equal(await page.evaluate(() => BS.THEME.mode), 'dark');
    assert.deepEqual(errors, []);
  });
}

test('U65-3 pc: history button (the mockup nav has no sound button; Settings keeps the toggle), settings gear marked, nav hidden in a match', async () => {
  const { page, errors } = await open('pc');
  await page.click('#app-nav .ibtn[data-a="go-history"]');
  assert.deepEqual(await page.evaluate(() => [document.getElementById('view-settings').classList.contains('active'), document.querySelector('#app-nav .ibtn[data-a="go-settings"]').getAttribute('aria-current')]), [true, 'page']);
  await page.evaluate(() => { BS.SETTINGS.speed = 'instant'; BS.testSetup(); BS.switchView('view-playmat'); });
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('app-nav')).display), 'none', 'battle screen has no nav');
  assert.deepEqual(errors, []);
});

// one shared page per screen for the small checks below
const shared = {};
const sp = async screen => (shared[screen] ||= await open(screen));
const TABS = [['view-lobby', 'Home', 'Home'], ['view-play', 'Play', 'Play'], ['view-decks', 'Decks', 'Decks'], ['view-library', 'Library', 'Library'], ['view-howto', 'Learn', 'Learn']];
for (const screen of ['pc', 'phone']) {
  for (const [view, pcLabel, phLabel] of TABS) {
    test(`U65-T ${screen}: the ${view} tab opens its page and shows "${screen === 'pc' ? pcLabel : phLabel}"`, async () => {
      const { page, errors } = await sp(screen);
      await page.evaluate(() => BS.switchView('view-lobby'));
      const tab = page.locator(`${TABSEL(screen)} [data-nav="${view}"]`);
      assert.equal((await tab.innerText()).trim().toLowerCase(), (screen === 'pc' ? pcLabel : phLabel).toLowerCase());
      await tab.click();
      assert.equal(await page.evaluate(v => document.getElementById(v).classList.contains('active'), view), true);
      await page.evaluate(() => BS.switchView('view-lobby'));
      assert.deepEqual(errors, []);
    });
  }
  test(`U65-4 ${screen}: the Learn tile and the profile chip open Learn and Settings`, async () => {
    const { page, errors } = await sp(screen);
    await page.evaluate(() => BS.switchView('view-lobby'));
    await page.click('#home-tiles [data-a="go-howto"]');   // v0.137.0: the mockup Home has the Learn tile; the rules-coverage link has no place there yet (returns with the Learn page)
    assert.equal(await page.evaluate(() => document.getElementById('view-howto').classList.contains('active')), true);
    await page.evaluate(() => BS.switchView('view-lobby'));
    await page.locator(screen === 'pc' ? '#app-nav .pchip' : '.phonebar [data-a="go-settings"]').first().click();
    assert.equal(await page.evaluate(() => document.getElementById('view-settings').classList.contains('active')), true);
    await page.evaluate(() => BS.switchView('view-lobby'));
    assert.deepEqual(errors, []);
  });
  test(`U65-5 ${screen}: Home deck line and tile follow the active deck slot`, async () => {
    const { page } = await sp(screen);
    const r = await page.evaluate(() => { BS.switchSlot(2); BS.switchView('view-lobby'); const a = [document.getElementById('home-cont').textContent, document.querySelector('#home-tiles [data-a="go-play"]').textContent, BS.SLOTS()[2].name];
      BS.switchSlot(0); BS.switchView('view-lobby'); return a; });
    assert.ok(r[0].includes(r[2]) && r[1].includes(r[2]), JSON.stringify(r));
  });
  test(`U65-6 ${screen}: header and tab buttons are at least 32px (44px phone tabs and diamond buttons)`, async () => {
    const { page } = await sp(screen);
    const r = await page.evaluate(() => [...document.querySelectorAll('#app-nav button')].filter(b => b.offsetParent && !b.closest('#theme-pop')).map(b => { const x = b.getBoundingClientRect(); return [b.dataset.a, Math.round(x.width), Math.round(x.height), b.classList.contains('nv')]; }));
    for (const [a, w, h, big] of r) { assert.ok(h >= 32 && w >= 32, `${a} ${w}x${h}`); if (screen === 'phone' && big) assert.ok(h >= 44, `${a} ${h}`); }
  });
  test(`U65-7 ${screen}: light mode switches the Home ground and text tokens`, async () => {
    const { page } = await sp(screen);
    const r = await page.evaluate(() => { const g = () => [getComputedStyle(document.querySelector('#view-lobby h1')).color, getComputedStyle(document.querySelector('#app-nav')).backgroundColor];
      BS.setTheme('mode', 'dark'); const d = g(); BS.setTheme('mode', 'light'); const l = g(); BS.setTheme('mode', 'dark'); return [d, l]; });
    assert.notDeepEqual(r[0], r[1]);
  });
}
test('U65-8: the Library tile card count matches the shipped pack (training cards not counted)', async () => {
  const { page } = await sp('pc');
  const r = await page.evaluate(() => [parseInt(document.querySelector('#home-tiles [data-a="go-lib"] span span').textContent.replace(/,/g, ''), 10), BS.PACK_IDS.size ?? BS.PACK_IDS.length]);
  assert.equal(r[0], r[1]);
});
test('U65-9: every header button has an accessible name', async () => {
  const { page } = await sp('pc');
  const bad = await page.evaluate(() => [...document.querySelectorAll('#app-nav button')].filter(b => !(b.getAttribute('aria-label') || b.textContent.trim())).length);
  assert.equal(bad, 0);
});
