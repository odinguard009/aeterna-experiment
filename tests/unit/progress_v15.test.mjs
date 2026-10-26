// v0.134.0 U15: rank, daily missions, achievements and avatars, all derived from the saved match history.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const open = async (vp) => { ctx = await (await getBrowser()).newContext(vp); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };

test('PG1 rank follows the win count and shows the way to the next one', async () => {
  await open({ viewport: { width: 1366, height: 768 } });
  const r = await page.evaluate(() => [0, 2, 3, 24, 100, 400].map(w => { const k = BS.rankOf(w); return [k.name, k.left, k.pct]; }));
  assert.deepEqual(r, [['Rookie', 3, 0], ['Rookie', 1, 67], ['Apprentice', 7, 0], ['Adept', 1, 93], ['Legend', 0, 100], ['Legend', 0, 100]]);
});
test('PG2 daily missions: three per day, count only matches of today, rotate by day', async () => {
  const r = await page.evaluate(() => {
    const now = new Date(), old = now.getTime() - 3 * 864e5;
    const h = [{ t: now.getTime(), won: true, fmt: 'standard', turns: 6 }, { t: now.getTime(), won: false, fmt: 'eternal', turns: 12 }, { t: old, won: true, fmt: 'standard', turns: 5 }];
    const a = BS.dailyMissions(h, now), b = BS.dailyMissions(h, new Date(now.getTime() + 864e5));
    return { n: a.length, today: a.map(m => m.id + ':' + m.v), differs: a.map(m => m.id).join() !== b.map(m => m.id).join(), empty: BS.dailyMissions([], now).every(m => m.v === 0 && !m.done) };
  });
  assert.equal(r.n, 3); assert.equal(r.differs, true); assert.equal(r.empty, true);
  for (const s of r.today) { const [id, v] = s.split(':'); const want = { play2: 2, win1: 1, win2: 1, std: 1, fast: 1, eternal: 1 }[id]; assert.equal(Number(v), want, s); }
});
test('PG3 avatars: locked ones cannot be picked, an unlocked pick is stored and shown', async () => {
  const r = await page.evaluate(() => {
    BS.switchView('view-settings');
    const locked = document.querySelectorAll('#set-progress .pg-avs button:disabled').length;
    BS.setAvatar('god'); const afterLocked = BS.AVATAR;
    document.querySelector('#set-progress [data-v="blue"]').click();
    return { locked, afterLocked, now: BS.AVATAR, stored: localStorage.getItem('bse.avatar.v1'), on: document.querySelector('#set-progress .pg-avs .on').dataset.v, ach: BS.ACHIEVEMENTS.length };
  });
  assert.equal(r.locked, 5); assert.equal(r.afterLocked, 'red'); assert.deepEqual([r.now, r.stored, r.on], ['blue', 'blue', 'blue']); assert.ok(r.ach >= 5);
});
test('PG4 home shows today\'s missions; phone fits the width', async () => {
  const n = await page.evaluate(() => { BS.switchView('view-lobby'); return document.querySelectorAll('#home-missions .mission').length; });
  assert.equal(n, 3);
  await ctx.close(); await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => BS.switchView('view-settings'));
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  assert.equal(w[0], w[1]);
});
