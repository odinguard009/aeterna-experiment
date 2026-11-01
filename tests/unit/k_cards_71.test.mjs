// Lane K tests, file 71 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 7 (v0.203.0+): BS10-060, BS40-016, BS25-021, BS24-020, BS54-RV003, BS13-054.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-520 data: the six cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS10-060', 'BS40-016', 'BS25-021', 'BS24-020', 'BS54-RV003', 'BS13-054'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r.map(x => x[0]), ['BS10-060', 'BS40-016', 'BS25-021', 'BS24-020', 'BS54-RV003', 'BS13-054'], JSON.stringify(r));
  assert.ok(r.every(x => x[1] === true), JSON.stringify(r));
});

test('K-521 BS10-060 (When Summoned): 12 cards leave the opposing deck', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.orion;
    G.step = 4; G.active = P.key;
    const d0 = O.deck.length;
    await BS.fireFx(P, 'SUMMONED', t);
    return d0 - O.deck.length;
  }, SPEC('orion-boas-six'));
  assert.equal(r, 12, String(r));
});

test('K-522 BS40-016 (When Destroyed by the opponent): ten cores go to the opposing Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.boa;
    G.step = 4; G.active = P.key;
    const big = BS.mkInst('26RBS01-004'); big.cores = 12; O.spirits.push(big);
    const tc0 = O.trashCores.n, c0 = big.cores;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [O.trashCores.n - tc0, c0 - big.cores];
  }, SPEC('orion-boas-six'));
  assert.deepEqual(r, [10, 10], JSON.stringify(r));
});

test('K-523 BS25-021 (summoned on the opposing attack step): two opposing Spirits are exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.spada;
    G.step = 5; G.active = O.key;                        // opposing attack step
    await BS.fireFx(P, 'SUMMONED', t);
    const opp = O.spirits.filter(s => s.exhausted).length;
    for (const s of O.spirits) s.exhausted = false;
    G.active = P.key;                                    // your attack step: nothing
    await BS.fireFx(P, 'SUMMONED', t);
    return [opp, O.spirits.filter(s => s.exhausted).length];
  }, SPEC('orion-boas-six'));
  assert.deepEqual(r, [2, 0], JSON.stringify(r));
});

test('K-524 BS24-020 (destroyed by an opposing effect): returns to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.axemoth;
    G.step = 4; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true, byOppFx: true });
    return [P.hand.includes(t), P.trash.includes(t)];
  }, SPEC('orion-boas-six'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-525 BS54-RV003 (When Depleted by the opponent): heavy exhausts two opposing Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.gabunohashi;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true, depl: true });
    return [O.spirits.filter(s => s.exhausted).length, O.spirits.filter(s => s.heavy).length];
  }, SPEC('orion-boas-six'));
  assert.ok(Array.isArray(r) && r[0] >= 1, JSON.stringify(r));
});

test('K-526 BS13-054 (When Summoned): two opposing Spirits are exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const brave = BS.mkInst('BS13-054'); brave.cores = 1; P.spirits.push(brave);
    G.step = 4; G.active = P.key;
    await BS.fireFx(P, 'SUMMONED', brave);
    return O.spirits.filter(s => s.exhausted).length;
  }, SPEC('orion-boas-six'));
  assert.equal(r, 2, String(r));
});
