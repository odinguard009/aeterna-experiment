// v0.216.0 (owner): every Rebirth front flips (reprints use the original's Side B), the Magic reveal overlay, and the display-only hand order.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

after(closeBrowser);
async function open() {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(GAME_URL);
  await page.waitForFunction(() => !!window.BS && typeof rebirthSideOf === 'function' && typeof magicReveal === 'function');
  return { ctx, page };
}

test('U216-01 all Rebirth fronts, reprints included, have a Side B face', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(() => { const fr = Object.values(CARDS).filter(c => c.rebirthTo && !c.rebirthSide); return { n: fr.length, none: fr.filter(c => !rebirthSideOf(c.id)).map(c => c.id) }; });
  assert.ok(r.n >= 200, String(r.n));
  assert.deepEqual(r.none, []);
  await ctx.close();
});

test('U216-02 a Magic card reveal appears centred, never blocks taps, and removes itself', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const m = Object.values(CARDS).find(c => c.type === 'Magic' && !c.token);
    SETTINGS.anim = 'full'; magicReveal({ side: 'opponent', id: m.id });
    const e = document.querySelector('.ae-magic'), cs = e && getComputedStyle(e), cpu = !!(e && e.classList.contains('cpu'));
    return { shown: !!e, pe: cs && cs.pointerEvents, cpu };
  });
  assert.equal(r.shown, true); assert.equal(r.pe, 'none'); assert.equal(r.cpu, true);
  await page.waitForFunction(() => !document.querySelector('.ae-magic'), null, { timeout: 5000 });
  await ctx.close();
});

test('U216-03 hand order setting sorts by cost, type or both without touching the game hand', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(() => {
    const ids = Object.values(CARDS).filter(c => !c.token && !c.side).slice(0, 400);
    const pick = t => ids.filter(c => c.type === t).slice(0, 3);
    const hand = [...pick('Magic'), ...pick('Spirit'), ...pick('Nexus')].map((c, i) => ({ id: c.id, uid: 'u' + i }));
    const orig = hand.map(h => h.uid).join();
    const out = {};
    for (const m of ['off', 'cost', 'type', 'both']) { SETTINGS.handSort = m; out[m] = sortedHand(hand).map(h => [CARDS[h.id].cost, CARDS[h.id].type]); }
    delete SETTINGS.handSort;
    return { orig, after: hand.map(h => h.uid).join(), out };
  });
  assert.equal(r.orig, r.after);
  const costs = r.out.cost.map(x => x[0]); assert.deepEqual(costs, costs.slice().sort((a, b) => a - b));
  const rank = { Spirit: 0, Brave: 1, Ultimate: 2, Nexus: 3, Magic: 4 }, tys = r.out.type.map(x => rank[x[1]]); assert.deepEqual(tys, tys.slice().sort((a, b) => a - b));
  const both = r.out.both; for (let i = 1; i < both.length; i++) assert.ok(both[i - 1][0] < both[i][0] || (both[i - 1][0] === both[i][0] && rank[both[i - 1][1]] <= rank[both[i][1]]));
  await ctx.close();
});
