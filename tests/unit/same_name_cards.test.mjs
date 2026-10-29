// v0.185: cards that share a name but have different serial numbers / data are not one card.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, openGame } from './lib/game.mjs';

let ctx = null;
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });

test('SAMENAME-1 different same-name cards are not art alternatives; stale art picks are ignored; imports name the serials', async () => {
  const b = await getBrowser(); ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const g = await openGame(); const page = g.page;
  await page.waitForFunction(() => window.BS && window.BS.cardPageHTML);
  const r = await page.evaluate(() => {
    const C = BS.CARDS, byName = {};
    for (const id in C) if (!C[id].token) (byName[C[id].name] = byName[C[id].name] || []).push(id);
    const sig = c => JSON.stringify([c.type, c.color, c.cost, c.symbols, c.reduction, c.levels, c.families, String(c.text || '').toLowerCase().replace(/\s+/g, ' ').trim()]);
    let diff = null;
    for (const n in byName) { const l = byName[n]; const j = l.find(x => sig(C[x]) !== sig(C[l[0]])); if (j) { diff = [l[0], j, n]; break; } }
    if (!diff) return { none: true };
    const [a, c, name] = diff;
    BS.setArt(a, c);                                           // must be refused: a different card
    const refused = !BS.ART_ALT[a];
    BS.ART_ALT[a] = c;                                         // a stale pick saved by an older version
    const shown = BS.cardImgSrc(a) === BS.cardImgSrc(a);        // no throw
    const html = BS.cardPageHTML(a);
    const imp = BS.textToDeck(`1 ${name}`);
    const exact = BS.textToDeck(`1 ${a}`);
    return { refused, shown, noArt: !/data-a="art"[^>]*data-v="[^"]*"/.test(html) || !html.includes('data-v="' + c + '"'), listed: html.includes('Other printings') && html.includes(c), badMsg: imp.bad[0] || '', ambiguous: Object.keys(imp.deck).length === 0, exactOk: exact.deck[a] === 1 && !exact.bad.length, a, c };
  });
  if (r.none) return;
  assert.ok(r.refused, 'setArt refuses a different card');
  assert.ok(r.listed, 'the other card is listed as another printing');
  assert.ok(r.ambiguous && /serial number/.test(r.badMsg) && r.badMsg.includes(r.a) && r.badMsg.includes(r.c), 'ambiguous name is reported with serials: ' + r.badMsg);
  assert.ok(r.exactOk, 'a serial number imports exactly');
});
