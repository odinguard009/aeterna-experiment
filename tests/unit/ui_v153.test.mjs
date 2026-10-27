// v0.153.0 mockup parity part 2: concede wording, New Deck chooser, richer bug report.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async (w, h) => { if (ctx) await ctx.close(); ctx = await (await getBrowser()).newContext({ viewport: { width: w, height: h } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); await page.evaluate(() => BS.testSetup()); };

after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('V153-1 concede dialog: loss/History wording; Keep Playing is the primary, Concede the red button', async () => {
  await open(1366, 768);
  await page.evaluate(() => { document.querySelector('[data-a="leave"]').click(); return 1; });
  const r = await page.evaluate(() => ({ t: document.getElementById('modal-card-desc').textContent, b: [...document.querySelectorAll('#action-modal .modal-btn')].map(b => b.textContent.trim() + ':' + b.className.replace('modal-btn', '').trim()) }));
  assert.match(r.t, /counts as a loss/); assert.match(r.t, /History/);
  assert.ok(r.b.some(x => /^Keep Playing:primary/i.test(x)) && r.b.some(x => /^Concede:danger/i.test(x)), JSON.stringify(r.b));
});
test('V153-2 New Deck asks Blank / starter / import; a starter copy lands in a new slot', async () => {
  await open(1366, 768);
  await page.evaluate(() => { BS.switchView('view-decks'); return 1; });
  await page.click('#view-decks [data-a="dk-new"]');
  const labels = await page.evaluate(() => [...document.querySelectorAll('#action-modal .modal-btn')].map(b => b.textContent.trim().toLowerCase()));
  assert.ok(labels.some(l => /blank/.test(l)) && labels.some(l => /starter/.test(l)) && labels.some(l => /import/.test(l)), labels.join('|'));
  await page.evaluate(() => [...document.querySelectorAll('#action-modal .modal-btn')].find(b => /starter/i.test(b.textContent)).click());
  await page.waitForFunction(() => /starter deck/i.test(document.getElementById('action-modal').textContent));
  await page.evaluate(() => document.querySelectorAll('#action-modal .modal-btn')[0].click());
  assert.equal(await page.evaluate(() => document.getElementById('view-deckbuilder').classList.contains('active')), true);
});
test('V153-3 bug report: display category, steps field, optional match log in the issue body', async () => {
  await open(1366, 768);
  const r = await page.evaluate(() => { const u = new URL(BS.bugURL('display', 'Overlap', 'Hand covers the field', true, 'view-playmat', '1. Start\n2. Tap hand', '- a\n- b')); return { b: u.searchParams.get('body'), l: u.searchParams.get('labels'), k: [...document.querySelectorAll('#bug-kind option')].map(o => o.value) }; });
  assert.match(r.b, /Steps to reproduce:\n1\. Start/); assert.match(r.b, /Recent match log:\n- a/); assert.equal(r.l, 'bug'); assert.ok(r.k.includes('display'));
  assert.ok(await page.evaluate(() => !!document.getElementById('bug-steps') && !!document.getElementById('bug-log')));
});
