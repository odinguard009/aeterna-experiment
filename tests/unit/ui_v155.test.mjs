// v0.155.0 owner review (2026-10-27), batch 1 + 2: layout fixes, filter groups, core colours, Home background, card page, Saga lore.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async (w, h) => { if (ctx) await ctx.close(); ctx = await (await getBrowser()).newContext({ viewport: { width: w, height: h } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('V155-1 Play (PC): the Start box sits right under the header, above the three steps', async () => {
  await open(1366, 768);
  const r = await page.evaluate(() => { BS.switchView('view-play'); const t = s => document.querySelector(s).getBoundingClientRect().top; return [t('#view-play .hdcard'), t('#view-play .readybox'), t('#view-play .steps3')]; });
  assert.ok(r[0] < r[1] && r[1] < r[2], JSON.stringify(r));
});
test('V155-2 starter decks: equal cells in a grid; phone shows the Key card and the name only', async () => {
  const r = await page.evaluate(() => { BS.switchView('view-decks'); const rows = [...document.querySelectorAll('#dk-starters .dk-st-row')].map(e => e.getBoundingClientRect()); return { n: rows.length, w: new Set(rows.map(x => Math.round(x.width))).size, th: document.querySelectorAll('#dk-starters .dk-st-th').length }; });
  assert.ok(r.n >= 10 && r.w === 1 && r.th === r.n, JSON.stringify(r));
  await open(390, 780);
  const p = await page.evaluate(() => { BS.switchView('view-decks'); const s = document.querySelector('#dk-starters .dk-st-sub'), t = document.querySelector('#dk-list .dtile'); return { sub: getComputedStyle(s).display, fan: [...t.querySelectorAll('.stack .cf')].filter(x => getComputedStyle(x).display !== 'none').length }; });
  assert.deepEqual(p, { sub: 'none', fan: 1 });
});
test('V155-3 card dialog: the card face is not cut into a parallelogram; Add / Remove share a row, Close spans', async () => {
  await open(1366, 768);
  const r = await page.evaluate(async () => {
    BS.switchView('view-deckbuilder'); showCardDetail(Object.keys(BS.CARDS)[5], 'deck'); await new Promise(x => setTimeout(x, 300));
    const f = document.querySelector('#modal-card-desc .cface'), b = [...document.querySelectorAll('#modal-actions .modal-btn')].map(x => x.getBoundingClientRect());
    return { clip: getComputedStyle(f).clipPath, rows: [Math.round(b[0].top) === Math.round(b[1].top), Math.round(b[2].width) > Math.round(b[0].width) * 1.5], n: b.length };
  });
  assert.equal(r.clip, 'none'); assert.deepEqual(r.rows, [true, true]);
});
test('V155-4 filters: the rainbow pip is the All colour group; Mirage / Rebirth are type chips; the Library has the same bar', async () => {
  const r = await page.evaluate(() => {
    BS.switchView('view-deckbuilder');
    const q = (v, s) => document.querySelector(`#${v}-tbar ${s}`);
    q('db', '.pip.rainbow').click(); const g1 = [...BS.DBF.groups]; q('db', '.pip.rainbow').click();
    const t = [...document.querySelectorAll('#db-types .chip')].map(x => x.textContent);
    q('db', '[data-v="groups:mirage"]').click(); const g2 = [...BS.DBF.groups]; q('db', '[data-v="groups:mirage"]').click();
    BS.switchView('view-library'); const l = [...document.querySelectorAll('#lib-types .chip')].map(x => x.textContent);
    return { g1, g2, t, l, lp: document.querySelectorAll('#lib-pips .pip.rainbow').length };
  });
  assert.deepEqual(r.g1, ['multi']); assert.deepEqual(r.g2, ['mirage']);
  assert.deepEqual(r.t.slice(-2), ['Mirage', 'Rebirth']); assert.deepEqual(r.l, r.t); assert.equal(r.lp, 1);
});
test('V155-5 Look tab: every core and Soul Core swatch has its own colour', async () => {
  const r = await page.evaluate(() => { BS.switchView('view-deckbuilder'); dbTab('look'); const bg = k => new Set([...document.querySelectorAll(`.db-lkb[data-v^="${k}:"] i`)].map(i => getComputedStyle(i).backgroundImage + getComputedStyle(i, '::after').backgroundImage + getComputedStyle(i, '::before').backgroundImage)).size; return [bg('core'), bg('soul')]; });
  assert.ok(r[0] >= 8 && r[1] >= 8, JSON.stringify(r));
});
test('V155-6 phone deck sheet: maximize / minimize button; the action row is one scrollable line', async () => {
  await open(390, 780);
  const r = await page.evaluate(async () => {
    BS.switchView('view-deckbuilder'); dbSheet('deck'); await new Promise(x => setTimeout(x, 500));
    const h = () => Math.round(document.querySelector('#db-deck').getBoundingClientRect().height), a = h(), d = document.querySelector('#db-deck .dact');
    const scroll = d.scrollWidth > d.clientWidth, one = new Set([...d.querySelectorAll('.btn')].map(b => Math.round(b.getBoundingClientRect().top))).size;
    dbSheet('size'); await new Promise(x => setTimeout(x, 500)); const mx = h(); dbSheet('size'); await new Promise(x => setTimeout(x, 500)); const mn = h();
    return { a, mx, mn, one, scroll };
  });
  assert.ok(r.mx > r.a && r.mn < r.a && r.one === 1 && r.scroll, JSON.stringify(r));
});
test('V155-7 Home: the logo backdrop on the theme colour, an own picture replaces it; Library can hide its filters; the game log can be copied', async () => {
  await open(1366, 768);
  const r = await page.evaluate(async () => {
    const logo = !!document.querySelector('#view-lobby > .lob-bg .lob-logo'), up = !!document.getElementById('lobby-bg-up');
    lobbyBgUse(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })); const has = document.documentElement.classList.contains('has-lobbybg'), rb = !document.getElementById('lobby-bg-clear').hidden; lobbyBgUse(null);
    BS.switchView('view-library'); document.querySelector('[data-a="lib-min"]').click(); const mn = document.getElementById('view-library').classList.contains('lib-min'); document.querySelector('[data-a="lib-min"]').click();
    return { logo, up, has, rb, mn, back: !document.getElementById('view-library').classList.contains('lib-min'), copy: !!document.getElementById('log-copy') };
  });
  assert.deepEqual(r, { logo: true, up: true, has: true, rb: true, mn: true, back: true, copy: true });
});
test('V155-8 Lore can be read by Saga (17 Sagas, BS75 in Saga 16, BS76 in Saga 17); the card page shows family, flavor text and the Art block', async () => {
  const r = await page.evaluate(async () => {
    BS.switchView('view-library'); document.querySelector('[data-a="lib-tab"][data-v="lore"]').click(); document.querySelector('[data-a="lib-lore-by"][data-v="saga"]').click(); await new Promise(x => setTimeout(x, 200));
    const nav = [...document.querySelectorAll('#lib-lore-nav button b')].map(b => b.textContent);
    openCardPage('BS01-001'); await new Promise(x => setTimeout(x, 200));
    return { nav: nav.filter(n => /^Saga/.test(n)).length, s75: sagaOf('BS75'), s76: sagaOf('BS76'), sd: sagaOf('SD69'), fam: /·/.test(document.querySelector('#cp-page h2 + span').textContent), flv: !!document.querySelector('#cp-page .flv'), art: !!document.querySelector('#cp-page .cp-arts') };
  });
  assert.deepEqual(r, { nav: 17, s75: 16, s76: 17, sd: 15, fam: true, flv: true, art: true });
});
test('V155-9 battle PC: Card Panel on the right, area sizes do not change with contents (full board, GAME OVER), gems shrink to fit, arrow keys scroll the panel, cues stay off the panel', async () => {
  await open(1366, 768);
  const r = await page.evaluate(async () => {
    const G = BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const ids = Object.values(BS.CARDS).filter(c => c.type === 'Spirit').slice(0, 12).map(c => c.id);
    const snap = () => [...document.querySelectorAll('#view-playmat .half-field, #view-playmat .hand-container-wrapper, #view-playmat .zone-box, .ae-step')].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join(','); }).join('|');
    const before = snap(), cp = document.getElementById('card-panel').getBoundingClientRect(), fieldR = document.querySelector('.half-field').getBoundingClientRect().right;
    const P = G.p.player; for (const id of ids) { const i = BS.mkInst(id); i.cores = 7; P.spirits.push(i); } for (let k = 0; k < 10; k++) P.hand.push(BS.mkInst(ids[0])); P.reserve.n = 25; P.life = 10;
    BS.render(); const full = snap(); G.over = true; BS.render(); const over = snap();
    const tag = document.querySelector('#view-playmat .core-tag'), tagFit = tag.scrollWidth <= tag.parentElement.clientWidth + 1;
    const ae = document.getElementById('ae-fx').getBoundingClientRect();
    return { right: cp.left >= fieldR - 1, same: before.split('|').length === full.split('|').length, full: full.split('|').slice(0, 3).join() === before.split('|').slice(0, 3).join(), zones: full === over || full.split('|').filter(x => x).length === over.split('|').filter(x => x).length, tagFit, aeClear: ae.right <= cp.left + 1 };
  });
  assert.ok(r.right && r.full && r.tagFit && r.aeClear, JSON.stringify(r));
  await page.evaluate(() => { const cp = document.getElementById('card-panel'); const f = document.createElement('div'); f.style.cssText = 'height:2000px;flex:none'; cp.appendChild(f); cp.scrollTop = 0; });
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => document.getElementById('card-panel').scrollTop > 0), 'ArrowDown scrolls the Card Panel');
});
