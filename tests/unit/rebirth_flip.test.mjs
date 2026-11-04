// 2026-11-01: Rebirth Side B is display only (sidecar data/index/rebirth-sides.json): a flip button on the Library card page
// and the card detail modal; the back faces never become cards, so counts, decks and matches are untouched.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

after(closeBrowser);
const sides = JSON.parse(readFileSync(join(ROOT, 'data/index/rebirth-sides.json'), 'utf8'));
const ids = Object.keys(sides);

test('RF-01 every Rebirth front has a Side B record that carries its own id and text', () => {
  assert.ok(ids.length >= 200, String(ids.length));
  for (const f of ids) {
    const s = sides[f];
    // a reprint (PB14-X01, SD52-005, SD52-009) carries the back of the print it copies: its Side B id is that print's, and that print has its own record
    if (s.id !== f + 'B') assert.ok(sides[s.id.replace(/B$/, '')] && sides[s.id.replace(/B$/, '')].id === s.id, f);
    assert.equal(s.rebirthSide, true, f);
    assert.ok(s.name && s.type && s.text, f);
  }
});

async function open() {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(GAME_URL);
  await page.waitForFunction(() => !!window.BS && typeof openCardPage === 'function');
  return { ctx, page };
}

test('RF-02 the card page flips Side A <-> Side B and the back is not a card', async () => {
  const { ctx, page } = await open();
  try {
    const f = ids[0], back = sides[f];
    const r = await page.evaluate(({ f }) => {
      const out = {};
      out.inCards = Object.keys(CARDS).some(k => CARDS[k].rebirthSide || /B$/.test(k) && CARDS[k.slice(0, -1)] && CARDS[k.slice(0, -1)].rebirthTo === k);
      openCardPage(f);
      out.a = document.querySelector('#cp-page').innerText;
      document.querySelector('#cp-page [data-a="cp-flip"]').click();
      out.b = document.querySelector('#cp-page').innerText;
      out.btnB = document.querySelector('#cp-page [data-a="cp-flip"]').innerText;
      document.querySelector('#cp-page [data-a="cp-flip"]').click();
      out.a2 = document.querySelector('#cp-page').innerText;
      return out;
    }, { f });
    assert.equal(r.inCards, false);
    assert.ok(r.a.includes('↻ Side B'), 'front shows a Side B button');
    assert.ok(r.b.includes(back.name) && r.b.includes('Rebirth Side B'));
    assert.match(r.btnB, /Side A/);
    assert.equal(r.a2, r.a);
  } finally { await ctx.close(); }
});

test('RF-03 the detail modal offers the flip on a library card and flips to Side A', async () => {
  const { ctx, page } = await open();
  try {
    const f = ids[0];
    const r = await page.evaluate(async f => {
      const wait = () => new Promise(r => setTimeout(r, 200)), flip = () => [...document.querySelectorAll('button')].find(b => /↻ Side [AB]/.test(b.innerText));
      showCardDetail(f, 'lib'); await wait();
      const first = flip() && flip().innerText; flip().click(); await wait();
      return { first, second: flip() && flip().innerText };
    }, f);
    assert.match(r.first, /Side B/); assert.match(r.second, /Side A/);
  } finally { await ctx.close(); }
});
