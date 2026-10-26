// v0.95.0 U7 part 2: your own sleeve picture in Deck look (kept on the device per deck slot, tinted by the sleeve colour,
// Silver keeps the picture as it is) and the phone deck bar with a mini sleeve / core / Soul Core preview.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const ctxs = [];
async function open(viewport, mobile) {
  const ctx = await (await getBrowser()).newContext(Object.assign({ viewport }, mobile ? { isMobile: true, hasTouch: true } : {})); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('u95')) { localStorage.clear(); sessionStorage.setItem('u95', '1'); } } catch (e) { /* none */ } });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}
after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });

test('U95-1 upload a sleeve picture: saved per slot, tinted on your side of the board, kept after a reload, removable', async () => {
  const { page, errors } = await open({ width: 1366, height: 768 });
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); return 1; });
  await page.click('#db-deck [data-a="db-tab"][data-v="look"]');
  await page.setInputFiles('#db-sl-up', { name: 'back.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => !!BS.SLEEVE_IMG[BS.ACTIVE_SLOT]);
  await page.click('#db-look [data-v="sleeve:jade"]');
  const board = () => page.evaluate(() => { BS.testSetup(); const s = getComputedStyle(document.querySelector('#view-playmat .side-you .sleeve')), c = getComputedStyle(document.querySelector('#view-playmat .side-cpu .sleeve'));
    return { img: /blob:/.test(s.backgroundImage), blend: s.backgroundBlendMode.split(', ')[0], cpu: /blob:/.test(c.backgroundImage) }; });
  assert.deepEqual(await board(), { img: true, blend: 'multiply', cpu: false });
  await page.reload(); await page.waitForFunction(() => !!window.BS);
  await page.waitForFunction(() => !!BS.SLEEVE_IMG[BS.ACTIVE_SLOT], null, { timeout: 5000 });
  assert.equal((await board()).img, true, 'kept after a reload');
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); return 1; });
  await page.click('#db-deck [data-a="db-tab"][data-v="look"]');
  await page.click('#db-look [data-a="db-sl-clear"]');
  assert.equal(await page.evaluate(() => !!BS.SLEEVE_IMG[BS.ACTIVE_SLOT]), false);
  assert.equal((await board()).img, false);
  assert.deepEqual(errors, []);
});

test('U95-2 phone: the Look tab previews the deck look (sleeve tint, selected cores)', async () => {
  const { page, errors } = await open({ width: 390, height: 844 }, true);
  await page.evaluate(() => { BS.SLOTS()[BS.ACTIVE_SLOT].look = { sleeve: 'gold', core: 'green', soul: 'purple' }; BS.switchView('view-deckbuilder'); document.querySelector('[data-a="db-tab"][data-v="look"]').click(); return 1; });
  const r = await page.evaluate(() => { const m = document.querySelector('#db-look .cf.back'); return m && { sl: m.style.getPropertyValue('--sl'), on: [...document.querySelectorAll('#db-look .db-lkb[aria-pressed="true"]')].map(b => b.dataset.v) }; });
  assert.deepEqual(r, { sl: '#e9c46a', on: ['core:green', 'soul:purple'] });
  assert.deepEqual(errors, []);
});
