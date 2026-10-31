// Lane K tests, file 25 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 11 of v0.202.0: 26RBS02-085 (Surge of Tree Roots) and 26RBS02-X18 (Gaogazan).
// Engine pieces: match key `originalNexus`, STATIC flag LOW_ATK_ONCE {costLe}, NEXUS_AS_SPIRIT.n.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-357 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS02-085', '26RBS02-X18'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RBS02-085', 'STATIC:LOW_ATK_ONCE,ALLY_ATTACKS', true],
    ['26RBS02-X18', 'ALLY_BLOCKED,ALLY_BLOCKED,ATTACKS', true],
  ], JSON.stringify(r));
});

test('K-358 26RBS02-085 LV1-2: with every Nexus Cyantree the Cost 3 or less Spirits get one attack in total', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.step = 5; G.active = P.key;
    const on = BS.activeLowAtk();
    G.step = 4;                                   // not an Attack Step: off
    const offStep = BS.activeLowAtk();
    G.step = 5;
    const nonCyantree = BS.mkInst('26RBS03-078'); nonCyantree.cores = 0; P.nexus.push(nonCyantree);
    return [on, offStep, BS.activeLowAtk()];
  }, SPEC('surge-and-gaogazan'));
  assert.deepEqual(r, [3, 0, 0], JSON.stringify(r));
});

test('K-359 26RBS02-085 LV2: a Spirit that is originally a Nexus attacks, draws a card and returns one to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.step = 5; G.active = P.key;
    const att = BS.mkInst('26RBS01-106'); att.cores = 1; att.asSpirit = true; P.spirits.push(att);
    const top = P.deck[0], h0 = P.hand.length, d0 = P.deck.length;
    await BS.fireFx(P, 'ALLY_ATTACKS', null, { subject: att });
    return [P.hand.length - h0, P.deck.length - d0, P.deck[P.deck.length - 1].id === top.id];
  }, SPEC('surge-and-gaogazan'));
  assert.deepEqual(r, [0, 0, true], JSON.stringify(r));
});

test('K-360 26RBS02-X18 LV1-2: blocked itself, it destroys an opposing Cost 5 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.gaogazan, opp = window.SC.oppA;
    G.step = 5; G.active = P.key; G.attacker = t; G.blocker = window.SC.oppB; G.battleNo = 5;
    await BS.fireFx(P, 'ALLY_BLOCKED', null, { subject: t });
    return [O.spirits.includes(opp), O.spirits.length];
  }, SPEC('surge-and-gaogazan'));
  assert.deepEqual(r, [false, 1], JSON.stringify(r));
});

test('K-361 26RBS02-X18 LV1-2: a blocked Spirit that is originally a Nexus also triggers it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, opp = window.SC.oppB;
    G.step = 5; G.active = P.key;
    const att = BS.mkInst('26RBS01-107'); att.cores = 1; att.asSpirit = true; P.spirits.push(att);
    const n0 = O.spirits.length;
    G.attacker = att; G.blocker = window.SC.oppA; G.battleNo = 6;
    await BS.fireFx(P, 'ALLY_BLOCKED', null, { subject: att });
    return O.spirits.length;
  }, SPEC('surge-and-gaogazan'));
  assert.equal(r, 1, String(r));      // one of the two Cost 4/5 Spirits is destroyed
});

test('K-362 26RBS02-X18 LV2: two Cyantree Nexuses become LV1 5000 BP Spirits with a core from the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.gaogazan;
    G.step = 5; G.active = P.key;
    const n0 = P.nexus.length, r0 = P.reserve.n;
    await BS.fireFx(P, 'ATTACKS', t);
    const made = P.spirits.filter(s => s.asSpirit);
    return [n0 - P.nexus.length, made.length, made.map(s => BS.bpOf(s)).sort((a, b) => a - b), r0 - P.reserve.n];
  }, SPEC('surge-and-gaogazan'));
  assert.deepEqual(r[0], 2, JSON.stringify(r));
  assert.deepEqual(r[1], 2, JSON.stringify(r));
  assert.deepEqual(r[2], [5000, 7000], JSON.stringify(r));      // LV1 5000 BP / LV2 7000 BP (the Surge Nexus already had 3 cores)
});
