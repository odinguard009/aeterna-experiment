// v0.151.0: Esc closes view-only dialogs on every page; board-diff core gems; 360 px header; phone Life pill keeps the field height.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async (w = 1366, h = 768) => { if (ctx) await ctx.close(); ctx = await (await getBrowser()).newContext({ viewport: { width: w, height: h } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('V151-1 Esc closes the shortcuts dialog on the home page', async () => {
  await open();
  await page.keyboard.press('?');
  assert.ok(await page.evaluate(() => document.getElementById('action-modal').classList.contains('active')));
  await page.keyboard.press('Escape');
  assert.ok(!(await page.evaluate(() => document.getElementById('action-modal').classList.contains('active'))));
});
test('V151-2 core moves with no engine cue still fly as gems (board diff), cued ones are not doubled', async () => {
  await open();
  const n = await page.evaluate(async () => {
    BS.SETTINGS.anim = 'full'; BS.testSetup();
    const P = BS.G.p.player, id = Object.keys(BS.CARDS).find(i => /spirit/i.test(BS.CARDS[i].type)), f = BS.mkInst(id);
    f.cores = 2; P.spirits.push(f); P.reserve.n = 6; BS.render(); await new Promise(r => setTimeout(r, 300));
    let k = 0; new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(e => { if (e.classList && e.classList.contains('ae-a-fly')) k++; }))).observe(document.getElementById('ae-fx'), { childList: true });
    P.reserve.n -= 2; f.cores += 2; P.trashCores.n += 1; f.cores -= 1; P.life -= 1; P.reserve.n += 1;   // net: reserve -1, life -1, trash +1, spirit +1
    BS.render(); await new Promise(r => setTimeout(r, 100)); return k;
  });
  assert.equal(n, 2);
});
test('V151-3 phone 360 px: the header title never overlaps the colour button', async () => {
  await open(360, 740);
  for (const v of ['view-library', 'view-decks', 'view-profile', 'view-deckbuilder']) {
    await page.evaluate(v => switchView(v), v);
    const ok = await page.evaluate(() => { const t = document.getElementById('pb-title').getBoundingClientRect(), c = document.querySelector('.phonebar .colb').getBoundingClientRect(); return t.right <= c.left + 1 && document.getElementById('pb-title').scrollWidth <= document.getElementById('pb-title').clientWidth + 1; });
    assert.ok(ok, v);
  }
});
test('V151-4 phone: the field does not change size while Life drops', async () => {
  await open(390, 844);
  const hs = await page.evaluate(async () => { BS.testSetup(); const out = []; for (const L of [5, 3, 1]) { BS.G.p.player.life = L; BS.render(); await new Promise(r => setTimeout(r, 50)); out.push(Math.round(document.querySelector('.field-container-dual').getBoundingClientRect().height)); } return out; });
  assert.equal(new Set(hs).size, 1, hs.join());
});
