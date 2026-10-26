// v0.99.0 U8a (owner 2026-10-21; no animation or layout change): UI fixes from the U5-U7 player-view passes and the 2026-10-21 UI audit.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = { pc: { viewport: { width: 1280, height: 800 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const pages = {};
async function open(screen = 'pc') {
  if (pages[screen]) return pages[screen];
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return (pages[screen] = { page, errors, ctx });
}
after(async () => { for (const k of Object.keys(pages)) await pages[k].ctx.close(); await closeBrowser(); });

// Auto under automation is Off (navigator.webdriver), as before; on a real device with reduced motion Auto gives Reduced
test('U8A-1 an explicit "Animations: Full" wins over the device asking for reduced motion; Auto follows the device', async () => {
  const { page, errors } = await open();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const r = await page.evaluate(() => {
    const out = {}; const s = BS.SETTINGS.anim;
    BS.SETTINGS.anim = 'full'; out.full = BS.animMode();
    BS.SETTINGS.anim = 'off'; out.off = BS.animMode();
    BS.SETTINGS.anim = 'auto'; out.auto = BS.animMode();
    if (s === undefined) delete BS.SETTINGS.anim; else BS.SETTINGS.anim = s;
    out.opts = [...document.querySelectorAll('#set-anim option')].map(o => o.value);
    return out;
  });
  assert.deepEqual(r, { full: 'full', off: 'off', auto: 'off', opts: ['auto', 'full', 'reduced', 'off'] });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.deepEqual(errors, []);
});

test('U8A-2 choosing Auto removes the saved choice; choosing Full saves it', async () => {
  const { page } = await open();
  await page.click('#app-nav [data-a="go-settings"]');
  await page.selectOption('#set-anim', 'full');
  assert.equal(await page.evaluate(() => [BS.SETTINGS.anim, JSON.parse(localStorage.getItem(BS.SET_KEY)).anim].join()), 'full,full');
  await page.selectOption('#set-anim', 'auto');
  assert.equal(await page.evaluate(() => [String(BS.SETTINGS.anim), String(JSON.parse(localStorage.getItem(BS.SET_KEY)).anim)].join()), 'undefined,undefined');
});

test('U8A-3 deck builder Clear asks first; Cancel keeps the deck, Clear empties it and Undo brings it back', async () => {
  const { page, errors } = await open();
  const total = () => page.evaluate(() => Object.values(BS.PLAYER_DECK).reduce((t, x) => t + x, 0));
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); return 1; });
  const n = await total(); assert.ok(n > 0);
  await page.click('[data-a="db-clear"]:visible');
  await page.waitForFunction(() => /Clear the deck\?/.test((document.querySelector('#action-modal.active') || {}).textContent || ''));
  assert.equal(await total(), n, 'nothing happens before the answer');
  await page.locator('#modal-actions .modal-btn', { hasText: 'Cancel' }).click();
  await page.waitForTimeout(150); assert.equal(await total(), n);
  await page.click('[data-a="db-clear"]:visible');
  await page.locator('#modal-actions .modal-btn', { hasText: 'Clear deck' }).click();
  await page.waitForFunction(() => Object.keys(BS.PLAYER_DECK).length === 0);
  await page.evaluate(() => { BS.dbUndo(); return 1; });
  assert.equal(await total(), n);
  assert.deepEqual(errors, []);
});

test('U8A-4 the deck Rename field does not offer browser autofill', async () => {
  const { page } = await open();
  await page.evaluate(() => { BS.switchView('view-decks'); return 1; });
  await page.click('#dk-list [data-a="dk-more"] >> nth=0');
  await page.click('#dk-list [data-a="dk-rename"]');
  await page.waitForSelector('#dk-name-in');
  assert.equal(await page.getAttribute('#dk-name-in', 'autocomplete'), 'off');
  await page.locator('#modal-actions .modal-btn').last().click();
});

