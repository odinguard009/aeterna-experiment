// Lane K tests, file 65 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 1 (v0.203.0+): BS10-089 and BS21-017 (new START_STEP trigger).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-499 data: both cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS10-089', 'BS21-017'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS10-089', true, 'START_STEP,OPP_DRAWS'], ['BS21-017', true, 'ALLY_LOST']], JSON.stringify(r));
});

test('K-500 BS10-089 (Your Start Step): an opposing Nexus returns to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.lake, nx = window.SC.oppNexus;
    G.step = 1; G.active = P.key;
    await BS.fireFx(P, 'START_STEP', t, { subject: t });
    return [O.nexus.includes(nx), O.hand.includes(nx)];
  }, SPEC('freezing-lake-valfared'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-501 BS10-089 LV2: draws outside the Draw Step on the opposing turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.lake;
    G.active = O.key; G.step = 4;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    const outside = P.hand.length - h0;
    G.step = 2;
    const h1 = P.hand.length;
    await BS.fireFx(P, 'OPP_DRAWS', null, { drawN: 1 });
    return [outside, P.hand.length - h1];
  }, SPEC('freezing-lake-valfared'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-502 BS21-017 (Either Attack Step): a destroyed Curse Spirit draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.valfared;
    G.step = 5; G.active = P.key;
    const curse = BS.mkInst('BS02-015'); curse.cores = 1; P.spirits.push(curse);
    const plain = BS.mkInst('26RBS01-005'); plain.cores = 1; P.spirits.push(plain);
    const h0 = P.hand.length;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: curse, byOpp: true });
    const on = P.hand.length - h0;
    const h1 = P.hand.length;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: plain, byOpp: true });      // no Curse keyword
    return [on, P.hand.length - h1];
  }, SPEC('freezing-lake-valfared'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});
