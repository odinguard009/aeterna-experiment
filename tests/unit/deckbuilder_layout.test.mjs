// v0.53.0 deck builder redesign (docs/ai/roadmap-archive.md (Archived plans)): PC three columns (filter rail, grid, deck panel),
// phone (< 900 px) filter sheet + deck bottom bar / sheet + menu. Tap = +1, (i) or right-click = detail, undo, import/export.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const pages = {};
async function open(screen) {
  if (pages[screen]) return pages[screen];
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { localStorage.clear(); BS.switchView('view-deckbuilder'); });
  pages[screen] = { page, errors, ctx }; return pages[screen];
}
after(async () => { for (const k of Object.keys(pages)) await pages[k].ctx.close(); await closeBrowser(); });
const ev = async (screen, fn, arg) => (await open(screen)).page.evaluate(fn, arg);
const SHOTS = join(ROOT, 'build', 'shots'); mkdirSync(SHOTS, { recursive: true });
const count = () => parseInt(document.getElementById('db-count').textContent, 10);
const visible = sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight; };

for (const screen of ['pc', 'phone']) {
  test(`D01-${screen} layout: PC shows rail + grid + deck panel; phone shows search, Filters button and the deck bar`, async () => {
    const r = await ev(screen, v => { const vis = new Function('return ' + v)(); return ['#db-rail', '#db-card-list', '#db-deck', '#db-search', '#db-filter-btn', '#db-deckbar', '.db-menu-btn'].map(vis); }, visible.toString());
    assert.deepEqual(r, screen === 'pc' ? [true, true, true, true, true, false, false] : [false, true, false, true, true, true, true]);
    await (await open(screen)).page.screenshot({ path: join(SHOTS, `v053-deckbuilder-${screen}.png`) });
  });
  test(`D02-${screen} tapping a card adds one copy; the deck panel row's − removes it; Undo restores`, async () => {
    const r = await ev(screen, () => {
      BS.dbChange('BS74-072', -3); for (let i = 0; i < 3; i++) BS.dbChange('BS74-072', -1);
      const before = BS.PLAYER_DECK['BS74-072'] || 0;
      document.querySelector('#db-search').value = 'BS74-072'; BS.renderDeckBuilder();
      document.querySelector('#db-card-list [data-a="dbcard"][data-v="BS74-072"]').click();
      const added = BS.PLAYER_DECK['BS74-072'] || 0, pulse = !!document.querySelector('#db-card-list .db-pulse');
      document.querySelector('[data-a="db-row"][data-v="BS74-072:-1"]').click();
      const removed = BS.PLAYER_DECK['BS74-072'] || 0;
      document.querySelector('[data-a="db-undo"]').click();
      const undone = BS.PLAYER_DECK['BS74-072'] || 0;
      document.querySelector('#db-search').value = ''; BS.renderDeckBuilder();
      return { before, added, pulse, removed, undone };
    });
    assert.deepEqual(r, { before: 0, added: 1, pulse: true, removed: 0, undone: 1 });
  });
  test(`D03-${screen} a 4th copy is refused (the detail opens instead); the (i) button and right-click open the detail`, async () => {
    const r = await ev(screen, async () => {
      while ((BS.PLAYER_DECK['BS74-072'] || 0) < 3) BS.dbChange('BS74-072', 1);
      document.querySelector('#db-search').value = 'BS74-072'; BS.renderDeckBuilder();
      const card = () => document.querySelector('#db-card-list [data-a="dbcard"][data-v="BS74-072"]');
      card().click(); await new Promise(r => setTimeout(r, 30));
      const four = BS.PLAYER_DECK['BS74-072'], m1 = document.getElementById('action-modal').classList.contains('active'); BS.closeModal();
      card().querySelector('[data-a="dbinfo"]').click(); await new Promise(r => setTimeout(r, 30));
      const m2 = document.getElementById('action-modal').classList.contains('active'), same = BS.PLAYER_DECK['BS74-072']; BS.closeModal();
      card().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 30));
      const m3 = document.getElementById('action-modal').classList.contains('active'); BS.closeModal();
      document.querySelector('#db-search').value = ''; BS.renderDeckBuilder();
      return { four, m1, m2, same, m3 };
    });
    assert.deepEqual(r, { four: 3, m1: true, m2: true, same: 3, m3: true });
  });
  test(`D04-${screen} colour and cost chips are multi-select; the Filters button counts active filters; reset clears`, async () => {
    const r = await ev(screen, () => {
      const chip = v => document.querySelector(`[data-a="db-chip"][data-v="${v}"]`).click();
      chip('colors:red'); const red = parseInt(document.getElementById('db-count').textContent, 10);
      chip('colors:blue'); const both = parseInt(document.getElementById('db-count').textContent, 10);
      chip('costs:3'); const ids = [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(e => BS.CARDS[e.dataset.v]);
      const okAll = ids.every(c => c.cost === 3 && BS.cardColors(c).some(k => k === 'red' || k === 'blue'));
      const btn = document.getElementById('db-filter-btn').textContent, on = document.querySelectorAll('.db-chip.on').length;
      document.querySelector('[data-a="db-freset"]').click();
      return { more: both > red, okAll, btn, on, after: document.querySelectorAll('.db-chip.on').length, reset: document.getElementById('db-filter-btn').textContent };
    });
    assert.deepEqual(r, { more: true, okAll: true, btn: 'FILTERS 3', on: 3, after: 0, reset: 'FILTERS' });   // v0.94.0 U7 label
  });
  test(`D05-${screen} set, family, legal-in-format and type filters; sort by cost and name`, async () => {
    const r = await ev(screen, () => {
      const ch = (id, v) => { const e = document.getElementById(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
      const shown = () => [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(e => e.dataset.v);
      ch('db-set', 'BS74'); const set = shown().every(id => id.startsWith('BS74-')) && shown().length > 0;
      ch('db-set', ''); BS.DBF.family = 'Dragon'; BS.renderDeckBuilder(); const fam = shown().every(id => (BS.CARDS[id].families || []).join(' ').toLowerCase().includes('dragon')) && shown().length > 0;
      BS.DBF.family = ''; ch('db-legal', true); const legal = shown().every(id => !BS.legalityOf(id, BS.FORMAT)); ch('db-legal', false);
      document.querySelector('[data-a="db-chip"][data-v="types:Magic"]').click(); const mag = shown().every(id => BS.CARDS[id].type === 'Magic' && !BS.CARDS[id].contract);
      document.querySelector('[data-a="db-chip"][data-v="types:Magic"]').click();
      ch('db-sort', 'cost'); const costs = shown().map(id => BS.CARDS[id].cost); const byCost = costs.every((c, i) => !i || costs[i - 1] <= c);
      ch('db-sort', 'name'); const names = shown().map(id => BS.CARDS[id].name); const coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }); const byName = names.every((n, i) => !i || coll.compare(names[i - 1], n) <= 0);      // v0.79.0: same collation as the deck builder (names starting with punctuation)
      ch('db-sort', 'default');
      return { set, fam, legal, mag, byCost, byName };
    });
    assert.deepEqual(r, { set: true, fam: true, legal: true, mag: true, byCost: true, byName: true });
  });
  test(`D06-${screen} the deck panel shows counter, legality, groups by type, cost curve, colours and types`, async () => {
    const r = await ev(screen, () => {
      BS.loadPrebuilt('mitra'); BS.renderDeckBuilder(); BS.dbSheet('deck');
      const txt = id => document.getElementById(id).textContent;
      const groups = [...document.querySelectorAll('.db-grp-h')].map(e => e.firstChild.textContent.trim());
      const bars = document.querySelectorAll('.db-curve .db-bar').length, sum = [...document.querySelectorAll('.db-bar-n')].reduce((s, e) => s + (Number(e.textContent) || 0), 0);
      const vis = document.getElementById('db-deck').getBoundingClientRect().width > 0 && getComputedStyle(document.getElementById('db-deck')).visibility !== 'hidden';
      BS.dbSheet('');
      return { counter: txt('db-counter'), status: document.getElementById('db-status').className, groups, bars, sum, vis, stats: /Colours/.test(txt('db-dk-stats')) && /Types/.test(txt('db-dk-stats')) };
    });
    assert.equal(r.counter, '40 / 40+');
    assert.equal(r.status, 'db-status ok');
    assert.deepEqual(r.groups, ['Spirit', 'Nexus', 'Contract']);
    assert.deepEqual([r.bars, r.sum, r.vis, r.stats], [11, 40, true, true]);
  });
  test(`D07-${screen} import replaces the deck (Undo brings it back); export shows the deck list`, async () => {
    const r = await ev(screen, async () => {
      const total = () => Object.values(BS.PLAYER_DECK).reduce((s, n) => s + n, 0), was = total();
      document.querySelector('[data-a="db-import"]').click(); await new Promise(r => setTimeout(r, 20));
      const ta = document.getElementById('db-io'); ta.value = '3 BS74-072\n2x Nope Card'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#action-modal [data-mi="0"]').click(); await new Promise(r => setTimeout(r, 30));
      const imported = total(), warn = document.getElementById('action-modal').classList.contains('active'); BS.closeModal();
      BS.dbUndo(); const back = total();
      document.querySelector('[data-a="db-export"]').click(); await new Promise(r => setTimeout(r, 20));
      const out = document.getElementById('db-io').value; BS.closeModal();
      return { was, imported, warn, back, has: out.includes('BS74-072') };
    });
    assert.deepEqual(r, { was: 40, imported: 3, warn: true, back: 40, has: true });
  });
  test(`D08-${screen} no horizontal scroll; no errors`, async () => {
    const r = await ev(screen, () => ({ sw: document.documentElement.scrollWidth, w: innerWidth, grid: document.getElementById('db-card-list').scrollWidth <= document.getElementById('db-card-list').clientWidth + 1 }));
    assert.ok(r.sw <= r.w && r.grid, JSON.stringify(r));
    assert.deepEqual((await open(screen)).errors, []);
  });
}
test('D09-phone sheets: Filters opens the filter sheet, the deck bar the deck sheet, the backdrop closes; touch targets >= 44 px', async () => {
  const r = await ev('phone', async () => {
    const wait = () => new Promise(r => setTimeout(r, 260));
    const vis = id => { const e = document.getElementById(id), s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.visibility !== 'hidden' && b.top < innerHeight - 10; };
    document.getElementById('db-filter-btn').click(); await wait(); const f = vis('db-rail');
    const chipH = Math.min(...[...document.querySelectorAll('#db-rail .db-chip, #db-rail .db-dd')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect().height));   // v0.130.0: the hidden Colour / Group chips are replaced by dropdowns; those count too
    document.querySelector('.db-backdrop').click(); const fClosed = !document.getElementById('view-deckbuilder').classList.contains('db-open-filters');
    document.getElementById('db-deckbar').click();
    const rowH = Math.min(...[...document.querySelectorAll('#db-deck .db-row-btn')].map(e => e.getBoundingClientRect().height));
    const d = document.getElementById('view-deckbuilder').classList.contains('db-open-deck'), barH = document.getElementById('db-deckbar').getBoundingClientRect().height;
    document.querySelector('#db-deck [data-a="db-sheet"]').click();
    document.querySelector('.db-menu-btn').click(); const menu = getComputedStyle(document.querySelector('#view-deckbuilder .db-tools')).display !== 'none';
    document.querySelector('.db-backdrop').click();
    return { f, chipH, fClosed, d, rowH, barH, menu, closed: document.getElementById('view-deckbuilder').className.includes('db-open') };
  });
  assert.deepEqual([r.f, r.fClosed, r.d, r.menu, r.closed], [true, true, true, true, false], JSON.stringify(r));
  assert.ok(r.chipH >= 44 && r.rowH >= 44 && r.barH >= 44, JSON.stringify(r));
});
test('D10-pc keyboard: "/" focuses search, Esc clears it', async () => {
  const { page } = await open('pc');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('/');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'db-search');
  await page.keyboard.type('dragon'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.getElementById('db-search').value), '');
});
test('D11-phone the Card Library header header stays visible (deck builder menu CSS is scoped)', async () => {
  const h = await ev('phone', () => { BS.switchView('view-library'); const b = document.querySelector('#view-library .hdcard h2').getBoundingClientRect().height; BS.switchView('view-deckbuilder'); return b; });
  assert.ok(h > 0);
});
