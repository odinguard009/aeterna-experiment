// v0.124.0 U14d: arrow attack, destroy shatter, and the exhaust / heavy exhaust turn (overlay + Web Animations only; Off plays none).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async () => { ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const count = sel => page.evaluate(s => document.querySelectorAll(s).length, sel);
const setup = mode => page.evaluate(m => {
  const G = BS.testSetup(), id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.isSpiritForm(BS.CARDS[i]));
  const a = BS.mkInst(id); a.cores = 1; G.p.player.spirits = [a]; const b = BS.mkInst(id); b.cores = 1; G.p.opponent.spirits = [b];
  window.__a = a; window.__b = b; BS.SETTINGS.anim = m; BS.fxCueReset(); BS.render(); return 1;
}, mode);

test('AN01 a destroyed card shows a flash and shards (Full), only the fade (Reduced), nothing (Off)', async () => {
  await open();
  for (const [mode, shards, flash] of [['full', 6, 1], ['reduced', 0, 0], ['off', 0, 0]]) {
    await page.evaluate(() => document.querySelectorAll('#ae-fx [class^="ae-a-"]').forEach(e => e.remove()));   // cues of the previous mode
    await setup(mode);
    await page.evaluate(() => { BS.G.p.opponent.spirits = []; BS.render(); return 1; });
    assert.equal(await count('#ae-fx .ae-a-card-shard'), shards, mode); assert.equal(await count('#ae-fx .ae-a-flash'), flash, mode);
  }
});
test('AN02 the attack shows an arrow (thick, with a head) in Full', async () => {
  await setup('full');
  await page.evaluate(() => { BS.G.attacker = window.__a; BS.render(); return 1; });
  assert.equal(await count('#ae-fx .ae-a-beam.arrow'), 1);
});
test('AN03 exhausting turns the card 90 degrees, heavy exhaust 180, through a Web Animation; Reduced and Off do not animate', async () => {
  await setup('full');
  const run = async (f) => { await page.evaluate(f); return page.evaluate(() => document.getAnimations().filter(x => x.effect && x.effect.target && x.effect.target.classList && x.effect.target.classList.contains('tcg-card')).map(x => x.effect.getKeyframes().map(k => k.transform).join('>'))); };
  assert.deepEqual(await run(() => { window.__a.exhausted = true; BS.render(); }), ['rotate(0deg)>rotate(90deg)']);
  await page.waitForTimeout(400);
  assert.deepEqual(await run(() => { window.__a.heavy = true; BS.render(); }), ['rotate(90deg)>rotate(180deg)']);
  await page.waitForTimeout(400);
  await page.evaluate(() => { BS.SETTINGS.anim = 'reduced'; window.__a.exhausted = false; window.__a.heavy = false; BS.render(); return 1; });
  assert.deepEqual(await page.evaluate(() => document.getAnimations().filter(x => x.effect && x.effect.target && x.effect.target.classList && x.effect.target.classList.contains('tcg-card')).length), 0);
});
