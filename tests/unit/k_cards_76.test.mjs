// Lane K tests, file 76 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 12 (v0.203.0 cycle close): five Magic Main clauses.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-541 data: the five Magic cards carry their Main clause', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS31-099', 'BS05-080', 'BS06-092', 'BS40-079', 'BS14-106'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, !!(c.magic && c.magic.by && c.magic.by.MAIN)];
  }));
  assert.ok(r.length === 5 && r.every(x => x[1] === true && x[2] === true), JSON.stringify(r));
});

test('K-542 BS31-099 Main: two cards normally, three when the Soul Core paid the cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const cast = async (soul) => {
      const m = BS.mkInst('BS31-099'); m.soulPaid = soul;
      const h0 = P.hand.length;
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS31-099'].magic.by.MAIN.actions });
      return P.hand.length - h0;
    };
    G.step = 4; G.active = P.key;
    const plain = await cast(false);
    const soul = await cast(true);
    return [plain, soul];
  }, SPEC('magic-returns-five'));
  assert.deepEqual(r, [2, 3], JSON.stringify(r));
});

test('K-543 BS05-080 Main: exactly three Song Bird cards return from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const m = BS.mkInst('BS05-080');
    G.step = 4; G.active = P.key;
    P.trash = [BS.mkInst('BS01-052'), BS.mkInst('BS01-067'), BS.mkInst('BS12-051')];
    await BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: BS.CARDS['BS05-080'].magic.by.MAIN.actions });
    return [P.hand.filter(x => ['BS01-052', 'BS01-067'].includes(x.id)).length, P.trash.some(x => x.id === 'BS12-051')];
  }, SPEC('magic-returns-five'));
  assert.deepEqual(r, [2, true], JSON.stringify(r));
});
