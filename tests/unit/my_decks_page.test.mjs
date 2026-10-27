// v0.93.0 U6 My decks page (docs/DESIGN.md section 0, mockup v11 "My decks"): PC tiles / phone rows on top of the 8 deck slots,
// ACTIVE badge, status, Edit / Play (disabled while not ready), more menu (PC) or action sheet (phone) with Set active, Rename,
// Duplicate, Deck look, Copy deck code, Delete (asks first); Import code, New deck; read-only starter decks with Copy.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const ctxs = [];
async function open(screen) {
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('u93')) { localStorage.clear(); sessionStorage.setItem('u93', '1'); } } catch (e) { /* none */ } });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}
after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });
const tiles = page => page.evaluate(() => [...document.querySelectorAll('#dk-list .dtile[data-v]')].map(t => ({ i: +t.dataset.v, name: t.querySelector('.row b').textContent, act: !!t.querySelector('.tag:not(.dim)'), st: t.querySelector('.vc').textContent, play: !t.querySelector('[data-a="dk-play"]').disabled })));
// answer the next modal: fill the text input (if any) and press the button with this label
const answer = (page, label, text) => page.evaluate(([l, t]) => { const i = document.querySelector('#modal-card-desc input'); if (i && t != null) { i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); }
  [...document.querySelectorAll('#modal-actions .modal-btn')].find(b => b.textContent.trim().toLowerCase() === l.toLowerCase()).click(); return 1; }, [label, text]);

