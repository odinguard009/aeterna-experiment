// Lane K tests, file 47 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 7 (Eternal): BS11-011 and BS10-040 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-439 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS11-011', 'BS10-040'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger + (e.bp ? ':' + e.bp : '')).join(',')];
  }));
  assert.deepEqual(r, [['BS11-011', true, 'DESTROYED'], ['BS10-040', true, 'STATIC:3000,STATIC:1000']], JSON.stringify(r));
});

test('K-440 BS11-011 LV2 (When Destroyed): one core each from two opposing Spirits goes to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.twoCores;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t), total = O.spirits.reduce((n, x) => n + x.cores, 0), r0 = O.reserve.n;
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [total - O.spirits.reduce((n, x) => n + x.cores, 0), O.reserve.n - r0];
  }, SPEC('two-cores-fish'));
  assert.deepEqual(r, [2, 2], JSON.stringify(r));
});

test('K-441 BS10-040: +1000 BP for each Flying Fish family Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.fish;
    const one = BS.staticBp(t);
    const mate = BS.mkInst('BS10-040'); mate.cores = 1; P.spirits.push(mate);      // a second Flying Fish
    const two = BS.staticBp(t);
    return [one, two];
  }, SPEC('two-cores-fish'));
  assert.equal(r[1] - r[0], 1000, JSON.stringify(r));
});
