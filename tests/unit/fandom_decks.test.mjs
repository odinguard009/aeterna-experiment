// v0.41.3: green, purple and yellow deck cards compared with the Fandom export (issue #5). No browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const cards = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));
const by = id => cards.find(c => c.id === id);
const SRC = join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json');
const have = existsSync(SRC);
const F = have ? Object.fromEntries(JSON.parse(readFileSync(SRC, 'utf8')).cards.map(r => [r.id, r])) : {};
const DECKS = { green: 'green-hermes-lionheart', purple: 'purple-hades-sorcerer', yellow: 'yellow-indra-thunderive' };
const deckIds = fn => [...new Set(readFileSync(join(ROOT, `data/decks/${fn}.txt`), 'utf8').split('\n')
  .map(l => /^\s*\d+\s+(\S+)/.exec(l)).filter(Boolean).map(m => m[1]))];
// v0.44.6: Fandom's extra god icon on these cards is now in our data (BS68 confirmed on the official card list); tests in god_reduction.test.mjs.
// v0.186.0 (R1): the official card page wins over Fandom for level BP / cores; ids listed here differ from Fandom on purpose.
const OFFICIAL_LEVELS = ['BS75-001', 'BS68-012'];
const GOD_FIXED = ['BS70-072', 'BS69-025', 'BS69-029', 'BS70-034', 'BS69-030', 'BS70-035', 'BS70-X03', 'BS69-033', 'BS68-014', 'BS68-016', 'BS68-018', 'BS68-020', 'BS68-022', 'BS68-NX01'];

for (const [col, fn] of Object.entries(DECKS)) {
  const ids = deckIds(fn);
  test(`${col} deck: every card exists in the game data`, () => { for (const id of ids) assert.ok(by(id), id); });
  test(`${col} deck: every card has the ${col} colour`, () => { for (const id of ids) assert.equal(by(id).color, col, id); });
  test(`${col} deck: cost, level cores/BP and families agree with Fandom (skipped without data/sources)`, { skip: !have }, () => {
    for (const id of ids) {
      const c = by(id), r = F[id];
      assert.ok(r, `${id} missing in Fandom`);
      assert.equal(c.cost, r.cost, `${id} cost`);
      assert.deepEqual([...c.families].sort(), [...(r.families || [])].sort(), `${id} families`);
      if (r.levels && r.levels.length && !OFFICIAL_LEVELS.includes(id)) assert.deepEqual(c.levels.map(l => [l.cores, l.bp]), r.levels.map(l => [l.cores, l.bp]), `${id} levels`);
    }
  });
  test(`${col} deck: reduction (god icon included) equals Fandom's`, { skip: !have }, () => {
    for (const id of ids) assert.deepEqual(by(id).reduction || {}, F[id].reduction || {}, id);
  });
  test(`${col} deck: Fandom symbol count matches ours on Spirits`, { skip: !have }, () => {
    for (const id of ids.filter(i => by(i).type === 'Spirit')) {
      const s = F[id].symbols, n = typeof s === 'object' ? Object.values(s).reduce((a, b) => a + b, 0) : s;
      assert.equal(by(id).symbols, n, id);
    }
  });
}
test('yellow deck has no god-icon difference with Fandom', { skip: !have }, () => {
  for (const id of deckIds(DECKS.yellow)) assert.ok(!(F[id].reduction || {}).god, id);
});
test('the deck cards Fandom marks with a god icon are exactly the 14 fixed in v0.44.6', { skip: !have }, () => {
  const now = Object.keys(DECKS).flatMap(k => deckIds(DECKS[k])).filter(id => (F[id].reduction || {}).god);
  assert.deepEqual(now.sort(), [...GOD_FIXED].sort());
});
test('all 14 god-icon cards have a god reduction in our data', () => { for (const id of GOD_FIXED) assert.equal((by(id).reduction || {}).god, 1, id); });
test('god-icon cards are all green or purple', () => { for (const id of GOD_FIXED) assert.ok(['green', 'purple'].includes(by(id).color) && /Spirit|Brave|Nexus/.test(by(id).type), id); });
test('green deck has 17 distinct cards, purple 14, yellow 14', () => {
  assert.deepEqual(Object.values(DECKS).map(fn => deckIds(fn).length), [17, 14, 14]);
});
test('Hermes, Hades and Indra Contract Nexuses are cost-matched with Fandom', { skip: !have }, () => {
  for (const id of ['BS69-CX02', 'BS68-CX01', 'BS75-CX03']) assert.equal(by(id).cost, F[id].cost, id);
});