test('U8A-5 the deck builder count without filters = the Home count plus the Training cards, which it names', async () => {
  const { page } = await open();
  await page.evaluate(() => { BS.switchView('view-lobby'); return 1; });
  const home = await page.evaluate(() => +document.querySelector('#home-tiles [data-a="go-lib"] span span').textContent.match(/[\d,]+/)[0].replace(/,/g, ''));
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); return 1; });
  const db = await page.evaluate(() => document.getElementById('db-count').textContent);
  const tr = await page.evaluate(() => Object.keys(BS.CARDS).filter(id => id.startsWith('TRAIN-') && !BS.CARDS[id].token).length);
  assert.ok(tr > 0);
  assert.equal(db, `${home + tr} card(s) shown (${tr} Training)`);
});

test('U8A-6 phone: the open deck sheet has a way back to My decks, and leaving closes the sheet', async () => {
  const { page, errors } = await open('phone');
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); BS.dbSheet('deck'); return 1; });
  const b = page.locator('#view-deckbuilder.db-open-deck .db-sheet-back:visible');
  assert.equal(await b.count(), 1);
  await b.click();
  assert.deepEqual(await page.evaluate(() => [document.querySelector('.app-view.active').id, document.getElementById('view-deckbuilder').classList.contains('db-open-deck')]), ['view-decks', false]);
  assert.deepEqual(errors, []);
});

test('U8A-7 phone: a long deck name gets the row width (buttons below it) and wraps to at most two lines instead of being cut after a few letters', async () => {
  const { page } = await open('phone');
  const r = await page.evaluate(() => {
    const s = BS.SLOTS()[BS.ACTIVE_SLOT], old = s.name; s.name = 'Crimson Dragon Rush Deck'; BS.switchView('view-decks'); BS.renderDecks();
    const e = [...document.querySelectorAll('#dk-list .dtile .row b')].find(x => x.textContent === s.name);
    const fs = parseFloat(getComputedStyle(e).fontSize), lh = parseFloat(getComputedStyle(e).lineHeight) || fs * 1.3;
    const out = { lines: Math.round(e.getBoundingClientRect().height / lh), cut: e.scrollHeight > e.clientHeight + 1, title: e.title };
    s.name = old; BS.renderDecks(); return out;
  });
  assert.ok(r.lines <= 2 && !r.cut, JSON.stringify(r)); assert.equal(r.title, 'Crimson Dragon Rush Deck');
});

test('U8A-8 color-scheme follows the mode on the whole page (form controls, scrollbars)', async () => {
  const { page } = await open();
  const r = await page.evaluate(() => {
    const out = {}, prev = BS.THEME.mode;
    for (const m of ['dark', 'light']) { BS.setTheme('mode', m); out[m] = ['html', '#view-playmat', '#view-deckbuilder', '#view-settings'].map(s => getComputedStyle(document.querySelector(s)).colorScheme).join(); }
    BS.setTheme('mode', prev); return out;
  });
  assert.deepEqual(r, { dark: 'dark,dark,dark,dark', light: 'light,light,light,light' });
});

for (const screen of ['pc', 'phone']) {
  test(`U8A-9 ${screen}: the BLOCK? strip sits above the step band's log line instead of covering it`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.testSetup(); BS.switchView('view-playmat'); BS.render(); window.__pk = BS.webPick({ text: 'CPU attacks with Flame Hound (2000 BP). Choose a Spirit to block with.', uids: [], buttons: [{ label: 'No block', value: null }] }); return 1; });
    await page.waitForFunction(() => !document.querySelector('#ae-fx .ae-strip').hidden);
    const r = await page.evaluate(() => {
      const box = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
      const s = box(document.querySelector('#ae-fx .ae-strip')), lg = [...document.querySelectorAll('#view-playmat .control-log-row')].find(e => e.getBoundingClientRect().width > 0);
      const l = lg ? box(lg) : null;
      return { log: !!l, overlap: !!l && s[0] < l[2] && l[0] < s[2] && s[1] < l[3] && l[1] < s[3], onScreen: s[1] >= 0 };
    });
    await page.locator('#pick-btns .modal-btn').first().click();
    assert.deepEqual(r, { log: true, overlap: false, onScreen: true });
    assert.deepEqual(errors, []);
  });
}

