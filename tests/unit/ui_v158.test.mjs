// v0.158.0 owner review round 3 (2026-10-27): split Trash / Core Trash, no fan, filter dropdowns, partly filter, lore minimise.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async (w, h) => { if (ctx) await ctx.close(); ctx = await (await getBrowser()).newContext({ viewport: { width: w, height: h } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('V158-1 battle (PC): Trash and Core Trash are two visible halves on both sides; hand cards are not rotated', async () => {
  await open(1366, 768);
  const r = await page.evaluate(() => {
    BS.testSetup(); const P = BS.G.p.player; ['BS74-047', 'BS74-048', 'BS74-049'].forEach(id => P.hand.push(BS.mkInst(id))); BS.render();
    const boxes = [...document.querySelectorAll('.zone-box.trash2')].map(b => [...b.querySelectorAll('.tr-half')].map(h => { const q = h.getBoundingClientRect(); return [q.width > 40, q.height > 30, h.dataset.v.split(':')[1]]; }));
    const rot = [...document.querySelectorAll('#view-playmat .hand-card, #view-playmat .pc-hand .tcg-card')].map(e => getComputedStyle(e).transform).filter(t => t && t !== 'none' && /matrix\(([^,]+),([^,]+)/.test(t) && Math.abs(+t.match(/matrix\([^,]+,\s*([^,]+)/)[1]) > 0.001);
    return { boxes, rot: rot.length };
  });
  assert.equal(r.boxes.length, 2); r.boxes.forEach(b => assert.deepEqual(b, [[true, true, 'trashcards'], [true, true, 'trash']]));
  assert.equal(r.rot, 0);
});
test('V158-2 battle (PC): the hand row fits the screen (no card cut off at the bottom)', async () => {
  const r = await page.evaluate(() => { const h = [...document.querySelectorAll('#view-playmat .tcg-card')].filter(e => e.dataset.v && /player:hand/.test(e.dataset.v)).map(e => e.getBoundingClientRect().bottom); return [Math.max(...h), innerHeight]; });
  assert.ok(r[0] <= r[1] + 1, JSON.stringify(r));
});
test('V158-3 library (phone): "Partly Implemented" is a real toggle filter and lore panes can be minimised', async () => {
  await open(390, 800);
  const r = await page.evaluate(async () => {
    BS.switchView('view-library'); await new Promise(x => setTimeout(x, 200));
    const b = document.querySelector('[data-a="lib-partly"]'); b.click(); await new Promise(x => setTimeout(x, 100));
    const on = document.querySelector('[data-a="lib-partly"]').getAttribute('aria-pressed');
    document.querySelector('[data-a="lib-partly"]').click(); await new Promise(x => setTimeout(x, 100));
    return [on, document.querySelector('[data-a="lib-partly"]').getAttribute('aria-pressed'), document.querySelectorAll('.lore-minb').length];
  });
  assert.deepEqual(r, ['true', 'false', 2]);
});
