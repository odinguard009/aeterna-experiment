// v0.152.0 battle parity with mockup v14, part 1: band turn number, header subtitle, Card Panel frame + log, full-word phone stat labels.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async (w, h) => { if (ctx) await ctx.close(); ctx = await (await getBrowser()).newContext({ viewport: { width: w, height: h } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); await page.evaluate(() => BS.testSetup()); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('V152-1 PC: band shows the turn number; header names format and CPU style; Card Panel has a frame, a hint and the last log lines', async () => {
  await open(1366, 768);
  await page.evaluate(() => { BS.G.history.push('one', 'two', 'three'); BS.render(); });
  const r = await page.evaluate(() => ({ band: document.querySelector('.turn-title').innerText.replace(/\s+/g, ' ').trim(), sub: document.querySelector('.ae-sub').innerText, ph: !!document.querySelector('#card-panel .cp-ph'), hint: document.querySelector('#card-panel .cp-hint').innerText, log: document.querySelectorAll('#card-panel .cp-log > div:not(.cp-lh)').length }));
  assert.match(r.band, /^PLAYER TURN \d+$/i);
  assert.match(r.sub, /^(Standard|Eternal) · vs \w+ CPU$/);
  assert.ok(r.ph); assert.match(r.hint, /Hover Or Tap A Card/); assert.equal(r.log, 3);
});
test('V152-2 phone: stat cells read as full words (CSS) while the text keeps the short label; nothing overflows at 360 px', async () => {
  await open(360, 740);
  const r = await page.evaluate(() => [...document.querySelectorAll('.mobile-stats-bar .stat-pill')].map(p => ({ f: p.querySelector('.pl').dataset.f, t: p.textContent.trim().slice(0, 4), ovf: p.scrollWidth > p.clientWidth + 1 })));
  assert.ok(r.some(x => x.f === 'Banished' && x.t === 'BAN:')); assert.ok(r.every(x => !x.ovf), JSON.stringify(r));
});
