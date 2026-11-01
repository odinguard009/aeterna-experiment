// Lane K tests, file 42 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 2 (Eternal): BS20-032 (Brigit) and BS17-020 (Giraffer) - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-424 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const b = BS.CARDS['BS20-032'], g = BS.CARDS['BS17-020'];
    return [b.implemented === true, b.effects.map(e => e.trigger + (e.bp ? ':' + e.bp : '')).join(','), g.implemented === true, g.effects.map(e => e.trigger).join(',')];
  });
  assert.deepEqual(r, [true, 'BLOCKS,STATIC:1000', true, 'DESTROYED'], JSON.stringify(r));
});

test('K-425 BS20-032: +1000 BP for each of your Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.brigit;
    const two = BS.staticBp(t);
    const extra = BS.mkInst('26RBS01-004'); extra.cores = 1; P.spirits.push(extra);
    const three = BS.staticBp(t);
    return [two, three];
  }, SPEC('brigit-giraffer'));
  assert.equal(r[1] - r[0], 1000, JSON.stringify(r));
});

test('K-426 BS17-020 (When Destroyed): an opposing Spirit is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.giraffer;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    const before = O.spirits.filter(s => s.exhausted).length;
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [before, O.spirits.filter(s => s.exhausted).length];
  }, SPEC('brigit-giraffer'));
  assert.equal(r[1] - r[0], 1, JSON.stringify(r));
});