for (const screen of ['pc', 'phone']) {
  test(`U8A-10 ${screen}: the Card Detail zoom icon covers no text of the card face (BP, cost, name)`, async () => {
    const { page, errors } = await open(screen);
    const id = await page.evaluate(() => Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && /^26R/.test(k) && !BS.CARDS[k].token));
    await page.evaluate(i => { const b = document.createElement('button'); b.dataset.a = 'dbinfo'; b.dataset.v = i; b.id = '__u8a'; document.body.append(b); b.click(); b.remove(); return 1; }, id);
    await page.waitForSelector('#action-modal.active .art-thumb .zoom-ic');
    const hits = await page.evaluate(() => {
      const ic = document.querySelector('#action-modal.active .art-thumb .zoom-ic').getBoundingClientRect();
      const out = [];                                  // glyph boxes (Range rects), not element boxes: text blocks span the face width
      for (const e of document.querySelectorAll('#action-modal.active .art-thumb .cface *')) for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const b of rg.getClientRects()) if (b.width && b.left < ic.right && ic.left < b.right && b.top < ic.bottom && ic.top < b.bottom) out.push(e.className);
      }
      return [...new Set(out)];
    });
    await page.locator('#action-modal.active #modal-actions .modal-btn').last().click();
    assert.deepEqual(hits, []);
    assert.deepEqual(errors, []);
  });
}

// WCAG contrast of two CSS colours (opaque rgb/rgba strings from getComputedStyle; rgba backgrounds are blended on white)
const CONTRAST = `(() => {
  const rgb = s => { const m = s.match(/[\\d.]+/g).map(Number); const a = m[3] == null ? 1 : m[3]; return m.slice(0, 3).map(v => v * a + 255 * (1 - a)); };
  const L = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  return (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
})()`;
test('U8A-11 light mode: primary buttons in every side colour and the Card Detail text reach 4.5:1', async () => {
  const { page } = await open();
  const r = await page.evaluate(src => {
    const cr = eval(src), prev = { c: BS.THEME.color, m: BS.THEME.mode }, out = { btn: {}, detail: {} };
    BS.setTheme('mode', 'light');
    const b = document.createElement('button'); b.className = 'modal-btn primary'; b.textContent = 'Rematch'; document.body.append(b);
    for (const c of BS.THEME_COLS) { BS.setTheme('color', c.id); const cs = getComputedStyle(b); out.btn[c.id] = +cr(cs.color, cs.backgroundColor).toFixed(2); }
    b.remove(); BS.setTheme('color', prev.c);
    const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && /^26R/.test(k));
    const d = document.createElement('div'); d.id = 'action-modal'; d.className = 'modal-overlay'; d.style.cssText = 'position:fixed;left:-2000px';
    d.innerHTML = '<div class="modal-box">' + BS.cardDetailHTML(BS.CARDS[id], true) + '</div>'; document.body.append(d);
    const bg = getComputedStyle(d.querySelector('.cd-info')).backgroundColor;
    out.detail.lv = +cr(getComputedStyle(d.querySelector('.cd-lv')).color, bg).toFixed(2);
    out.detail.name = +cr(getComputedStyle(d.querySelector('.cd-info b')).color, bg).toFixed(2);
    d.remove(); BS.setTheme('mode', prev.m);
    return out;
  }, CONTRAST);
  for (const [k, v] of Object.entries(r.btn)) assert.ok(v >= 4.5, `${k} button ${v}`);
  for (const [k, v] of Object.entries(r.detail)) assert.ok(v >= 4.5, `detail ${k} ${v}`);
});
