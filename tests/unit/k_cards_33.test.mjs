// Lane K tests, file 33 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 19 of v0.202.0: 26RBS02-083 (Cactus Wall).
// Engine pieces: condition idle, STATIC ZERO_BP_DECKBOTTOM read in removeSpirit.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-394 data: Cactus Wall carries both printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RBS02-083'];
    return [c.implemented === true, c.effects.map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(',')];
  });
  assert.deepEqual(r, [true, 'STATIC:ZERO_BP_DECKBOTTOM,ALLY_LOST'], JSON.stringify(r));
});

test('K-395 26RBS02-083 LV1-2: an opposing Cost 5 or less Spirit destroyed at 0 BP returns to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.wall, opp = window.SC.oppA;
    G.step = 5; G.active = P.key; G.evQ = []; G.fxBy = P.key;
    opp.bpMod = -BS.bpOf(opp);                            // 0 BP when it is destroyed
    const d0 = O.deck.length;
    BS.removeSpirit(O, opp, 'destroyed', P.key);
    const on = [O.spirits.includes(opp), O.trash.includes(opp), O.deck.includes(opp), O.deck.length - d0];
    const big = BS.mkInst('26RBS01-023'); big.cores = 1; O.spirits.push(big);      // Cost 5 or less? 26RBS01-023 is Cost 5
    G.step = 4;                                                                    // outside your Attack Step the flag is off
    const opp2 = BS.mkInst('26RBS01-004'); opp2.cores = 1; opp2.bpMod = -BS.bpOf(opp2); O.spirits.push(opp2);
    BS.removeSpirit(O, opp2, 'destroyed', P.key);
    return [on, O.trash.includes(opp2)];
  }, SPEC('cactus-wall'));
  assert.deepEqual(r[0], [false, false, true, 1], JSON.stringify(r));
  assert.equal(r[1], true, JSON.stringify(r));
});

test('K-396 26RBS02-083 LV2: a destroyed non-attacking Topaz Spirit draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.topaz;
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: t, byOpp: true });      // idle Spirit: draw
    const on = P.hand.length - h0;
    G.attacker = t;                                                          // the attacker itself: no draw
    const h1 = P.hand.length;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: t, byOpp: true });
    return [on, P.hand.length - h1];
  }, SPEC('cactus-wall'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});
