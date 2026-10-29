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
    return { sab: br('BS39-RV026'), sabOld: br('BS10-072'), kac: br('BS38-RV024'), ret: br('BS39-RV027'), pop: br('BS38-RV025'), burn: br('BS38-RV023'), beo: br('BS39-RV025'),
      fitLo: BS.braveFits({ id: 'BS38-RV025' }, lo), fitHi: BS.braveFits({ id: 'BS38-RV025' }, hi) };
  });
  assert.deepEqual(r.sab, { bp: 6000, costGe: 3 });
  assert.deepEqual(r.sabOld, { bp: 3000, costGe: 5 });
  assert.deepEqual(r.kac, { bp: 5000, costGe: 4 });
  assert.deepEqual(r.ret, { bp: 3000, costGe: 3 });
  assert.deepEqual(r.pop, { bp: 2000, costLe: 3 });
  assert.deepEqual(r.burn, { bp: 4000, costGe: 5 });
  assert.deepEqual(r.beo, { bp: 5000, costGe: 5 });
  assert.equal(r.fitLo, true);
  assert.equal(r.fitHi, false);
});

test('NEXUS-RV level thresholds follow the printed card, not the original', async () => {
  const b = await getBrowser(); const c2 = await b.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const g = await openGame(); const page = g.page;
    await page.waitForFunction(() => window.BS && window.BS.CARDS);
    const lv2 = await page.evaluate(() => Object.fromEntries(
      ['BS38-RV026', 'BS38-RV030', 'BS38-RV031', 'BS38-RV034', 'BS38-RV035', 'BS39-RV028', 'BS39-RV030', 'BS39-RV031', 'BS39-RV033',
        'BS11-061', 'BS13-065', 'BS12-064', 'BS39-RV036'].map(i => [i, BS.CARDS[i].levels[1].cores])));
    assert.deepEqual(lv2, { 'BS38-RV026': 1, 'BS38-RV030': 1, 'BS38-RV031': 2, 'BS38-RV034': 2, 'BS38-RV035': 2, 'BS39-RV028': 2,
      'BS39-RV030': 3, 'BS39-RV031': 2, 'BS39-RV033': 1, 'BS11-061': 2, 'BS13-065': 3, 'BS12-064': 1, 'BS39-RV036': 3 });
  } finally { await c2.close(); }
});
