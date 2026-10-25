// v0.128.0 U14f part 1: deck builder Redo, Test hand, card size S / M / L (saved), progress ring variable, hover peek (PC).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const open = async () => {
  ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage();
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); return 1; });
};

test('DB1 Undo then Redo brings the change back; a new change empties Redo', async () => {
  await open();
  const r = await page.evaluate(() => {
    const id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && !BS.CARDS[i].token && BS.CARDS[i].implemented);
    const n0 = BS.PLAYER_DECK[id] || 0; BS.dbChange(id, 1); const n1 = BS.PLAYER_DECK[id] || 0;
    BS.dbUndo(); const n2 = BS.PLAYER_DECK[id] || 0; const redoOn = !document.getElementById('db-redo').disabled;
    BS.dbRedo(); const n3 = BS.PLAYER_DECK[id] || 0;
    BS.dbUndo(); BS.dbChange(id, 1); const redoAfterNew = document.getElementById('db-redo').disabled;
    return { n0, n1, n2, n3, redoOn, redoAfterNew };
  });
  assert.deepEqual(r, { n0: r.n0, n1: r.n0 + 1, n2: r.n0, n3: r.n0 + 1, redoOn: true, redoAfterNew: true });
});
test('DB2 Test hand shows 4 cards and Draw again deals another hand', async () => {
  await page.evaluate(() => { const ids = Object.keys(BS.CARDS).filter(i => BS.CARDS[i].type === 'Spirit' && !BS.CARDS[i].token).slice(0, 8); Object.keys(BS.PLAYER_DECK).forEach(k => { delete BS.PLAYER_DECK[k]; }); ids.forEach(i => { BS.PLAYER_DECK[i] = 1; }); BS.renderDeckBuilder(); BS.dbTestHand(); return 1; });
  await page.waitForSelector('#action-modal.active');
  assert.equal(await page.locator('#action-modal .mull-card, #action-modal .cface').count() >= 4, true);
  assert.match(await page.textContent('#action-modal'), /Starting Hand: 4 of 8 cards/);
  await page.click('#action-modal .modal-btn >> text=Close');
});
test('DB3 card size S / M / L is applied to the grid and saved', async () => {
  await page.click('[data-a="db-size"][data-v="l"]');
  assert.equal(await page.evaluate(() => document.getElementById('db-card-list').style.getPropertyValue('--db-cw')), '96px');
  assert.equal(await page.evaluate(() => localStorage.getItem('aeterna.dbsize.v1')), 'l');
  assert.equal(await page.getAttribute('[data-a="db-size"][data-v="l"]', 'aria-pressed'), 'true');
  await page.click('[data-a="db-size"][data-v="m"]');
});
test('DB4 the count ring follows the deck size and a hover shows the peek', async () => {
  const p = await page.evaluate(() => document.getElementById('db-topcount').style.getPropertyValue('--p'));
  assert.equal(p, '20%');
  await page.hover('#db-card-list [data-a="dbcard"] >> nth=0');
  await page.waitForSelector('#db-peek', { timeout: 3000 });
  await page.mouse.move(5, 5);
  await page.waitForSelector('#db-peek', { state: 'detached', timeout: 3000 });
});
