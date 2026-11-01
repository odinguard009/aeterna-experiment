// Lane K tests, file 74 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 10 (v0.203.0+): extra symbols and two Magic Main clauses.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-534 data: the four cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const out = [];
    for (const id of ['BS22-010', 'BS25-044', 'BS02-103', 'BS01-138']) {
      const c = BS.CARDS[id];
      out.push([id, c.implemented === true, (c.effects || []).map(e => e.flag || e.trigger).join(','), !!(c.magic && c.magic.by && c.magic.by.MAIN)]);
    }
    return out;
  });
  assert.ok(r.every(x => x[1] === true), JSON.stringify(r));
  assert.ok(r[2][3] === true && r[3][3] === true, JSON.stringify(r));
});

test('K-535 BS22-010 and BS25-044 gain two extra White symbols in the Main Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, a = window.SC.boneDile, b = window.SC.gecko;
    G.step = 4; G.active = P.key;
    const sym = s => BS.attackSymbols(s);
    const main = [sym(a), sym(b)];
    G.step = 5;
    const attack = [sym(a), sym(b)];
    return [main, attack];
  }, SPEC('magic-symbols'));
  assert.deepEqual(r, [[3, 3], [1, 1]], JSON.stringify(r));
});

test('K-536 BS02-103 Main: a Void core per Armed Machine Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.step = 4; G.active = P.key;
    const m = BS.mkInst('BS02-103');
    const r0 = P.reserve.n;
    await BS.runActions({ p: P, opp: G.p.opponent, src: m, ctx: {} }, { actions: BS.CARDS['BS02-103'].magic.by.MAIN.actions });
    return P.reserve.n - r0;
  }, SPEC('magic-symbols'));
  assert.equal(r, 1, String(r));
});

test('K-537 BS01-138 Main: the Hand is discarded and the opposing Hand size is drawn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.step = 4; G.active = P.key;
    P.hand = [BS.mkInst('26RBS01-004')];
    const m = BS.mkInst('BS01-138');
    await BS.runActions({ p: P, opp: G.p.opponent, src: m, ctx: {} }, { actions: BS.CARDS['BS01-138'].magic.by.MAIN.actions });
    return [P.hand.length, P.trash.filter(x => x.id === '26RBS01-004').length];
  }, SPEC('magic-symbols'));
  assert.deepEqual(r, [3, 1], JSON.stringify(r));
});
