// Lane K tests, file 18 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 4 of v0.202.0: 26RSD06-013 (Stem Lance), 26RBS03-022 (Pisketona), 26RBS02-X15 (Ganothor).
// Engine pieces: condition `oppReserveGe`, card fields `reduceIf` + `reducePerOppReserve`, `DESTROY.ownNexusBump`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-322 data: the bundle cards carry their printed clauses and reduction fields', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RSD06-013', '26RBS03-022', '26RBS02-X15'].map(id => {
    const c = BS.CARDS[id];
    const acts = c.type === 'Magic' ? (c.magic.actions || []).map(a => a.do + (a.ownNexusBump ? '+' : '')) : (c.effects || []).map(e => e.trigger);
    return [id, acts.join(','), c.implemented === true, !!c.reduceIf, !!c.reducePerOppReserve];
  }));
  assert.deepEqual(r, [
    ['26RSD06-013', 'DESTROY+', true, false, false],
    ['26RBS03-022', 'ATTACKS', true, true, true],
    ['26RBS02-X15', 'ALLY_LIFE_HIT', true, true, false],
  ], JSON.stringify(r));
});

test('K-323 26RSD06-013 Flash: destroying your own Nexus raises the target cost so a Cost 6 Spirit is hit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, n = window.SC.ownNexus;
    P.nexus = [];                                              // no Nexus: the base Cost 4 limit misses the target
    const m1 = BS.mkInst('26RSD06-013'); P.hand.push(m1);
    await BS.castMagic(P, { inst: m1, target: null, plan: null, ctx: 'flash' });
    const without = O.spirits.some(s => s.id === '26RBS01-011');
    P.nexus = [n];
    const m2 = BS.mkInst('26RSD06-013'); P.hand.push(m2);
    await BS.castMagic(P, { inst: m2, target: null, plan: null, ctx: 'flash' });
    return [without, !P.nexus.includes(n), O.spirits.some(s => s.id === '26RBS01-011')];
  }, SPEC('stem-lance-and-reductions'));
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});

test('K-324 26RBS03-022 summon reduction: one symbol per core in the opposing Reserve while the Trash is all Purple', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, card = BS.CARDS['26RBS03-022'];
    O.reserve.n = 3; O.reserve.soul = false;
    const withPurple = BS.effCost(P, card);
    P.trash.push(BS.mkInst('26RBS01-002'));                  // a Red card breaks "all cards in your Trash are Purple"
    const without = BS.effCost(P, card);
    return [withPurple, without, withPurple < without];
  }, SPEC('stem-lance-and-reductions'));
  assert.deepEqual(r[2], true, JSON.stringify(r));
});

test('K-325 26RBS02-X15 summon reduction: a Yellow Magic card used this turn fulfils all its reduction symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, card = BS.CARDS['26RBS02-X15'];
    const before = BS.effCost(P, card);
    P.magicTurn = { turn: G.turnNo, cards: ['26RBS01-121'] };      // a Yellow (Topaz) Magic card
    const after = BS.effCost(P, card);
    return [before, after, after < before];
  }, SPEC('stem-lance-and-reductions'));
  assert.deepEqual(r[2], true, JSON.stringify(r));
});

test('K-326 26RBS02-X15 LV2 (During Attack): an opposing Life hit returns a Topaz Magic card from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.ganothor, magic = BS.mkInst('26RBS01-121');
    P.trash.push(magic); G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { attacker: t });
    return [P.hand.includes(magic), P.trash.includes(magic)];
  }, SPEC('stem-lance-and-reductions'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-327 26RBS03-022 (When Attacks): a core goes to the opposing Reserve and the third core draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, opp = window.SC.oppCost6;
    const m = BS.mkInst('26RBS03-022'); m.cores = 1; P.spirits.push(m);
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length, res0 = O.reserve.n, cores0 = opp.cores;
    await BS.fireFx(P, 'ATTACKS', m);
    return [res0, O.reserve.n, cores0, opp.cores, P.hand.length - h0];
  }, SPEC('stem-lance-and-reductions'));
  assert.deepEqual(r, [3, 4, 2, 1, 1], JSON.stringify(r));
});
