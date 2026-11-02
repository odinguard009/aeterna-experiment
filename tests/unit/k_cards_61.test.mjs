// Lane K tests, file 61 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 21 (Eternal): BS14-024 and BS20-043 - data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-484 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS14-024', 'BS20-043'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS14-024', true, 'END_STEP'], ['BS20-043', true, 'ALLY_LOST']], JSON.stringify(r));
});

test('K-485 BS14-024 (Your End Step): refreshes only when every Trash card is Green', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.pig;
    G.step = 6; G.active = P.key;
    t.exhausted = true;
    await BS.fireFx(P, 'END_STEP', t, { subject: t });
    const greenOnly = t.exhausted;
    P.trash.push(BS.mkInst('26RBS01-004'));           // a Red card enters the Trash
    t.exhausted = true;
    await BS.fireFx(P, 'END_STEP', t, { subject: t });
    return [greenOnly, t.exhausted];
  }, SPEC('endstep-and-beast'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-486 BS20-043: draws when an Imaginary Beast ally is destroyed by the opponent', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.kyuuki, other = window.SC.oppA;
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: t, byOpp: true });          // Kyuuki itself is an Imaginary Beast ally
    const on = P.hand.length - h0;
    const h1 = P.hand.length;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: other, byOpp: true });      // an opposing card: nothing
    return [on, P.hand.length - h1];
  }, SPEC('endstep-and-beast'));
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});
