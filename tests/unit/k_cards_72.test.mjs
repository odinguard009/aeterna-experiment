// Lane K tests, file 72 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 8 (v0.203.0+): BS18-011, BS24-031, BS13-013, BS10-035.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-527 data: the four cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS18-011', 'BS24-031', 'BS13-013', 'BS10-035'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.ok(r.every(x => x[1] === true), JSON.stringify(r));
});

test('K-528 BS18-011 (When Destroyed): only the Ancient Dragon family Spirit is destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.dragonSlayer, anc = window.SC.ancient, other = window.SC.cheapOne;
    G.step = 4; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [O.spirits.includes(anc), O.spirits.includes(other)];
  }, SPEC('ancient-bounce-astral'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-529 BS24-031 (When Destroyed): every opposing Spirit with two or more symbols returns', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.bouncer, big = window.SC.twoSymbols, small = window.SC.cheapOne;
    G.step = 4; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [O.hand.includes(big), O.spirits.includes(small)];
  }, SPEC('ancient-bounce-astral'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-530 BS13-013 (When Summoned): one core from each opposing Cost 3 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.coreMover;
    const c1 = window.SC.cheapOne, c2 = window.SC.cheapTwo, keep = window.SC.ancient;
    G.step = 4; G.active = P.key;
    const [a0, b0, k0] = [c1.cores, c2.cores, keep.cores];
    await BS.fireFx(P, 'SUMMONED', t);
    return [a0 - c1.cores, b0 - c2.cores, k0 - keep.cores];
  }, SPEC('ancient-bounce-astral'));
  assert.deepEqual(r, [1, 1, 0], JSON.stringify(r));
});

test('K-531 BS10-035 (Your Astral Soul Spirits destroyed): a Void core goes to your Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.astralGain;
    G.step = 5; G.active = P.key;
    const mate = BS.mkInst('BS10-006'); mate.cores = 1; P.spirits.push(mate);
    const l0 = P.life;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: mate, byOpp: true });
    return [P.life - l0, mate];
  }, SPEC('ancient-bounce-astral'));
  assert.deepEqual(r[0], 1, JSON.stringify(r[0]));
});
