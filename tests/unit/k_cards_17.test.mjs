// Lane K tests, file 17 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 3 of v0.202.0: 26RBS03-041 (Palace Keeper, Relier), 26RDB01-041 (Cahlamy Tiboar), 26RSD10-010 (Bubble Trap).
// Engine piece: condition `oppExhaustedGe`; `REFRESH.noAttack` (the refreshed card can't attack this turn).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-315 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS03-041', '26RDB01-041', '26RSD10-010'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger + (e.once ? '*' : '')).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS03-041', 'ALLY_BATTLE_END*,ATTACKS', true],
    ['26RDB01-041', 'OPP_DIED*,ATTACKS', true],
    ['26RSD10-010', 'SUMMONED,ALLY_DIED', true],
  ], JSON.stringify(r));
});

test('K-316 26RBS03-041 (During Attack): the end of its battle draws only while it is refreshed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.relier;
    t.exhausted = false; G.attacker = t; G.battleNo = 3;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: t });
    const on = P.hand.length - h0;
    t.exhausted = true; G.battleNo = 4;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: t });
    return [on, P.hand.length - h0];
  }, SPEC('palace-relier-bubble-trap'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});

test('K-317 26RBS03-041 LV2 (When Attacks): with three Wollaguard cards it refreshes itself and cannot attack this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.relier;
    t.exhausted = true;
    await BS.fireFx(P, 'ATTACKS', t);
    const withoutThree = t.exhausted;
    for (const id of ['26RBS03-032', '26RBS03-034', '26RBS03-035']) { const w = BS.mkInst(id); w.cores = 1; P.spirits.push(w); }
    t.exhausted = true;
    await BS.fireFx(P, 'ATTACKS', t);
    return [withoutThree, t.exhausted, t.noAtkTurn === G.turnNo];
  }, SPEC('palace-relier-bubble-trap'));
  assert.deepEqual(r, [true, false, true], JSON.stringify(r));
});

test('K-318 26RDB01-041 (During Attack): refreshes itself when an opposing Cost 3 or less Spirit is destroyed and every card is Blue Beat', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.tiboar, small = window.SC.oppCost3;
    P.spirits = P.spirits.filter(s => ['26RDB01-041', '26RDB01-033', '26RDB01-036'].includes(s.id)); P.nexus = [];
    t.exhausted = true; G.step = 5;
    await BS.fireFx(P, 'OPP_DIED', null, { subject: small });
    const on = !t.exhausted;
    t.exhausted = true;
    const none = BS.mkInst('26RBS03-029'); none.cores = 1; P.spirits.push(none);      // an Abyssen card breaks "all your cards are Blue Beat"
    await BS.fireFx(P, 'OPP_DIED', null, { subject: small });
    return [on, t.exhausted];
  }, SPEC('palace-relier-bubble-trap'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-319 26RDB01-041 LV2 (When Attacks): destroys an opposing Cost 3 or less Spirit while the Soul Core is in the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.tiboar, small = window.SC.oppCost3;
    G.step = 5; P.reserve.soul = true;
    await BS.fireFx(P, 'ATTACKS', t);
    const on = !O.spirits.includes(small);
    const small2 = BS.mkInst('26RBS01-002'); small2.cores = 1; O.spirits.push(small2);
    P.reserve.soul = false;
    await BS.fireFx(P, 'ATTACKS', t);
    return [on, O.spirits.includes(small2)];
  }, SPEC('palace-relier-bubble-trap'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-320 26RSD10-010 (When Deployed): a Void core sits in the Trash only while the opponent controls three or more exhausted Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, n = window.SC.bubble;
    const void0 = P.void, trash0 = P.trashCores.n;
    await BS.fireFx(P, 'SUMMONED', n);
    const on = [void0 - P.void, P.trashCores.n - trash0];
    window.SC.oppC.exhausted = false;      // two exhausted opponents left
    await BS.fireFx(P, 'SUMMONED', n);
    return [on, trash0, P.trashCores.n];
  }, SPEC('palace-relier-bubble-trap'));
  assert.deepEqual(r, [[1, 1], 0, 1], JSON.stringify(r));
});

test('K-321 26RSD10-010 LV2 (Either Attack Step): exhausting itself lets it exhaust an opposing Cost 4 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, n = window.SC.bubble, target = window.SC.oppA;
    const ab = window.SC.abyssen;
    target.exhausted = false;                                   // a refreshed Cost 4 opposing Spirit is a legal target
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: ab });
    const first = [n.exhausted, target.exhausted];
    target.exhausted = false;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: ab });      // already exhausted: the cost can't be paid
    return [first, target.exhausted];
  }, SPEC('palace-relier-bubble-trap'));
  assert.deepEqual(r, [[true, true], false], JSON.stringify(r));
});
