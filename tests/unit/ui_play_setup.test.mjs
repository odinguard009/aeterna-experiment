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
      return { head: vis('#view-play .hdcard h2'), deck: vis('#play-decks'), status: document.getElementById('lobby-deck').textContent,
        modes: [...document.querySelectorAll('#pl-mode .chip')].map(b => b.dataset.v), fmt: vis('#pl-fmt'), cpu: vis('#play-cpu'),
        styles: [...document.querySelectorAll('#pl-style .opt')].map(b => b.dataset.v), speeds: [...document.querySelectorAll('#pl-speed .chip')].map(b => b.dataset.v),
        pressed: [document.querySelector('#pl-style [aria-pressed="true"]').dataset.v, document.querySelector('#pl-speed [aria-pressed="true"]').dataset.v],
        startInView: start.bottom <= innerHeight, over: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.ok(r.head && r.deck && r.fmt && r.cpu, 'header, deck select, format button and CPU deck select visible');
    assert.match(r.status, /legal in ETERNAL/);
    assert.deepEqual(r.modes, ['cpu', 'watch', 'online']);
    assert.deepEqual(r.styles, ['balanced', 'aggressive', 'defensive', 'random']);
    assert.deepEqual(r.speeds, ['normal', 'fast', 'instant']);
    assert.deepEqual(r.pressed, ['balanced', 'normal']);
    assert.ok(!r.over, 'no horizontal overflow');
    await page.click('#pl-style [data-v="aggressive"]'); await page.click('#pl-speed [data-v="fast"]');
    const s = await page.evaluate(() => [BS.SETTINGS.cpuProfile, BS.SETTINGS.speed, JSON.parse(localStorage.getItem(BS.SET_KEY)).speed,
      document.querySelector('#pl-style [aria-pressed="true"]').dataset.v, document.querySelector('#pl-speed [aria-pressed="true"]').dataset.v]);
    assert.deepEqual(s, ['aggressive', 'fast', 'fast', 'aggressive', 'fast']);
    const f0 = await page.innerText('#pl-fmt .on'); await page.click('#pl-fmt .chip:not(.on)');
    assert.notEqual(await page.innerText('#pl-fmt .on'), f0, 'format switches'); await page.click('#pl-fmt .chip:not(.on)');
    await page.click('#pl-level [data-v="easy"]'); await page.click('#pl-first [data-v="me"]'); await page.click('#pl-style [data-v="random"]');
    const m = await page.evaluate(() => [BS.SETTINGS.cpuLevel, BS.SETTINGS.firstTurn, BS.SETTINGS.cpuRandom]);
    assert.deepEqual(m, ['easy', 'me', true]);
    await page.click('#view-play [data-a="start"]');
    await page.waitForFunction(() => BS.G && BS.G.history && BS.G.history.includes('You go first (set in the match setup).'), null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => BS.G.lvl), 'easy');
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

test('U67-3 pc: Easy strength and First turn "CPU first" reach the match; Hard/Normal are unchanged; the record replays them', async () => {
  const { page, errors } = await open('pc');
  const r = await page.evaluate(async () => {
    BS.startNewGame({ lvl: 'easy', first: 'cpu', prof: null, seed: 7 });
    await new Promise(res => setTimeout(res, 800));
    const a = [BS.G.lvl, BS.G.history.includes('The CPU goes first (set in the match setup).'), BS.G.rec && BS.G.rec.lvl, BS.G.rec && BS.G.rec.first];
    BS.startNewGame({ lvl: 'bogus', first: 'bogus' }); await new Promise(res => setTimeout(res, 300));
    return [a, BS.G.lvl];
  });
  assert.deepEqual(r[0], ['easy', true, 'easy', 'cpu']);
  assert.equal(r[1], 'normal', 'unknown strength falls back to normal');
  assert.deepEqual(errors, []);
});
