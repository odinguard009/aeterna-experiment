// Lane K tests, file 22 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 8 of v0.202.0: 26RBS03-039 (Graburn) and 26RBS03-X11 (Cavaliare).
// Engine piece: trigger REFRESHED ("When this Spirit refreshes", fired by REFRESH / REFRESH_SPIRIT).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-344 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS03-039', '26RBS03-X11'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS03-039', 'REFRESHED,ATTACKS', true],
    ['26RBS03-X11', 'ALLY_BATTLE_END,ATTACKS', true],
  ], JSON.stringify(r));
});

test('K-345 26RBS03-039: when it refreshes, an opposing Cost 3 or less exhausted Spirit goes to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.graburn, small = window.SC.oppSmall;
    G.step = 5; G.active = P.key;
    t.exhausted = true;
    const deck0 = O.deck.length;
    await BS.fireFx(P, 'REFRESHED', t);           // the trigger itself (the source being refreshed is folded in by the action)
    return [O.spirits.includes(small), O.deck.length > deck0 || O.deck[O.deck.length - 1].id === '26RBS01-002'];
  }, SPEC('graburn-and-cavaliare'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-346 26RBS03-039 LV2: it can refresh itself and then cannot attack this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.graburn;
    G.step = 5; G.active = P.key;
    t.exhausted = true;
    await BS.fireFx(P, 'ATTACKS', t);
    return [t.exhausted, t.noAtkTurn === G.turnNo];
  }, SPEC('graburn-and-cavaliare'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-347 26RBS03-X11 (During Attack): the end of a refreshed White Spirit battle sends an opposing Cost 4 or less Spirit to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, ally = window.SC.whiteAlly, mid = window.SC.oppMid;
    ally.exhausted = false; G.attacker = ally; G.battleNo = 7;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: ally });
    const on = !O.spirits.includes(mid);
    ally.exhausted = true;                                  // an exhausted attacker: the clause is off
    const mid2 = BS.mkInst('26RBS01-004'); mid2.cores = 1; O.spirits.push(mid2);
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: ally });
    return [on, O.spirits.includes(mid2)];
  }, SPEC('graburn-and-cavaliare'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-348 26RBS03-X11 LV2: three Wollaguard cards let it refresh itself and it cannot attack this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.cavaliare;
    G.step = 5; G.active = P.key;
    P.spirits = P.spirits.filter(s => s === t);          // only one Wollaguard card: the clause is off
    t.exhausted = true;
    await BS.fireFx(P, 'ATTACKS', t);
    const without = [t.exhausted, t.noAtkTurn === G.turnNo];
    for (const id of ['26RBS03-034', '26RBS03-035', '26RBS03-038']) { const w = BS.mkInst(id); w.cores = 1; P.spirits.push(w); }
    await BS.fireFx(P, 'ATTACKS', t);
    return [without, t.exhausted, t.noAtkTurn === G.turnNo];
  }, SPEC('graburn-and-cavaliare'));
  assert.deepEqual(r, [[true, false], false, true], JSON.stringify(r));
});