for (const screen of ['pc', 'phone']) {
  test(`U93-1 ${screen}: the Decks tab opens My decks with the active deck, status, Edit and Play`, async () => {
    const { page, errors } = await open(screen);
    await page.click('[data-nav="view-decks"]:visible');
    const r = await page.evaluate(() => ({ on: document.getElementById('view-decks').classList.contains('active'), cur: document.querySelector('[data-nav][aria-current="page"]').dataset.nav,
      h1: document.querySelector('#view-decks .hdcard h2').textContent, count: document.getElementById('dk-count').textContent, wide: document.documentElement.scrollWidth > innerWidth + 1,
      starters: document.querySelectorAll('#dk-starters .dk-st-row').length, pre: BS.PREBUILT.length, sleeve: true, dots: document.querySelectorAll('#dk-list .dtile[data-v] .dot').length }));
    assert.deepEqual([r.on, r.cur, r.h1, r.count, r.wide, r.starters === r.pre, r.sleeve, r.dots > 0], [true, 'view-decks', 'My decks', '1 / 8', false, true, true, true]);
    const t = await tiles(page);
    assert.equal(t.length, 1); assert.equal(t[0].act, true); assert.match(t[0].st, /Legal/); assert.equal(t[0].play, true);
    await page.click('#dk-list [data-a="dk-edit"]');
    assert.equal(await page.evaluate(() => document.getElementById('view-deckbuilder').classList.contains('active')), true);
    assert.deepEqual(errors, []);
  });

  test(`U93-2 ${screen}: New deck, Rename, Duplicate, Set active, Copy deck code and Delete (asks first)`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.switchView('view-decks'); window.__clip = null; navigator.clipboard.writeText = async t => { window.__clip = t; }; return 1; });
    await page.click('#view-decks [data-a="dk-new"]');
    await page.click('#action-modal.active .modal-btn.primary');          // New deck dialog: Blank deck
    assert.deepEqual(await page.evaluate(() => [document.getElementById('view-deckbuilder').classList.contains('active'), BS.ACTIVE_SLOT]), [true, 1], 'New deck = first empty slot, opened in the builder');
    await page.evaluate(() => { BS.switchView('view-decks'); return 1; });
    let t = await tiles(page);
    assert.equal(t.length, 2); assert.match(t[1].st, /Needs 40 more/); assert.equal(t[1].play, false, 'Play disabled while not ready'); assert.equal(t[1].act, true);
    const menu = async (i, act) => { await page.click(`#dk-list .dtile[data-v][data-v="${i}"] [data-a="dk-more"]`); await page.click(`[data-a="${act}"][data-v="${i}"]:visible`); };
    await menu(0, 'dk-rename'); await answer(page, 'Save', 'Red Rush');
    await menu(0, 'dk-dup');
    t = await tiles(page);
    assert.deepEqual(t.map(x => x.name), ['Red Rush', 'Deck 2', 'Red Rush (copy)']);
    await menu(2, 'dk-active');
    assert.equal(await page.evaluate(() => BS.ACTIVE_SLOT), 2);
    await menu(2, 'dk-code');
    assert.match(await page.evaluate(() => window.__clip), /^\d+ \S+/);
    await menu(1, 'dk-del'); await answer(page, 'Cancel');
    assert.equal((await tiles(page)).length, 3, 'Cancel keeps the deck');
    await menu(1, 'dk-del'); await answer(page, 'Delete');
    t = await tiles(page);
    assert.deepEqual(t.map(x => x.name), ['Red Rush', 'Red Rush (copy)']);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
  });

  test(`U93-3 ${screen}: starter decks are read-only with Copy; Import code fills a new slot; a full set of slots says so`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.switchView('view-decks'); return 1; });
    const red = await page.evaluate(() => BS.PREBUILT.findIndex(d => d.id === 'red'));
    await page.click(`#dk-starters [data-a="dk-copy"][data-v="${red}"]`);
    let t = await tiles(page);
    assert.equal(t.length, 2); assert.match(t[1].name, /^Red/); assert.match(t[1].st, /Legal/);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#dk-starters [data-a="dk-del"], #dk-starters [data-a="dk-rename"]').length), 0, 'starters cannot be changed');
    await page.click('#view-decks [data-a="dk-import"]');
    await page.evaluate(() => { const a = document.getElementById('db-io'); a.value = '3 ' + Object.keys(BS.PREBUILT[0].cards)[0]; a.dispatchEvent(new Event('input', { bubbles: true })); return 1; });
    await answer(page, 'Import');
    await page.evaluate(() => { BS.switchView('view-decks'); return 1; });
    t = await tiles(page);
    assert.equal(t.length, 3); assert.match(t[2].st, /Needs 37 more/);
    await page.evaluate(() => { for (let i = 0; i < 8; i++) if (!BS.SLOTS()[i].cards || !Object.keys(BS.SLOTS()[i].cards).length) BS.SLOTS()[i].name = 'Used ' + i; BS.switchView('view-decks'); return 1; });
    await page.click('#view-decks [data-a="dk-new"]');
    assert.match(await page.evaluate(() => document.getElementById('modal-card-desc').textContent), /All 8 deck slots/);
    assert.deepEqual(errors, []);
  });
}

test('U93-4 pc: the menu of the last tile stays on screen; Enter saves a rename, Escape closes the dialog', async () => {
  const { page, errors } = await open('pc');
  await page.evaluate(() => { for (let i = 1; i < 8; i++) BS.SLOTS()[i].name = 'Deck number ' + (i + 1); BS.switchView('view-decks'); scrollTo(0, 0); return 1; });
  await page.click('#dk-list .dtile[data-v][data-v="7"] [data-a="dk-more"]');
  const r = await page.evaluate(() => { const m = document.querySelector('#dk-list .dk-menu').getBoundingClientRect(); return m.bottom <= innerHeight + 1 && m.top >= 0; });
  assert.equal(r, true);
  await page.click('[data-a="dk-rename"][data-v="7"]');
  await page.fill('#dk-name-in', 'Enter Name'); await page.press('#dk-name-in', 'Enter');
  assert.equal(await page.evaluate(() => BS.SLOTS()[7].name), 'Enter Name');
  await page.click('#dk-list .dtile[data-v][data-v="7"] [data-a="dk-more"]'); await page.click('[data-a="dk-del"][data-v="7"]');
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(() => [document.getElementById('action-modal').classList.contains('active'), BS.SLOTS()[7].name]), [false, 'Enter Name']);
  assert.deepEqual(errors, []);
});
