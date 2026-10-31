// Lane K tests, file 32 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 18 of v0.202.0: 26RBS02-X16 (Garaja) and 26RSD05-010 (Utmost Depth).
// Engine pieces: EXHAUSTED_FX.match, DESTROY.costLeSubj, SYMBOLS_ZERO_OPP {color, bpLe, pick}.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-389 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS02-X16', '26RSD05-010'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS02-X16', 'SUMMONED,EXHAUSTED_FX', true],
    ['26RSD05-010', 'OPP_START_ATTACK,OPP_DESTROYED_FX', true],
  ], JSON.stringify(r));
});

test('K-390 26RBS02-X16 (When Summoned): every Cyantree Nexus among the revealed cards goes to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.garaja;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'SUMMONED', t);
    return [P.hand.map(x => x.id).sort(), P.deck.map(x => x.id)];
  }, SPEC('garaja-and-utmost'));
  assert.deepEqual(r[0], ['26RBS01-107', '26RBS02-084'], JSON.stringify(r));
  assert.deepEqual(r[1], ['26RBS01-006', '26RBS01-004'], JSON.stringify(r));      // the unchosen revealed card goes to the bottom
});

test('K-391 26RBS02-X16 LV2: a Cyantree Spirit that is originally a Nexus exhausting destroys an opposing Spirit of equal or lower cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.garaja;
    G.step = 5; G.active = P.key;
    const as = BS.mkInst('26RBS01-106'); as.cores = 1; as.asSpirit = true; P.spirits.push(as);      // Cost 3 Nexus in Spirit form
    const small = window.SC.oppSmall, big = window.SC.oppBig;
    await BS.fireFx(P, 'EXHAUSTED_FX', null, { side: 'own', subject: as, fxSrc: t });
    return [!O.spirits.includes(small), O.spirits.includes(big)];      // Cost 1 dies, Cost 4 stays
  }, SPEC('garaja-and-utmost'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-392 26RSD05-010 LV1-2 (Start of the Opposing Attack Step): only opposing 1000 BP or less Spirits lose a symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.utmost, small = window.SC.oppSmall, big = window.SC.oppBig;
    G.step = 5; G.active = P.key;
    const before = [BS.attackSymbols(small), BS.attackSymbols(big)];
    await BS.fireFx(P, 'OPP_START_ATTACK', t);
    return [before, BS.attackSymbols(small), BS.attackSymbols(big), !!small.symZeroColor, !!big.symZeroColor];
  }, SPEC('garaja-and-utmost'));
  assert.deepEqual(r[1], r[0][0] - 1, JSON.stringify(r));      // the small Spirit lost one symbol
  assert.deepEqual(r[2], r[0][1], JSON.stringify(r));          // the bigger one is untouched
  assert.deepEqual(r[3], true, JSON.stringify(r));
  assert.deepEqual(r[4], false, JSON.stringify(r));
});

test('K-393 26RSD05-010 LV2 (Your Attack Step): destroying an opposing 0 BP Spirit with your effect draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.utmost;
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'OPP_DESTROYED_FX', null, { bp: 5000, fxSrc: t });      // not a 0 BP Spirit: nothing
    const off = P.hand.length - h0;
    await BS.fireFx(P, 'OPP_DESTROYED_FX', null, { bp: 0, fxSrc: t });
    return [off, P.hand.length - h0];
  }, SPEC('garaja-and-utmost'));
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});
