// v0.36.1 performance and size budgets. Limits are ~2x (size) to ~10x (time) above the v0.36.0 measurements
// (index.html 370 KB / 96 KB gzip, load 224 ms, render 6.6 ms, heap 10 MB), so only real regressions fail, not CI noise.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT, openGame, closeBrowser, getBrowser } from './lib/game.mjs';
import { srcParts } from '../../tools/src_parts.mjs';

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); assert.ok(i > 0 && j > i, a); return j - i; };
let g;
before(async () => { g = await openGame(''); });
after(async () => { await closeBrowser(); });

// v0.51.0: the pack is compressed (packages/engine/src/01a-card-pack.js) and grows with every promoted card, so the code budget
// (B01/B02) is measured without it and the pack has its own budget (B03, B13: all cards, 8,709 since v0.62.0).
const packLen = between('/*PACK_START*/', '/*PACK_END*/'), code = html.slice(0, html.indexOf('/*PACK_START*/')) + html.slice(html.indexOf('/*PACK_END*/'));
// v0.108.0 (M8 online client): raised 700 -> 725 KB (B01) and 200 -> 208 KB (B02) on purpose: the online client is a
// second board renderer in apps/web/src/13i-online.js (the offline renderer reads the live engine G; the online board
// reads the server's seat-filtered frames), so its HTML builders are new code, not dead weight.
// v0.109.0 (M8 part 2): raised 725 -> 730 KB (B01) on purpose: the online lobby + account panel (apps/web/src/13j-online-lobby.js
// plus the view-online template) are new client code beside the match terminal - the lobby, the private-room entry and
// the sign-in UI. B02 stays 208 KB (the same addition gzips well).
// v0.111.0 (card images): raised 730 -> 740 KB (B01) and 208 -> 212 KB (B02) on purpose: the Library browse grid
// (apps/web/src/14-images.js + the Library section of the template) is a windowed, searchable grid of every card - the
// card-images feature's browsable view. It reuses the deck builder's index and grid CSS but adds its own filter/window.
// v0.118.0 (Rumble keyword): raised 740 -> 745 KB (B01) on purpose: the RUMBLE action + KEYWORD_GLOSSARY entry are the
// first Standard keyword head of the K lane; a new mechanic is engine code, not dead weight.
// v0.121.0 (U14a): the three embedded UI fonts (SIL OFL Latin subsets, ~52 KB) have their own budget B14, so B01/B02/B04 measure the page without them.
// B01 raised 745 -> 750 KB on purpose in the same release: the U14a foundations CSS (tokens, parallelogram shape, soft light palette).
// v0.124.0 (U14d): raised 750 -> 760 KB on purpose: the Card Panel (U14b) and the arrow / shatter / exhaust-turn cues; U14e-U14i add more, each with a note.
// v0.128.0 (U14f): raised B01 760 -> 772 KB and B04 96 -> 100 KB on purpose: deck builder Redo, Test hand, card size, ring, hover peek (U14g-U14i add more).
// v0.125.0 (U14d2): B02 raised 212 -> 218 KB on purpose: the Effect Active panel, the emoticons and the 'effect' view record.
const FONT_URL = /url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\)/g, noFont = t => t.replace(FONT_URL, 'url()');
test('B01 index.html without the card pack stays under 772 KB', () => assert.ok(Buffer.byteLength(noFont(code)) < 772e3, Buffer.byteLength(noFont(code))));
test('B02 index.html without the card pack, gzipped, stays under 218 KB', () => { const n = gzipSync(noFont(code), { level: 9 }).length; assert.ok(n < 218e3, n); });
test('B03 the embedded card pack stays under 1.6 MB (room for all cards; never embed staging data)', () => assert.ok(packLen < 1.6e6, packLen));
// v0.93.0 (U6): raised 90 -> 96 KB on purpose (roadmap item U allows it with a note): U6-U8 add the My decks page and the
// deck builder restyle; unused rules were trimmed first in v0.92.0. The next raise needs the same kind of note.
test('B04 the stylesheet stays under 100 KB', () => {
  const css = (noFont(html).match(/<style[\s\S]*?<\/style>/g) || []).reduce((n, s) => n + s.length, 0);
  assert.ok(css < 100e3, css);
});
test('B05 the page has exactly one script and no external requests', () => {
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.doesNotMatch(html, /<(?:script|link|img)[^>]+(?:src|href)=["']https?:/);
});
test('B06 no base64 data URIs in the page except the three UI fonts', () => assert.doesNotMatch(html, /data:(?!font\/woff2;)[a-z0-9/+-]+;base64,/));
test('B14 the embedded fonts: exactly Oxanium, Saira, Orbitron, under 80 KB together', () => {
  const f = html.match(FONT_URL) || [];
  assert.equal(f.length, 3); assert.ok(f.reduce((n, u) => n + u.length, 0) < 80e3 * 4 / 3, f.length);
  for (const n of ['Oxanium', 'Saira', 'Orbitron']) assert.ok(html.includes('@font-face{font-family:"' + n + '"'), n);
});
test('B07 staging data (data/import) is never read by the build', () => {
  for (const f of ['tools/build.mjs', 'tools/build_cards.py']) assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /data\/import/, f);
});
test('B08 no script part grows past 60 KB (split it first)', () => {
  for (const p of srcParts(ROOT)) assert.ok(statSync(join(ROOT, p.rel)).size < 60e3, p.rel);
});
test('B09 the page is ready in under 3 s', async () => {
  const n = await g.page.evaluate(() => performance.getEntriesByType('navigation')[0].loadEventEnd);
  assert.ok(n < 3000, n);
});
test('B10 render() of a started match averages under 60 ms', async () => {
  const ms = await g.page.evaluate(() => { BS.startNewGame({ seed: 7 }); const t = performance.now(); for (let i = 0; i < 20; i++) BS.render(); return (performance.now() - t) / 20; });
  assert.ok(ms < 60, ms);
});
test('B11 JS heap after a started match stays under 80 MB', async () => {
  const mb = await g.page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize / 1e6 : 0);
  assert.ok(mb < 80, mb);
});
test('B12 starting a new match takes under 1.5 s', async () => {
  const ms = await g.page.evaluate(() => { const t = performance.now(); BS.startNewGame({ seed: 11 }); return performance.now() - t; });
  assert.ok(ms < 1500, ms);
});
// B13 (v0.51.0): the whole card list in the pack, phone layout, CPU slowed 4x (~ a mid-range phone; measured 2.3 s).
// Limit 4 s so only real regressions fail. v0.60.2: skipped in the quick loop (BS_QUICK), where parallel test files on a
// 2-core session machine gave 4-8 s for the same build; CI (npm test) still guards it. Skipped in the light clone without data/import.
test('B13 with all cards in the pack the phone layout is ready in under 4 s with no errors', { skip: (!existsSync(join(ROOT, 'data/import/saga-01.json')) && 'light clone without data/import') || (process.env.BS_QUICK && 'timing test: runs in CI (npm test), not in the parallel quick loop') }, async () => {
  const { buildParts } = await import('../../tools/build.mjs'), { projectedCards } = await import('../../tools/pack_size.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'bse-pack-')), file = join(dir, 'full.html');
  writeFileSync(file, buildParts({ cards: projectedCards() }).html);
  const b = await getBrowser(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
    await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(pathToFileURL(file).href); await page.waitForFunction(() => !!window.BS);
    const r = await page.evaluate(() => ({ ms: performance.getEntriesByType('navigation')[0].loadEventEnd, pack: BS.PACK_IDS.size, pc: BS.isPC() }));
    assert.deepEqual(errors, []); assert.equal(r.pc, false);
    assert.ok(r.pack > 6000, String(r.pack));
    assert.ok(r.ms < 4000, String(r.ms));
  } finally { await ctx.close(); rmSync(dir, { recursive: true, force: true }); }
});
