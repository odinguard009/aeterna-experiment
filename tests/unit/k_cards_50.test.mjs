// Lane K tests, file 50 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 10 (Eternal): BS75-001 and BS46-039 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-448 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS75-001', 'BS46-039'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger + (e.alsoDepleted ? ':depleted' : '')).join(',')];
  }));
  assert.deepEqual(r, [['BS75-001', true, 'ALLY_BLOCKED,STATIC'], ['BS46-039', true, 'DESTROYED:depleted']], JSON.stringify(r));
});

test('K-449 BS75-001 (Your Attack Step): a blocked Red Wurm draws two cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, wurm = window.SC.silverWurm, other = window.SC.other;
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'ALLY_BLOCKED', null, { subject: wurm });
    const on = P.hand.length - h0;
    const h1 = P.hand.length;
    await BS.fireFx(P, 'ALLY_BLOCKED', null, { subject: other });      // not a Wurm: nothing
    return [on, P.hand.length - h1];
  }, SPEC('wurm-draw-and-gecko'));
  assert.deepEqual(r, [2, 0], JSON.stringify(r));
});

test('K-450 BS46-039 (When Destroyed/Depleted by the Opponent): a Spirit you control refreshes', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.gecko, other = window.SC.other;
    G.step = 5; G.active = P.key;
    other.exhausted = true;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true, depl: true });
    return other.exhausted;
  }, SPEC('wurm-draw-and-gecko'));
  assert.equal(r, false, String(r));
});
