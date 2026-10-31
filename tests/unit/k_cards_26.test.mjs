// Lane K tests, file 26 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 12 of v0.202.0: 26RDB01-024 (Laura Byakuran) and 26RDB01-012 (Siegfreeda).
// Engine pieces: CORE_GIVE_ANY {match}, OPP_HAND_TO_BOTTOM {n}.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-363 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RDB01-024', '26RDB01-012'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RDB01-024', 'ALLY_BLOCKED,ALLY_LIFE_HIT', true],
    ['26RDB01-012', 'ALLY_BATTLE_END,DESTROYED', true],
  ], JSON.stringify(r));
});

test('K-364 26RDB01-024 LV1-2 (During Attack): blocked, it exhausts two opposing Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.laura;
    G.step = 5; G.active = P.key; G.attacker = t; G.battleNo = 3;
    await BS.fireFx(P, 'ALLY_BLOCKED', null, { subject: t });
    return O.spirits.filter(s => s.exhausted).length;
  }, SPEC('laura-and-siegfreeda'));
  assert.equal(r, 2, String(r));
});

test('K-365 26RDB01-024 LV2 (During Attack): paying two costs makes the opponent return a Hand card to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.laura;
    G.step = 5; G.active = P.key; G.attacker = t;
    const r0 = P.reserve.n, h0 = O.hand.length, d0 = O.deck.length;
    await BS.fireFx(P, 'ALLY_LIFE_HIT', null, { subject: t });
    return [r0 - P.reserve.n, h0 - O.hand.length, O.deck.length - d0];
  }, SPEC('laura-and-siegfreeda'));
  assert.deepEqual(r, [2, 1, 1], JSON.stringify(r));
});

test('K-366 26RDB01-012 LV1-2 (During Attack): at the end of battle the cores go to a Red Stella Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.siegfreeda, ally = window.SC.janeBow;
    G.step = 5; G.active = P.key; G.attacker = t; G.battleNo = 4;
    const c0 = t.cores, a0 = ally.cores;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: t });
    return [c0 - t.cores, ally.cores - a0];
  }, SPEC('laura-and-siegfreeda'));
  assert.deepEqual(r, [2, 2], JSON.stringify(r));
});

test('K-367 26RDB01-012 LV2 (When Destroyed by the Opponent): with every card Red Stella, a Trash core goes to Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.siegfreeda, laura = window.SC.laura;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t), t0 = P.trashCores.n, l0 = P.life;
    const kill = () => { P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1; };      // lostLv is 0-based (a destroyed card is off the Field)
    P.spirits = P.spirits.filter(s => s !== laura);              // only Red Stella cards remain
    kill();
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    const on = [t0 - P.trashCores.n, P.life - l0];
    P.spirits.push(laura);                                       // a Green Wave card breaks the condition
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [on, P.life - l0, t0 - P.trashCores.n];
  }, SPEC('laura-and-siegfreeda'));
  assert.deepEqual(r, [[1, 1], 1, 1], JSON.stringify(r));
});
