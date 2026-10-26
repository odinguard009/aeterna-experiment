// v0.134.0 U14i: the Report a Bug form opens a pre-filled GitHub issue page; nothing else is sent.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const open = async (vp) => { ctx = await (await getBrowser()).newContext(vp); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
const hidden = () => page.evaluate(() => document.getElementById('bug-overlay').hidden);

test('BR1 the URL is the repository issue page with title, body, label and optional info', async () => {
  await open({ viewport: { width: 1366, height: 768 } });
  const r = await page.evaluate(() => {
    const u = new URL(BS.bugURL('card', ' Wrong text ', 'It says X', true, 'view-lobby')), n = new URL(BS.bugURL('bug', 't', 'b', false, 'v'));
    return { p: u.origin + u.pathname, t: u.searchParams.get('title'), b: u.searchParams.get('body'), l: u.searchParams.get('labels'), nb: n.searchParams.get('body'), long: new URL(BS.bugURL('bug', 'x', 'y'.repeat(9000), true, 'v')).searchParams.get('body').length };
  });
  assert.equal(r.p, 'https://github.com/odinguard009/aeterna-experiment/issues/new');
  assert.equal(r.t, 'Wrong text'); assert.equal(r.l, 'card data');
  assert.match(r.b, /^It says X\n\n---\nVersion: v\d/); assert.match(r.b, /Page: view-lobby/);
  assert.equal(r.nb, 'b'); assert.ok(r.long <= 4000);
});
test('BR2 the form opens from the header on any page, submit opens the issue page in a new tab, Escape closes', async () => {
  await page.evaluate(() => BS.switchView('view-library'));
  await page.click('#app-nav [data-a="bug-open"]');
  assert.equal(await hidden(), false);
  await page.keyboard.press('Escape');
  assert.equal(await hidden(), true);
  await page.click('#app-nav [data-a="bug-open"]');
  await page.fill('#bug-title', 'Crash on level up'); await page.fill('#bug-text', 'Steps...');
  await page.evaluate(() => { window.__opened = []; window.open = (u, t, f) => { window.__opened.push([u, t, f]); return null; }; });
  await page.click('#bug-form button[type="submit"]');
  const [url, target, feat] = await page.evaluate(() => window.__opened[0]);
  assert.deepEqual([target, feat], ['_blank', 'noopener']);
  assert.match(url, /github\.com\/odinguard009\/aeterna-experiment\/issues\/new\?title=Crash\+on\+level\+up/);
  assert.equal(await hidden(), true);
});
test('BR3 phone: the form fits and the page does not scroll sideways', async () => {
  await ctx.close();
  await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.click('#app-nav [data-a="bug-open"]');
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, fit: document.querySelector('#bug-form').getBoundingClientRect().width <= innerWidth }));
  assert.equal(r.sw, r.vw); assert.equal(r.fit, true);
});
