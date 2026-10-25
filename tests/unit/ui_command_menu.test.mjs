// v0.123.0 U14c: the card command menu names (owner mockup v14): Summon / Cast / Place Nexus, Set as Burst, Attack, + Core, − Core, Soul Core, Card Info.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async () => { ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const labels = () => page.$$eval('#modal-actions .modal-btn', b => b.map(x => x.textContent.trim()));

test('CM01 field menu: + Core, − Core, Soul Core and Card Info', async () => {
  await open();
  await page.evaluate(() => { BS.testSetup(); const P = BS.G.p.player, id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].implemented); const f = BS.mkInst(id); f.cores = 2; P.spirits = [f]; BS.render(); });
  await page.click('#view-playmat [data-a="field"]');
  const l = (await labels()).join(' | ');
  assert.match(l, /\+ Core \(from Reserve\)/); assert.match(l, /− Core \(to Reserve\)/); assert.match(l, /Soul Core/); assert.match(l, /Card Info/);
  assert.doesNotMatch(l, /Full Card Details|Add Core|Remove Core/);
});
test('CM02 hand menu: Summon for a Spirit, Place Nexus for a Nexus, Set as Burst', async () => {
  await page.keyboard.press('Escape'); await page.evaluate(() => BS.closeModal && BS.closeModal(null));
  const r = await page.evaluate(() => { BS.testSetup(); const P = BS.G.p.player, ids = Object.keys(BS.CARDS), n = ids.find(i => BS.CARDS[i].type === 'Nexus'), s = ids.find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].burst); P.hand = [BS.mkInst(n), BS.mkInst(s)]; P.reserve.n = 8; BS.render(); return [n, s]; });
  await page.click('.hand-area .tcg-card >> nth=0');
  assert.match((await labels()).join(' | '), /Place Nexus \(Pay/);
  await page.evaluate(() => BS.closeModal && BS.closeModal(null));
  await page.click('.hand-area .tcg-card >> nth=1');
  const l = (await labels()).join(' | ');
  assert.match(l, /Summon \(Pay/); assert.match(l, /Set as Burst/); assert.match(l, /Card Info/);
});
