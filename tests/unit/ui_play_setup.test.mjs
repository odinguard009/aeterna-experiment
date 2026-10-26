// v0.67.0 U3 Play setup page (docs/DESIGN.md section 0): header card, deck chip, mode cards (Match vs CPU,
// Watch CPU vs CPU), setup rows (format, CPU deck, CPU style chips, speed chips). Old ids and actions are kept.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const ctxs = [];
async function open(screen) {
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}
/*AFTER*/after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });

for (const screen of ['pc', 'phone']) {
  test(`U67-1 ${screen}: Play page shows header, deck chip, two mode cards and the setup rows; chips save`, async () => {
    const { page, errors } = await open(screen);
    await page.click('[data-nav="view-play"]:visible');
    const r = await page.evaluate(() => {
      const vis = s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const start = document.querySelector('#view-play [data-a="start"]').getBoundingClientRect();
      return { head: vis('#view-play .ae-phead h1'), deck: vis('#play-deck'), status: document.getElementById('lobby-deck').textContent,
        modes: [...document.querySelectorAll('#pl-mode .ae-chip')].map(b => b.dataset.v), fmt: vis('#format-btn'), cpu: vis('#play-cpu'),
        styles: [...document.querySelectorAll('#pl-style .ae-chip')].map(b => b.dataset.v), speeds: [...document.querySelectorAll('#pl-speed .ae-chip')].map(b => b.dataset.v),
        pressed: [document.querySelector('#pl-style [aria-pressed="true"]').dataset.v, document.querySelector('#pl-speed [aria-pressed="true"]').dataset.v],
        startInView: start.bottom <= innerHeight, over: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.ok(r.head && r.deck && r.fmt && r.cpu, 'header, deck select, format button and CPU deck select visible');
    assert.match(r.status, /legal in ETERNAL/);
    assert.deepEqual(r.modes, ['cpu', 'watch', 'online']);
    assert.deepEqual(r.styles, await page.evaluate(() => Object.keys(BS.CPU_PROFILES)));
    assert.deepEqual(r.speeds, ['normal', 'fast', 'instant']);
    assert.deepEqual(r.pressed, ['balanced', 'normal']);
    assert.ok(r.startInView, 'Match vs CPU is on the first screen');
    assert.ok(!r.over, 'no horizontal overflow');
    await page.click('#pl-style [data-v="aggressive"]'); await page.click('#pl-speed [data-v="fast"]');
    const s = await page.evaluate(() => [BS.SETTINGS.cpuProfile, BS.SETTINGS.speed, JSON.parse(localStorage.getItem(BS.SET_KEY)).speed,
      document.querySelector('#pl-style [aria-pressed="true"]').dataset.v, document.querySelector('#pl-speed [aria-pressed="true"]').dataset.v]);
    assert.deepEqual(s, ['aggressive', 'fast', 'fast', 'aggressive', 'fast']);
    const f0 = await page.innerText('#format-btn'); await page.click('#format-btn');
    assert.notEqual(await page.innerText('#format-btn'), f0, 'format toggles'); await page.click('#format-btn');
    await page.click('#view-play [data-a="go-lobby"]');
    assert.equal(await page.evaluate(() => document.getElementById('view-lobby').classList.contains('active')), true);
    assert.deepEqual(errors, []);
  });
}

test('U67-2 pc: Watch CPU vs CPU plays both sides to the end, step clicks only warn, no history entry', async () => {
  const { page, errors } = await open('pc');
  await page.click('[data-nav="view-play"]:visible');
  await page.click('#pl-speed [data-v="instant"]');
  await page.click('#pl-mode [data-v="watch"]'); await page.click('#view-play [data-a="start"]');
  await page.waitForFunction(() => BS.G && BS.G.turnNo >= 1, null, { timeout: 15000 });
  const st = await page.evaluate(() => { BS.stepClick(4); return [BS.G.watch, BS.G.p.player.cpu, BS.G.p.player.name, BS.humanCan()]; });
  assert.deepEqual(st.slice(0, 3), [true, true, 'Your deck']);
  assert.equal(st[3], false, 'no human input while watching');
  await page.waitForFunction(() => BS.G && BS.G.over, null, { timeout: 120000, polling: 250 });
  const end = await page.evaluate(() => [BS.HISTORY().length, document.body.innerText.includes('MATCH OVER')]);
  assert.equal(end[0], 0, 'watched matches are not saved to the match history');
  assert.ok(end[1], 'game over dialog says MATCH OVER');
  assert.deepEqual(errors, []);
});
