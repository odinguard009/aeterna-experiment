// 2026-11-02 report: a stale Deck Builder name input renamed another deck (two decks both called "Abyssen").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

after(closeBrowser);

test('DN1 a stale builder name never overwrites another deck; each deck keeps its own name', async () => {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } }), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  const names = await page.evaluate(async () => {
    const B = window.BS, tick = () => new Promise(r => setTimeout(r, 40)), S = B.SLOTS();
    S[0].name = 'Abyssen'; S[1].name = 'Other'; S[0].used = S[1].used = true; B.switchSlot(0);
    B.switchView('view-deckbuilder'); await tick();
    document.getElementById('db-name').value = 'Abyssen';            // what the builder input shows
    S[0].name = 'Renamed'; B.switchSlot(1);                          // renamed in My decks, another deck made active: the input is now stale
    document.querySelector('[data-a="go-decks"]').click(); await tick();
    return S.slice(0, 2).map(x => x.name);
  });
  assert.deepEqual(names, ['Renamed', 'Other']);
  await ctx.close();
});

test('DN2 the magnifier on the Card Detail art opens the zoom in front (the dialog closes first)', async () => {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1280, height: 700 } }), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(async () => { BS.switchView('view-deckbuilder'); await new Promise(r => setTimeout(r, 200)); document.querySelector('#db-card-list [data-a="dbinfo"]').click(); });
  await page.waitForSelector('#action-modal.active [data-a="zoom"]');
  await page.evaluate(() => document.querySelector('#action-modal [data-a="zoom"]').click());
  await page.waitForSelector('#zoom-overlay.active');
  const r = await page.evaluate(() => { const z = document.getElementById('zoom-overlay'), e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return { modal: document.getElementById('action-modal').classList.contains('active'), front: z.contains(e) }; });
  assert.deepEqual(r, { modal: false, front: true });
  await ctx.close();
});

test('DN3 level ranges like [LV1-2] are chips and start their own paragraph', async () => {
  const ctx = await (await getBrowser()).newContext(), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  const r = await page.evaluate(() => ({ lines: effectLines('Legacy [LV1-2] Clash (During Attack) Opposing Spirits must block. [LV2-3] Draw a card.'), html: effectTextHTML({ desc: '[LV1-2-3] (When Attacks) Draw.', name: 'x', type: 'Spirit', cost: 0 }) }));
  assert.deepEqual(r.lines.map(l => l.split(' ')[0]), ['Legacy', '[LV1-2]', '[LV2-3]']);
  assert.ok(r.html.includes('<span class="fx-lv">LV1-2-3</span>') && !r.html.includes('[LV'));
  await ctx.close();
});

test('DN4 Settings downloads card pictures into local storage, and says so when there is no server', async () => {
  const ctx = await (await getBrowser()).newContext(), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  let hits = 0;
  await page.route('http://pics.test/**', r => { hits++; return r.request().url().includes('/assets/card-images/BS01-001') ? r.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.from('RIFF0000WEBP') }) : r.fulfill({ status: 404, body: '' }); });
  const none = await page.evaluate(async () => (await downloadAllImages(() => {})).err);
  assert.match(none, /No picture server/);
  await page.evaluate(() => { SETTINGS.onlineUrl = 'http://pics.test'; });
  const r = await page.evaluate(async () => { const x = await downloadAllImages(() => {}); return { ...x, stored: !!IMG['BS01-001'] }; });
  assert.equal(r.ok, 1); assert.equal(r.stored, true); assert.ok(hits >= 1);
  await ctx.close();
});
test('DN5 battle top bar has a fullscreen button beside Log, and battle text follows the text size', async () => {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.testSetup(); });
  const r = await page.evaluate(async () => {
    const fs = document.querySelector('.ae-tools [data-a="fullscreen"]'), lg = document.querySelector('.ae-tools [data-a="log-toggle"]');
    const px = () => parseFloat(getComputedStyle(document.querySelector('#view-playmat .btn-nav-small .l, #view-playmat .control-log-row') || document.body).fontSize);
    const a = px(); document.documentElement.dataset.ts = 'larger'; await new Promise(r => setTimeout(r, 100)); const b = px();
    return { next: !!fs && lg.nextElementSibling === fs, a, b };
  });
  assert.equal(r.next, true); assert.ok(r.b > r.a * 1.15, `${r.a} -> ${r.b}`);
  await ctx.close();
});
