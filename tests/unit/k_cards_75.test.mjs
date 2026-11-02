// Lane K tests, file 75 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 11 (v0.203.0+): nine Magic clauses.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-538 data: the nine Magic cards carry their Main/Flash clause', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS10-100', 'BS10-114', 'BS03-136', 'BS03-140', 'BS10-109', 'BS03-123', 'BS20-077', 'BS07-068', 'BS25-075'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, !!(c.magic && c.magic.by)];
  }));
  assert.ok(r.length === 9 && r.every(x => x[1] === true && x[2] === true), JSON.stringify(r));
});

test('K-539 BS10-114 Main: destroys an opposing Brave Spirit only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const cast = async (id, timing) => { const m = BS.mkInst(id); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: BS.CARDS[id].magic.by[timing].actions }); };
    G.step = 4; G.active = P.key;
    const brave = BS.mkInst('BS12-051'); brave.cores = 1; O.spirits.push(brave);      // type Brave, Spirit condition
    const plain = window.SC.oppA;
    await cast('BS10-114', 'MAIN');
    return [O.spirits.includes(brave), O.spirits.includes(plain)];
  }, SPEC('magic-brave-brilliance'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-540 BS03-136 Main: draws a card for each Brilliance Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const cast = async (id, timing) => { const m = BS.mkInst(id); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: BS.CARDS[id].magic.by[timing].actions }); };
    G.step = 4; G.active = P.key;
    const h0 = P.hand.length;
    await cast('BS03-136', 'MAIN');
    return P.hand.length - h0;
  }, SPEC('magic-brave-brilliance'));
  assert.equal(r, 1, String(r));
});
