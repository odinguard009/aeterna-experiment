// v0.119.0 deck builder: mechanic groupings (Mirage / Rebirth / all-colour / Legacy / EX symbol), card images in the
// deck list, an explicit Save button, and the Ultimate card-image fix. The Ultimate fix is the CSS cascade bug where
// `.tcg-card.ult`'s `background:` shorthand reset `.has-img`'s cover/center, so an Ultimate with art showed only its
// top-left corner; it is now `background-image:`, so cover/center win.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let g;
before(async () => { g = await openGame(''); });
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

test('DBG-01 the Group dropdown lists the mechanic groupings', async () => {
  const r = await g.page.evaluate(() => {
    BS.switchView('view-deckbuilder');
    document.querySelector('#db-groups .ddb').click();
    const labels = [...document.querySelectorAll('#db-tbar .ddmenu .ddi:not([data-a="db-ddclear"])')].map(b => b.textContent.replace('✓', '').trim());
    document.querySelector('#db-groups .ddb').click();
    const save = document.querySelectorAll('#view-deckbuilder [data-a="db-save"]').length;
    return { labels, save };
  });
  // v0.155.0 (owner review): All colour is the rainbow pip, Mirage and Rebirth sit with the types; Burst, True Release, Manifest, High Speed and Token are new groups
  assert.deepEqual(r.labels, ['Legacy', 'EX symbol', 'Burst', 'True Release', 'Manifest', 'High Speed', 'Token']);
  assert.equal(r.save, 1, 'a Save button in the deck panel actions');
});

test('DBG-02 an all-colour (rainbow) filter keeps only multi-colour cards', async () => {
  const r = await g.page.evaluate(() => {
    BS.DBF.groups = new Set(['multi']); BS.renderDeckBuilder();
    const ids = [...document.querySelectorAll('#db-card-list .tile')].map(c => c.dataset.v);
    const multi = ids.filter(id => BS.CARDS[id] && (BS.CARDS[id].colors || []).length > 1);
    return { n: ids.length, allMulti: ids.length > 0 && ids.every(id => (BS.CARDS[id].colors || []).length > 1), multi: multi.length };
  });
  assert.ok(r.n > 0, 'the rainbow filter shows cards');
  assert.ok(r.allMulti, 'every shown card has two or more colours');
});

test('DBG-03 the deck list rows carry a card thumbnail (image when available)', async () => {
  const r = await g.page.evaluate((png) => {
    BS.IMG['BS01-001'] = png;
    BS.dbChange('BS01-001', 1); BS.dbChange('BS24-058', 1);
    const rows = [...document.querySelectorAll('#db-dk-list .drow')];
    const every = rows.every(r => !!r.querySelector('.thumb'));
    const withImg = r => r.length > 0 && r[0].querySelector('.thumb img.cface') != null;
    const swatch = r => r.length > 0 && r[0].querySelector('.thumb img.cface') == null;
    const by = id => rows.filter(r => r.dataset.id === id);
    return { every, hasImg: withImg(by('BS01-001')), swatch: swatch(by('BS24-058')) };
  }, PNG);
  assert.equal(r.every, true, 'every deck row shows a thumbnail');
  assert.equal(r.hasImg, true, 'a loaded image renders art');
  assert.equal(r.swatch, true, 'no image falls back to a colour swatch');
});

test('DBG-04 a grid card with art shows the image on its tile', async () => {
  const r = await g.page.evaluate((png) => {
    BS.IMG['BS24-058'] = png;
    BS.DBF.types = new Set(['Ultimate']); BS.DBF.groups = new Set(); BS.renderDeckBuilder();
    const img = document.querySelector('#db-card-list .tile img.cface');
    return img && { src: img.src.slice(0, 40) };
  }, PNG);
  assert.ok(r, 'the Ultimate tile rendered with its art');
  assert.match(r.src, /data:image/);
});
