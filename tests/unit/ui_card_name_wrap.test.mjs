// v0.40.3 UI polish (owner delegated UI improvements): card names wrap by CamelCase, PC step bar not faded,
// bigger touch targets. PC + phone.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const pages = {};
async function open(screen) {
  if (pages[screen]) return pages[screen];
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => {          // one board with CamelCase names, reused by the checks below
    window.__u3 = () => { BS.testSetup(); const P = BS.G.p.player; P.hand = ['BS75-005', 'BS75-007', 'BS74-047'].map(id => BS.mkInst(id));
      const m = BS.mkInst('BS75-005'); m.cores = 2; P.spirits = [m]; BS.render(); };
  });
  pages[screen] = { page, errors, ctx }; return pages[screen];
}
after(async () => { for (const k of Object.keys(pages)) await pages[k].ctx.close(); await closeBrowser(); });
const ev = async (fn, arg, screen = 'pc') => (await open(screen)).page.evaluate(fn, arg);
const SHOTS = join(ROOT, 'build', 'shots'); mkdirSync(SHOTS, { recursive: true });
const shot = async (screen, name) => (await open(screen)).page.screenshot({ path: join(SHOTS, `v0403-${name}-${screen}.png`) });

for (const screen of ['pc', 'phone']) {
  test(`N01-${screen} a hand card name carries soft break points between CamelCase parts, text unchanged`, async () => {
    const r = await ev(() => { window.__u3(); const n = document.querySelector('.hand-area .tcg-card .name'); return { t: n.textContent, h: n.innerHTML }; }, null, screen);
    assert.equal(r.t, 'The CrimsonDragonStar Rokceratops');
    assert.equal(r.h, 'The Crimson<wbr>Dragon<wbr>Star Rokceratops');
    await shot(screen, 'mat');
  });
  test(`N02-${screen} every card name with a CamelCase part has a soft break (hand and field)`, async () => {
    const r = await ev(() => { window.__u3(); return [...document.querySelectorAll('.tcg-card .name')].map(e => ({ t: e.textContent, camel: /[a-z][A-Z]/.test(e.textContent), wbr: e.innerHTML.includes('<wbr>') })); }, null, screen);
    assert.ok(r.length >= 4, 'hand + field names: ' + r.length);
    for (const x of r) if (x.camel) assert.ok(x.wbr, x.t);
  });
  test(`N03-${screen} plain names are left alone`, async () => {
    assert.equal(await ev(() => BS.nameHTML('Plain Name'), null, screen), 'Plain Name');
  });
  test(`N04-${screen} hyphenated and single-capital names are left alone`, async () => {
    assert.equal(await ev(() => BS.nameHTML('Thunder-Z-Mole'), null, screen), 'Thunder-Z-Mole');
  });
  test(`N05-${screen} names are still HTML-escaped`, async () => {
    assert.equal(await ev(() => BS.nameHTML('A&B <i>X'), null, screen), 'A&amp;B &lt;i&gt;X');
  });
  test(`N06-${screen} a short CamelCase part is never split across two lines`, async () => {
    const bad = await ev(() => {
      window.__u3(); const el = document.querySelector('.hand-area .tcg-card .name'), chars = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let tn;
      while ((tn = w.nextNode())) for (let i = 0; i < tn.length; i++) { const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 1); const q = r.getClientRects()[0]; chars.push({ c: tn.data[i], top: q ? Math.round(q.top) : null }); }
      const text = chars.map(x => x.c).join(''), out = []; let pos = 0;
      for (const m of text.matchAll(/[A-Z]?[a-z]+|[A-Z]+|\d+/g)) {
        const seg = chars.slice(m.index, m.index + m[0].length); pos++;
        if (m[0].length <= 8 && Math.max(...seg.map(x => x.top)) - Math.min(...seg.map(x => x.top)) > 3) out.push(m[0]);
      }
      return out;
    }, null, screen);
    assert.deepEqual(bad, []);
  });
  test(`N07-${screen} turn-step bar: PC shows every step unfaded, the phone keeps its scrolling bar`, async () => {
    const r = await ev(() => { window.__u3(); const c = document.querySelector('.phase-steps-container'), cr = c.getBoundingClientRect();
      const chips = [...document.querySelectorAll('.step-chip')].map(e => e.getBoundingClientRect());
      return { mask: getComputedStyle(c).maskImage || getComputedStyle(c).webkitMaskImage, inside: chips.every(q => q.left >= cr.left - 1 && q.right <= cr.right + 1), n: chips.length }; }, null, screen);
    assert.ok(r.n >= 5);
    if (screen === 'pc') { assert.equal(r.mask, 'none'); assert.ok(r.inside, 'a step chip is clipped'); }
    else assert.notEqual(r.mask, 'none');
  });
  test(`N08-${screen} deck builder controls: >= 34 px high on phones, not smaller than before on PC`, async () => {
    const r = await ev(() => { BS.switchView('view-deckbuilder'); BS.dbSheet('menu'); const ids = ['db-format', 'db-slot', 'db-name', 'db-preset', 'db-reset', 'db-clear', 'db-save', 'go-decks', 'db-search'];   // v0.53.0: phone tools sit in the menu; v0.119.0: SAVE + back-to-My-decks replace Back to Lobby
      const out = ids.map(id => { const e = document.querySelector(['#' + id, '[data-a="' + id + '"]', '.' + id].map(x => '#view-deckbuilder ' + x).join(',')); return { id, h: e ? Math.round(e.getBoundingClientRect().height) : -1 }; }); BS.dbSheet(''); return out; }, null, screen);
    for (const x of r) { assert.ok(x.h > 0, x.id + ' missing'); assert.ok(x.h >= (screen === 'phone' ? 34 : 20), `${x.id} ${x.h}px`); }
    await shot(screen, 'deck');
  });
  test(`N09-${screen} the In Deck chip is at least 18 px on phones`, async () => {
    const h = await ev(() => { BS.switchView('view-deckbuilder'); const v = Math.round(document.querySelector('#db-in').getBoundingClientRect().height); BS.dbSheet(''); return v; }, null, screen);   // v0.53.0: phone filters sit in a sheet
    assert.ok(h >= (screen === 'phone' ? 18 : 12), h + 'px');
  });
  test(`N10-${screen} header and navigation buttons have a larger touch area (same look)`, async () => {
    const r = await ev(() => { window.__u3(); return ['log-toggle', 'leave'].map(id => { const e = document.querySelector('[data-a="' + id + '"]'), a = getComputedStyle(e, '::after'); return { id, top: a.top, pos: a.position }; }); }, null, screen);
    for (const x of r) assert.deepEqual({ top: x.top, pos: x.pos }, { top: '-4px', pos: 'absolute' }, x.id);
  });
  test(`N11-${screen} no horizontal overflow on lobby, deck builder and playmat`, async () => {
    const r = await ev(() => { const o = []; for (const v of ['view-lobby', 'view-deckbuilder', 'view-playmat']) { if (v === 'view-playmat') window.__u3(); else BS.switchView(v); o.push(document.documentElement.scrollWidth > document.documentElement.clientWidth); } return o; }, null, screen);
    assert.deepEqual(r, [false, false, false]);
  });
}
