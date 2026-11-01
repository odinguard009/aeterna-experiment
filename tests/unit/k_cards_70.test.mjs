// Lane K tests, file 70 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 6 (v0.203.0+): the opposing-core moves of bundle 57.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-516 data: the five cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS10-020', 'BS36-013', 'BS16-017', 'BS15-013', 'BS50-014'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r.map(x => x[0] + ':' + x[2]), ['BS10-020:ATTACKS', 'BS36-013:SUMMONED,ATTACKS', 'BS16-017:SUMMONED', 'BS15-013:DESTROYED', 'BS50-014:DESTROYED'], JSON.stringify(r));
});

test('K-517 BS10-020 (When Attacks): one core per Astral Soul Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.astral;
    G.step = 5; G.active = P.key;
    const mate = BS.mkInst('BS10-006'); mate.cores = 1; P.spirits.push(mate);
    const total0 = O.spirits.reduce((n, s) => n + s.cores, 0), r0 = O.reserve.n;
    await BS.fireFx(P, 'ATTACKS', t);
    return [total0 - O.spirits.reduce((n, s) => n + s.cores, 0), O.reserve.n - r0];
  }, SPEC('opp-cores-five'));
  assert.deepEqual(r, [2, 2], JSON.stringify(r));
});

test('K-518 BS15-013 (When Destroyed): one core per colour on the opposing field', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.colors;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t), r0 = O.reserve.n;
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return O.reserve.n - r0;
  }, SPEC('opp-cores-five'));
  assert.equal(r, 2, String(r));
});

test('K-519 BS50-014 (When Destroyed, Soul Core on it): an opposing core goes to the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.soulDraw;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    const kill = soul => { P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1; t.soulLost = soul; };
    kill(false);
    const t0 = O.trashCores.n;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    const without = O.trashCores.n - t0;
    kill(true);
    const t1 = O.trashCores.n;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [without, O.trashCores.n - t1];
  }, SPEC('opp-cores-five'));
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});
