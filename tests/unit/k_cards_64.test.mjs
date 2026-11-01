// Lane K tests, file 64 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 24 (Eternal): BS54-005 (DESTROY.ultimate), BS34-057 and BS11-041 (MILL_OPP).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-495 data: the three Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS54-005', 'BS34-057', 'BS11-041'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS54-005', true, 'ATTACKS,ATTACKS,SUMMONED'], ['BS34-057', true, 'ATTACKS'], ['BS11-041', true, 'DESTROYED']], JSON.stringify(r));
});

test('K-496 BS54-005 (When Summoned): destroys the opposing Ultimate, not a Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.iguanas, sp = window.SC.spirit;
    G.step = 5; G.active = P.key;
    const ult = BS.mkInst('BS24-058'); ult.cores = 1; O.spirits.push(ult);      // an Ultimate on the opposing field
    await BS.fireFx(P, 'SUMMONED', t);
    return [O.spirits.includes(ult), O.spirits.includes(sp)];
  }, SPEC('mill-and-ultimate'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-497 BS34-057 LV3 (When Attacks): discards 15 cards from the opposing decktop', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.wisdomKing;
    G.step = 5; G.active = P.key;
    const d0 = O.deck.length;
    await BS.fireFx(P, 'ATTACKS', t);
    return [d0 - O.deck.length, O.trash.length];
  }, SPEC('mill-and-ultimate'));
  assert.deepEqual(r, [15, 15], JSON.stringify(r));
});

test('K-498 BS11-041 (When Destroyed): discards two cards from the opposing decktop', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.clayGolem;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    const d0 = O.deck.length;
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [d0 - O.deck.length, O.trash.length];
  }, SPEC('mill-and-ultimate'));
  assert.deepEqual(r, [2, 2], JSON.stringify(r));
});
