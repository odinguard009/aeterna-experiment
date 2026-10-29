// v0.188.0 (R2): Family list (any / all), colour any / all, Level-1 BP ranges and top-level core counts
// in the Deck Builder and the Library; cards without BP drop out of the BP / core filters.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { if (g) await g.page.close(); await closeBrowser(); });


test('R2-01 colour "all" keeps only cards that carry every picked colour (any keeps the union)', async () => {
  const r = await g.page.evaluate(() => {
    BS.switchView('view-deckbuilder'); BS.dbResetFilters();
    const two = Object.values(BS.CARDS).find(c => BS.cardColors(c).length === 2 && !c.token), [a, b] = BS.cardColors(two);
    const ok = (all) => Object.values(BS.CARDS).filter(c => !c.token && BS.dbFilterOK(c, [a, b], [], [], all)).length;
    const both = Object.values(BS.CARDS).filter(c => !c.token && BS.cardColors(c).includes(a) && BS.cardColors(c).includes(b)).length;
    BS.DBF.colors = new Set([a, b]); BS.DBF.cmode = true; BS.renderDeckBuilder();
    const ids = [...document.querySelectorAll('#db-card-list .tile')].map(c => c.dataset.v);
    return { any: ok(false), all: ok(true), both, viaUi: ids.every(id => BS.cardColors(BS.CARDS[id]).includes(a) && BS.cardColors(BS.CARDS[id]).includes(b)) && ids.length > 0 };
  });
  assert.equal(r.all, r.both);
  assert.ok(r.any > r.all, 'any shows more than all');
  assert.ok(r.viaUi, 'the Deck Builder grid obeys the mode');
});

test('R2-02 BP range and core count use Level 1 BP / top core; BP-less cards drop out', async () => {
  const r = await g.page.evaluate(() => {
    BS.dbResetFilters(); BS.DBF.bps = new Set(['4']); BS.renderDeckBuilder();   // 10,000+
    const ids = [...document.querySelectorAll('#db-card-list .tile')].map(c => c.dataset.v);
    BS.dbResetFilters(); BS.DBF.cores = new Set(['0']); BS.renderDeckBuilder();   // <= 2
    const lo = [...document.querySelectorAll('#db-card-list .tile')].map(c => c.dataset.v);
    BS.dbResetFilters();
    return { n: ids.length, big: ids.every(id => BS.CARDS[id].levels[0].bp >= 10000), lo: lo.length, loOk: lo.every(id => Math.max(...BS.CARDS[id].levels.map(l => l.cores || 0)) <= 2 && BS.CARDS[id].levels[0].bp != null) };
  });
  assert.ok(r.n > 0 && r.big && r.lo > 0 && r.loOk);
});

test('R2-03 Family list: any vs all, and the Library and Clear paths follow', async () => {
  const r = await g.page.evaluate(() => {
    BS.dbResetFilters();
    const f = Object.values(BS.CARDS).find(c => (c.families || []).length >= 2 && !c.token).families.slice(0, 2);
    BS.DBF.fams = new Set(f); BS.renderDeckBuilder();
    const any = [...document.querySelectorAll('#db-card-list .tile')].length;
    BS.DBF.ffall = true; BS.renderDeckBuilder();
    const ids = [...document.querySelectorAll('#db-card-list .tile')].map(c => c.dataset.v);
    const all = ids.length, allOk = ids.every(id => f.every(x => BS.CARDS[id].families.includes(x)));
    const btn = document.querySelector('#db-groups [data-v="family"]').textContent;
    document.querySelector('#db-groups [data-v="family"]').click();
    const hasSearch = !!document.querySelector('#db-tbar .ddmenu .ddq');
    BS.dbResetFilters();
    return { any, all, allOk, btn, hasSearch, cleared: BS.DBF.fams.size === 0 && !BS.DBF.ffall && !BS.DBF.dd };
  });
  assert.ok(r.all >= 1 && r.allOk && r.any >= r.all);
  assert.match(r.btn, /Family: 2 selected|Family: .*,/);
  assert.ok(r.hasSearch && r.cleared);
});
