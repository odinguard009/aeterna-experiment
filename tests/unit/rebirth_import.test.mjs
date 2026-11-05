// 2026-11-01: Rebirth front faces imported as partial playable cards; the Library's default Complete
// filter must not hide them when the Rebirth chip is active, and the Deck Builder must filter them too.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

after(closeBrowser);
const cards = readdirSync(join(ROOT, 'data/cards')).filter(f => /^saga-\d+\.json$/.test(f))
  .flatMap(f => JSON.parse(readFileSync(join(ROOT, 'data/cards', f), 'utf8')));
const rebirth = cards.filter(c => c.rebirthTo);

test('RB-01 the Rebirth front cards are partial playable cards and point at a back id', () => {
  assert.ok(rebirth.length >= 200, String(rebirth.length));
  for (const c of rebirth) {
    if (c.fxComplete === true) { assert.ok(!c.residual, c.id); assert.match(c.rebirthTo, /^[A-Z0-9-]+B$/, c.id); continue; }      // v572 cards wired with REBIRTH_FLIP
    assert.equal(c.fxComplete, false, c.id);
    assert.ok(Array.isArray(c.residual) && c.residual.length > 0, c.id);
    assert.match(c.rebirthTo, /^[A-Z0-9-]+B$/, c.id);
    assert.equal(c.rebirthSide, undefined, c.id);
  }
});

test('RB-02 the Library and Deck Builder Rebirth chips show the imported cards', async () => {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  try {
    await page.goto(GAME_URL);
    await page.waitForFunction(() => !!window.BS);
    const r = await page.evaluate(() => {
      BS.switchView('view-library');
      LIBF.groups.add('rebirth'); LIBF.complete = true; renderLibrary();
      const lib = document.getElementById('lib-count').textContent;
      BS.switchView('view-deckbuilder');
      DBF.groups.add('rebirth'); DBF.status = ''; renderDeckBuilder();
      const db = document.getElementById('db-count').textContent;
      return { lib, db, first: BS.CARDS['BS55-051'] && BS.CARDS['BS55-051'].rebirthTo };
    });
    assert.match(r.lib, new RegExp(String(rebirth.length)));
    assert.match(r.db, new RegExp(String(rebirth.length)));
    assert.equal(r.first, 'BS55-051B');
  } finally {
    await ctx.close();
  }
});
