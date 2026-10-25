// v0.127.0 U14e battle phone: the header tools (LOG, emoticon, options, exit) stay inside the screen at 360 / 390 / 430 and nothing scrolls sideways; field cells stay square (X1).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const ctxs = [];
after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });
const open = async w => {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true }); ctxs.push(ctx);
  const page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); return page;
};

for (const w of [360, 390, 430]) {
  test(`PH${w} header tools inside the screen, no sideways scroll, square cells`, async () => {
    const page = await open(w);
    const r = await page.evaluate(() => {
      const G = BS.testSetup(), ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].implemented), mk = () => { const x = BS.mkInst(ids[0]); x.cores = 1; return x; };
      G.p.player.spirits = [mk(), mk(), mk(), mk()]; G.p.player.hand = [BS.mkInst(ids[1])];
      const nx = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Nexus'); G.p.player.nexus = [BS.mkInst(nx)];
      BS.render();
      const row = document.querySelector('.side-you .field-row') || [...document.querySelectorAll('.field-row')].pop(), slots = [...row.querySelectorAll('.slot')].map(s => s.getBoundingClientRect()), rr = row.getBoundingClientRect();
      const tools = [...document.querySelectorAll('#view-playmat .ae-tools .btn-nav-small')].map(b => { const q = b.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.right), q.width > 0]; });
      return { n: slots.length, inside: slots.every(s => s.left >= rr.left - 1 && s.right <= rr.right + 1), same: new Set(slots.map(s => Math.round(s.width))).size, tools, vw: innerWidth, sw: document.documentElement.scrollWidth };
    });
    assert.equal(r.n, 5); assert.equal(r.same, 1);
    assert.ok(r.tools.length >= 4 && r.tools.every(t => t[2] && t[0] >= 0 && t[1] <= r.vw), JSON.stringify(r.tools));
    assert.equal(r.sw, r.vw);
  });
}
