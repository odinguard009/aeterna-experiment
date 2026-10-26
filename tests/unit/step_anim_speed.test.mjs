// v0.138.0: Core / Draw / Refresh step cues, the Slow speed (slow-normal-fast-instant), Text size and the keyboard shortcuts list.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async (viewport = { width: 1366, height: 768 }) => { ctx = await (await getBrowser()).newContext({ viewport }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('SA1 the Core, Draw and Refresh steps send their cues in order and the state ends right', async () => {
  await open();
  const r = await page.evaluate(async () => {
    const G = BS.testSetup(), P = G.p.opponent, id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.isSpiritForm(BS.CARDS[i]));
    const s = BS.mkInst(id); s.cores = 1; s.exhausted = true; P.spirits = [s]; P.trashCores.n = 3; BS.SETTINGS.speed = 'instant'; BS.SETTINGS.anim = 'off';
    const ev = [], prev = BS.io.host; BS.bindHost({ ...prev, view: e => { if (e.type === 'core' || e.type === 'draw') ev.push(e.type === 'draw' ? 'draw' : `${e.from}>${e.to}${e.nth != null ? e.nth : ''}`); prev.view(e); } });
    const before = P.reserve.n, hand = P.hand.length; G.turnNo = 3; await BS.beginTurn('opponent');
    return { ev, reserve: P.reserve.n - before, hand: P.hand.length - hand, trash: P.trashCores.n, up: !s.exhausted };
  });
  assert.deepEqual(r.ev, ['void>reserve', 'draw', 'trash>reserve0', 'trash>reserve1', 'trash>reserve2']);
  assert.deepEqual([r.reserve, r.hand, r.trash, r.up], [4, 1, 0, true]);
});
test('SA2 Full plays a gem per core in the Refresh Step; Instant plays none', async () => {
  for (const [speed, min] of [['fast', 3], ['instant', 0]]) {
    const n = await page.evaluate(async sp => {
      const G = BS.testSetup(), P = G.p.opponent; P.trashCores.n = 3; BS.SETTINGS.speed = sp; BS.SETTINGS.anim = 'full';
      let n = 0; const mo = new MutationObserver(l => l.forEach(m => m.addedNodes.forEach(x => { if (x.classList && x.classList.contains('ae-a-fly')) n++; }))); mo.observe(document.getElementById('ae-fx'), { childList: true });
      G.turnNo = 3; await BS.beginTurn('opponent'); mo.disconnect(); return n;
    }, speed);
    assert.ok(speed === 'instant' ? n === min : n >= min, `${speed}: ${n}`);
  }
});
test('SA3 Settings lists Slow, Normal, Fast, Instant in that order, saves the pick and the Play page offers the same four', async () => {
  await page.evaluate(() => { BS.SETTINGS.speed = 'normal'; BS.switchView('view-settings'); });
  await page.click('#set-menu [data-v="game"]');
  assert.deepEqual(await page.$$eval('#set-speed option', o => o.map(x => x.value)), ['slow', 'normal', 'fast', 'instant']);
  await page.selectOption('#set-speed', 'slow');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(BS.SET_KEY)).speed), 'slow');
  await page.evaluate(() => BS.switchView('view-play'));
  assert.deepEqual(await page.$$eval('#pl-speed [data-v]', o => o.map(x => x.dataset.v)), ['slow', 'normal', 'fast', 'instant']);
});
test('SA4 Text size changes the menu font and is saved; ? opens the shortcuts list', async () => {
  await page.evaluate(() => BS.switchView('view-settings'));
  await page.click('#set-menu [data-v="access"]');
  await page.selectOption('#set-ts', 'larger');
  const r = await page.evaluate(() => ({ ts: document.documentElement.dataset.ts, fs: getComputedStyle(document.querySelector('.mk') || document.body).fontSize, saved: JSON.parse(localStorage.getItem(BS.SET_KEY)).textSize }));
  assert.deepEqual([r.ts, r.fs, r.saved], ['larger', '18px', 'larger']);
  await page.selectOption('#set-ts', 'normal');
  assert.equal(await page.evaluate(() => 'textSize' in JSON.parse(localStorage.getItem(BS.SET_KEY))), false);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('?');
  await page.waitForSelector('#action-modal.active .kbd-row');
  assert.ok((await page.$$('#action-modal .kbd-row')).length >= 5);
});
