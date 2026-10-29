// v0.189.0 (R3): official Block icon, Rarity and Collab filters in the Deck Builder and the Library.
// The three card fields come from data/sources/official-fields.json (tools/apply_official.py).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

const grid = '#db-card-list .tile';

test('R3-01 rarity filter keeps only the picked rarity (full-width Ｃ is normalised to C)', async () => {
  const r = await g.page.evaluate((grid) => {
    BS.switchView('view-deckbuilder'); BS.dbResetFilters();
    const all = Object.values(BS.CARDS), want = all.filter(c => c.rcode === 'R').length;
    BS.DBF.rars = new Set(['R']); BS.renderDeckBuilder();
    const ids = [...document.querySelectorAll(grid)].map(c => c.dataset.v);
    BS.dbResetFilters();
    return { want, shown: ids.length, ok: ids.every(id => BS.CARDS[id].rcode === 'R'), fullwidth: all.filter(c => /[Ａ-Ｚ]/.test(c.rcode || '')).length };
  }, grid);
  assert.ok(r.want > 0 && r.ok);
  assert.equal(r.fullwidth, 0);
});

test('R3-02 block icon: an icon keeps only its cards, "No icon" only the cards without one', async () => {
  const r = await g.page.evaluate((grid) => {
    BS.dbResetFilters();
    const ids = v => { BS.DBF.icons = new Set([v]); BS.renderDeckBuilder(); return [...document.querySelectorAll(grid)].map(c => c.dataset.v); };
    const a = ids('A'), none = ids('none');
    BS.dbResetFilters();
    return { a: a.length, aOk: a.every(id => (BS.CARDS[id].bicon || []).includes('A')), none: none.length, noneOk: none.every(id => !(BS.CARDS[id].bicon || []).length) };
  }, grid);
  assert.ok(r.a > 0 && r.aOk && r.none > 0 && r.noneOk);
});

test('R3-03 collab filter, the Library menu and Clear follow', async () => {
  const r = await g.page.evaluate(() => {
    BS.dbResetFilters();
    const c = Object.values(BS.CARDS).find(x => (x.collab || []).length), name = c.collab[0];
    const want = Object.values(BS.CARDS).filter(x => (x.collab || []).includes(name)).length;
    BS.DBF.collabs = new Set([name]); BS.renderDeckBuilder();
    const n = document.querySelectorAll('#db-card-list .tile').length;
    const btn = document.querySelector('#db-groups [data-v="collab"]').textContent;
    BS.dbResetFilters();
    const libBtns = ['icon', 'rarity', 'collab'].map(k => { BS.switchView('view-library'); return !!document.querySelector(`#lib-groups [data-v="${k}"]`); });
    return { want, n, btn, cleared: BS.DBF.collabs.size === 0 && BS.DBF.rars.size === 0 && BS.DBF.icons.size === 0, libBtns };
  });
  assert.ok(r.want > 0 && r.n > 0 && r.n <= r.want);
  assert.match(r.btn, /Collab: /);
  assert.ok(r.cleared);
  assert.deepEqual(r.libBtns, [true, true, true]);
});
