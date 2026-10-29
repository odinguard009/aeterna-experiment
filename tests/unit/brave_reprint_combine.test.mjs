// v0.185: reprint Braves carry their own printed combine data (checked against the official card images).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, openGame } from './lib/game.mjs';

let ctx = null;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('BRAVE-RV combine data differs from the original where the card prints it differently; "Cost N or less" works', async () => {
  const b = await getBrowser(); ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const g = await openGame(); const page = g.page;
  await page.waitForFunction(() => window.BS && window.BS.braveFits);
  const r = await page.evaluate(() => {
    const C = BS.CARDS, br = id => C[id].brave;
    const sp = n => Object.keys(C).find(i => C[i].type === 'Spirit' && C[i].cost === n);
    const lo = { id: sp(3) }, hi = { id: sp(4) };
    return { sab: br('BS39-RV026'), sabOld: br('BS10-072'), kac: br('BS38-RV024'), ret: br('BS39-RV027'), pop: br('BS38-RV025'),
      fitLo: BS.braveFits({ id: 'BS38-RV025' }, lo), fitHi: BS.braveFits({ id: 'BS38-RV025' }, hi) };
  });
  assert.deepEqual(r.sab, { bp: 6000, costGe: 3 });
  assert.deepEqual(r.sabOld, { bp: 3000, costGe: 5 });
  assert.deepEqual(r.kac, { bp: 5000, costGe: 4 });
  assert.deepEqual(r.ret, { bp: 3000, costGe: 3 });
  assert.deepEqual(r.pop, { bp: 2000, costLe: 3 });
  assert.equal(r.fitLo, true);
  assert.equal(r.fitHi, false);
});
