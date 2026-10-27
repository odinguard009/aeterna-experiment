// v0.88.0 X1 field width lock (owner 2026-10-21): turning a card (refresh -> exhaust -> heavy exhaust) never moves
// or resizes anything on the board. Every field slot keeps one footprint in every state, the card turns inside it,
// and the field rows, side columns and the hand keep their boxes. Measured on PC 1366x768 and phone 412x915.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true },
};
const ctxs = [];
/*AFTER*/after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });

async function board(screen, n) {
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  const r = await page.evaluate(n => {
    const C = BS.CARDS, ids = Object.keys(C);
    const sp = ids.filter(k => C[k].type === 'Spirit' && C[k].levels && C[k].levels[0]).slice(0, n);
    const nx = ids.filter(k => C[k].type === 'Nexus').slice(0, 3);
    const side = cpu => ({ cpu, spirits: sp.map((id, i) => ({ id, cores: 1, soul: !cpu && i === 0 })), nexus: nx, hand: sp.slice(0, 5), deck: sp, soul: cpu ? 'reserve' : 'field' });
    const ld = BS.loadScenario({ players: { player: side(false), opponent: side(true) } });
    if (ld && ld.error) return ld.error;
    BS.switchView('view-playmat'); BS.render(); return 'ok';
  }, n);
  assert.equal(r, 'ok');
  return { page, errors };
}
// boxes of every board part plus each field slot (scroll position of the rows reset, so the slot x is comparable)
const measure = page => page.evaluate(() => {
  const q = s => [...document.querySelectorAll('#view-playmat ' + s)].filter(e => e.offsetParent !== null);
  const box = e => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  q('.field-row').forEach(e => { e.style.scrollBehavior = 'auto'; e.scrollLeft = 0; });
  const out = {};
  for (const s of ['.half-field', '.field-container-dual', '.fc-body', '.fc-main', '.field-row-wrapper', '.field-row', '.zone-box', '.side-flank-pc', '.hand-area', '.burst-area', '.soul-area']) out[s] = q(s).map(box);
  out.slots = q('.field-row .fslot').map(box);
  out.rowScroll = q('.field-row').map(e => e.scrollWidth);
  return out;
});
const turn = (page, how) => page.evaluate(how => {
  const G = BS.G;
  for (const k of ['player', 'opponent']) for (const z of ['spirits', 'nexus']) G.p[k][z].forEach((c, i) => {
    c.exhausted = how === 'all' || how === 'heavy' || (how === 'half' && i % 2 === 0); c.heavy = how === 'heavy' && i % 2 === 1;
  });
  BS.render();
}, how);
const near = (a, b, path = '') => {
  if (Array.isArray(a)) { assert.equal(a.length, b.length, `${path} count`); a.forEach((x, i) => near(x, b[i], `${path}[${i}]`)); return; }
  if (a && typeof a === 'object') { for (const k of Object.keys(a)) near(a[k], b[k], `${path}.${k}`); return; }
  assert.ok(Math.abs(a - b) <= 1, `${path}: ${a} -> ${b}`);
};

for (const screen of ['pc', 'phone']) for (const n of [1, 3, 6, 9]) {
  test(`X1-${screen}-${n}: ${n} Spirits a side, nothing moves when cards exhaust, heavy exhaust or refresh`, async () => {
    const { page, errors } = await board(screen, n);
    const base = await measure(page);
    assert.equal(base.slots.length, 2 * (n + 3), 'every field card has a slot');
    for (const how of ['all', 'half', 'heavy', 'none']) { await turn(page, how); near(base, await measure(page), how); }
    assert.deepEqual(errors, []);
  });
}
test('X1-css: one square slot footprint, the card (either way up) fits inside it', async () => {
  const { page } = await board('pc', 2);
  await turn(page, 'half');
  // per row (the PC Nexus row is a little lower than the Spirit row): one square size, and the card fits either way up
  const rows = await page.evaluate(() => [...document.querySelectorAll('#view-playmat .field-row')].filter(r => r.querySelector('.fslot')).map(r => [...r.querySelectorAll('.fslot')].map(s => { const b = s.getBoundingClientRect(), c = s.querySelector('.tcg-card'); return [Math.round(b.width), Math.round(b.height), Math.max(c.offsetWidth, c.offsetHeight) <= Math.min(b.width, b.height) + 1]; })));
  assert.equal(rows.length, 4);
  for (const r of rows) assert.ok(r.every(x => x[0] === x[1] && x[0] === r[0][0] && x[1] === r[0][1] && x[2]), JSON.stringify(r));
});
