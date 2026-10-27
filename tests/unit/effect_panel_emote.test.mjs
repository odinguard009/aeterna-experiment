// v0.125.0 U14d2: the engine's 'effect' view record shows the Effect Active panel (Full only); 12 emoticons, one every 30 s.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async () => { ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const clear = () => page.evaluate(() => document.querySelectorAll('#ae-fx .ae-eff, #ae-fx .ae-emote').forEach(e => e.remove()));

test('EF01 an effect record shows an info pop-up in every animation mode; Off in Settings hides it; X and the 5 s timer remove it', async () => {
  await open();
  await page.evaluate(() => { BS.testSetup(); });
  const fire = m => page.evaluate(m => { BS.SETTINGS.anim = m; const id = Object.keys(BS.CARDS)[0]; BS.io.view({ type: 'effect', side: 'player', id, text: 'Draw 1 card', trg: 'SUMMONED' }); return document.querySelectorAll('#ae-fx .ae-eff').length; }, m);
  assert.equal(await fire('full'), 1); await clear();
  assert.equal(await fire('off'), 1);                                   // info, not an animation: it shows even with animations Off
  assert.equal(await page.locator('#ae-fx .ae-eff .ae-eff-h').innerText(), 'YOU · EFFECT · When Summoned');
  await page.click('#ae-fx .ae-eff-x');
  assert.equal(await page.locator('#ae-fx .ae-eff').count(), 0);        // the X closes it at once
  await page.evaluate(() => { BS.SETTINGS.effPop = 'off'; });
  assert.equal(await fire('full'), 0); await clear();                   // Settings > Game > Effect pop-ups = Off
  await page.evaluate(() => { delete BS.SETTINGS.effPop; });
  assert.equal(await fire('full'), 1);
  assert.equal(await fire('full'), 1);                                  // the same effect again refreshes the pop-up instead of stacking
  await page.waitForFunction(() => !document.querySelector('#ae-fx .ae-eff'), null, { timeout: 7000 });   // gone after 5 s on its own
});
test('EF02 the engine emits it when a card effect resolves', async () => {
  await clear();
  const n = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.anim = 'full'; let k = 0; const prev = BS.io.host;
    BS.bindHost({ ...prev, view: ev => { if (ev.type === 'effect') k++; prev.view(ev); } });
    const id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].effects && BS.CARDS[i].effects.length && BS.CARDS[i].implemented), e = BS.CARDS[id].effects[0];
    await BS.runActions({ p: BS.G.p.player, opp: BS.G.p.opponent, src: BS.mkInst(id), ctx: {} }, e, 'MAIN').catch(() => 0);
    BS.bindHost(prev); return k;
  });
  assert.ok(n >= 1, String(n));
});
test('EM01 12 emoticons; one every 30 s; the picker shows the wait', async () => {
  await clear();
  const r = await page.evaluate(() => {
    let t = 100000; BS.setEmoteClock(() => t);
    const a = BS.emoteSend(3), b = BS.emoteSend(4); t += 29000; const c = BS.emoteSend(4), left = BS.emoteLeft(); t += 1500; const d = BS.emoteSend(4);
    return [BS.EMOTES.length, a, b, c, left, d, document.querySelectorAll('#ae-fx .ae-emote').length];
  });
  assert.deepEqual(r, [12, true, false, false, 1, true, 2]);
});
test('EM02 the EMOTE button opens the picker and a pick shows the bubble', async () => {
  await clear();
  await page.evaluate(() => { BS.testSetup(); BS.setEmoteClock(() => 10 ** 9); });
  await page.click('[data-a="emote"]');
  assert.equal(await page.locator('#emote-pop button').count(), 12);
  await page.click('#emote-pop button >> nth=0');
  assert.equal(await page.locator('#ae-fx .ae-emote').count(), 1);
  assert.equal(await page.locator('#emote-pop').count(), 0);
});
