// Lane K tests, file 60 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 20 (Eternal): BS41-004, BS46-045 (BOUNCE_OPP.bpLeSelf), BS26-031.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-480 data: the three Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS41-004', 'BS46-045', 'BS26-031'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS41-004', true, 'ATTACKS,ATTACKS'], ['BS46-045', true, 'STATIC,ATTACKS'], ['BS26-031', true, 'DESTROYED']], JSON.stringify(r));
});

test('K-481 BS41-004 LV2 (When Attacks): destroys a 5000 BP or less Spirit, then draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.destroyer, small = window.SC.small;
    G.step = 5; G.active = P.key;
    const n0 = O.spirits.length, h0 = P.hand.length;
    P.cpu = true;                                   // deterministic target pick for the DESTROY cost
    try { await BS.fireFx(P, 'ATTACKS', t); } finally { P.cpu = false; }
    return [n0 - O.spirits.length, P.hand.length - h0];
  }, SPEC('bounce-and-diva'));
  assert.deepEqual(r, [1, 2], JSON.stringify(r));
});

test('K-482 BS46-045 LV2 (When Attacks/Blocks): returns an opposing Spirit with BP equal or inferior to its own', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.bouncer, small = window.SC.small, big = window.SC.big;
    G.step = 5; G.active = P.key;
    await BS.fireFx(P, 'ATTACKS', t);
    return [O.spirits.includes(small), O.spirits.includes(big)];
  }, SPEC('bounce-and-diva'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));      // only the Spirit not bigger than BS46-045 (2000 BP) returns
});

test('K-483 BS26-031 (When Destroyed by the opponent): draws two with a Diva family Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.diva;
    G.step = 5; G.active = P.key;
    // the scenario already keeps a Diva family Spirit (BS24-042) on the field
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return P.hand.length - h0;
  }, SPEC('bounce-and-diva'));
  assert.equal(r, 2, String(r));
});
