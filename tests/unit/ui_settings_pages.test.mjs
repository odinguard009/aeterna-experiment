// v0.68.0 U4 Settings / How to play / Library pages (docs/DESIGN.md section 0, mockup v11 "Settings"):
// header card + section menu + rows; Appearance with colour grid, Dark/Light, playmat upload (cover, veil, see-through rows).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
// 2x2 PNG (red), enough for createImageBitmap
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const ctxs = [];
async function open(screen, clear = true) {
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  if (clear) await page.addInitScript(() => { try { if (!sessionStorage.getItem('u68')) { localStorage.clear(); sessionStorage.setItem('u68', '1'); } } catch (e) { /* none */ } });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}
/*AFTER*/after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });

for (const screen of ['pc', 'phone']) {
  test(`U68-1 ${screen}: Settings has the header card, section menu and every old control`, async () => {
    const { page, errors } = await open(screen);
    await page.locator(screen === 'pc' ? '#app-nav .ibtn[data-a="go-settings"]' : '.phonebar [data-a="go-settings"]').first().click();
    const r = await page.evaluate(() => ({
      head: document.querySelector('#view-settings .hdcard h2').textContent,
      menu: [...document.querySelectorAll('#set-menu [data-a="set-sec"]')].map(b => b.dataset.v),
      ids: ['set-speed', 'set-sound', 'set-cpu', 'set-hist', 'set-msg', 'set-color', 'set-mode', 'set-mat'].filter(i => !document.getElementById(i)),
      acts: ['set-reset', 'hist-clear', 'set-mat-clear'].filter(a => !document.querySelector(`#view-settings [data-a="${a}"]`)),
      cols: document.querySelectorAll('#set-color .sw').length,
      wide: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(r.head, 'Settings');
    assert.deepEqual(r.menu, ['appearance', 'game', 'sound', 'access', 'data', 'history']);
    assert.deepEqual([r.ids, r.acts, r.cols, r.wide], [[], [], 9, false]);
    await page.click('#set-menu [data-v="access"]');
    assert.equal(await page.evaluate(() => document.querySelector('#set-menu [aria-current="true"]').dataset.v), 'access');
    assert.deepEqual(errors, []);
  });

  test(`U68-2 ${screen}: colour grid and Dark/Light in Settings set the theme, keep the storage key and match the header`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => BS.switchView('view-settings'));
    await page.click('#set-color [data-v="red"]');
    await page.click('#set-mode [data-v="light"]');
    const r = await page.evaluate(() => ({
      t: JSON.parse(localStorage.getItem('aeterna.theme.v1')), mode: document.documentElement.dataset.mode,
      pressed: document.querySelector('#set-color [aria-pressed="true"]').dataset.v, cpu: document.getElementById('set-cpucol').textContent,
      head: document.querySelector('#app-nav .seg [aria-pressed="true"]').dataset.v,
    }));
    assert.deepEqual(r, { t: { color: 'red', mode: 'light' }, mode: 'light', pressed: 'red', cpu: 'Blue', head: 'light' });
    await page.click('#set-menu [data-v="game"]'); await page.selectOption('#set-speed', 'fast'); await page.selectOption('#set-cpu', 'defensive');
    await page.click('#set-menu [data-v="sound"]'); await page.selectOption('#set-sound', 'on');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem(BS.SET_KEY))).then(s => [s.speed, s.sound, s.cpuProfile]), ['fast', true, 'defensive']);
    assert.deepEqual(errors, []);
  });

  test(`U68-3 ${screen}: playmat upload fills the board (cover, centred), survives a reload, Remove clears it`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => BS.switchView('view-settings'));
    await page.setInputFiles('#set-mat', { name: 'mat.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => document.documentElement.classList.contains('has-mat') && /^Playmat set/.test(document.getElementById('set-msg').textContent));   // the message comes after the store write finished: a reload before it could drop the picture
    // the image store read after a reload is idle-tolerant: under the parallel quick loop a bare 5 s timed out on a 2-core box
    await page.reload(); await page.waitForFunction(() => !!window.BS);
    await page.waitForFunction(() => document.documentElement.classList.contains('has-mat'), null, { timeout: 20000 });
    const r = await page.evaluate(() => {
      BS.switchView('view-playmat'); const cs = getComputedStyle(document.getElementById('view-playmat'));
      const row = getComputedStyle(document.documentElement).getPropertyValue('--ae-rowbg').trim();
      BS.switchView('view-settings');
      return { img: cs.backgroundImage.startsWith('url('), size: cs.backgroundSize, pos: cs.backgroundPosition, row, rm: document.getElementById('set-mat-clear').disabled };
    });
    assert.deepEqual(r, { img: true, size: 'cover', pos: '50% 50%', row: '#0f121866', rm: false });
    await page.click('[data-a="set-mat-clear"]');
    await page.waitForFunction(() => !document.documentElement.classList.contains('has-mat') && document.getElementById('set-mat-clear').disabled);   // Remove is greyed out once the store is cleared
    assert.deepEqual(errors, []);
  });

  test(`U68-4 ${screen}: How to play and Library use the header card; Library keeps its inputs and actions`, async () => {
    const { page, errors } = await open(screen);
    for (const v of ['view-howto', 'view-library']) {
      await page.evaluate(v => BS.switchView(v), v);
      const r = await page.evaluate(v => ({ h: !!document.querySelector(`#${v} .ae-phead h1, #${v} .hdcard h2`), back: true, wide: document.documentElement.scrollWidth > innerWidth + 1 }), v);
      assert.deepEqual(r, { h: true, back: true, wide: false }, v);
    }
    const miss = await page.evaluate(() => [...['in-cards', 'in-imgs', 'lib-deck', 'lib-msg', 'lib-imgcount'].filter(i => !document.getElementById(i)),
      ...['lib-template', 'lib-cards-clear', 'lib-imgs-clear', 'lib-deck-import', 'lib-deck-export'].filter(a => !document.querySelector(`#view-library [data-a="${a}"]`))]);
    assert.deepEqual(miss, []);
    await page.click('#view-library summary');
    await page.click('[data-a="lib-deck-export"]');
    assert.match(await page.inputValue('#lib-deck'), /\d+ \S+/);
    assert.deepEqual(errors, []);
  });
}

test('LR1 Learn: 16 chapters, Continue opens chapter 1, Mark as done saves progress, the glossary search filters', async () => {
  const { page, errors } = await open('phone');
  await page.evaluate(() => BS.switchView('view-howto'));
  assert.equal(await page.locator('#learn-tiles .tile2').count(), 16);
  await page.click('#learn-cont');
  await page.click('#modal-actions .modal-btn.primary');
  await page.waitForFunction(() => /1 \/ 16 done/.test(document.getElementById('learn-bars').textContent));
  assert.match(await page.textContent('#learn-cont'), /chapter 2/);
  await page.fill('#gl-q', 'zzzz-no-such-word');
  assert.match(await page.textContent('#howto-gloss'), /No rule word matches/);
  assert.deepEqual(errors, []);
});

test('PF1 Profile page: the header chip opens it with the KPIs, achievements and missions', async () => {
  const { page, errors } = await open('phone');
  await page.click('.phonebar .pchip');
  const r = await page.evaluate(() => ({ v: document.querySelector('.app-view.active').id, kpi: document.querySelectorAll('#pf-page .kpi .card').length, ach: document.querySelectorAll('#pf-page .steps3 .av').length > 0, wide: document.documentElement.scrollWidth > innerWidth + 1 }));
  assert.deepEqual(r, { v: 'view-profile', kpi: 4, ach: true, wide: false });
  assert.deepEqual(errors, []);
});
