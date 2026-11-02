// Lane K tests, file 68 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 4 (v0.203.0+): BS34-063 and BS24-057 (VOID_TO_CARD.to subject, SPIRIT_DIED).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-510 data: both cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS34-063', 'BS24-057'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS34-063', true, 'OPP_DRAWS,ALLY_BATTLE_WIN'], ['BS24-057', true, 'SPIRIT_DIED']], JSON.stringify(r));
});

test('K-511 BS34-063: the opponent draw refreshes a Spirit, and the Blade Beast BP win puts two Void cores on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.cedar, blade = window.SC.blade, watcher = window.SC.watcher;
    G.step = 5; G.active = P.key;
    watcher.exhausted = true;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    const refreshed = watcher.exhausted;
    const c0 = blade.cores;
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: blade });
    return [refreshed, blade.cores - c0];
  }, SPEC('cedar-and-cost8'));
  assert.deepEqual(r, [false, 2], JSON.stringify(r));
});

test('K-512 BS24-057 (Your Attack Step): a destroyed Cost 8+ Spirit refreshes it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.watcher;
    G.step = 5; G.active = P.key;
    const low = BS.mkInst('26RBS01-004'); low.cores = 1; P.spirits.push(low);      // Cost 4: below the window
    t.exhausted = true;
    await BS.fireFx(P, 'SPIRIT_DIED', null, { subject: low });
    const afterLow = t.exhausted;
    const high = BS.mkInst('BS01-025'); high.cores = 1; P.spirits.push(high);      // Cost 8: inside the window
    t.exhausted = true;
    await BS.fireFx(P, 'SPIRIT_DIED', null, { subject: high });
    return [afterLow, t.exhausted];
  }, SPEC('cedar-and-cost8'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});
