// Lane K tests, file 49 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 9 (Eternal): BS41-038 and BS17-037 (match.keywordAny).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-445 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS41-038', 'BS17-037'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(','), JSON.stringify(c.effects.at(-1).actions[0].match || null)];
  }));
  assert.deepEqual(r[0].slice(0, 3), ['BS41-038', true, 'BLOCKS,DESTROYED'], JSON.stringify(r));
  assert.deepEqual(r[1].slice(0, 3), ['BS17-037', true, 'DESTROYED'], JSON.stringify(r));
  assert.ok(r[1][3].includes('keywordAny'), JSON.stringify(r));
});

test('K-446 BS41-038 (When Blocks): a Void core goes to one of your White Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.voidGiver, white = window.SC.whiteOne;
    G.step = 5; G.active = G.p.opponent.key;
    const isWhite = x => { const c = BS.CARDS[x.id]; return [].concat(c.colors || c.color || c.symbol || []).includes('white'); };
    const total = () => P.spirits.filter(isWhite).reduce((n, x) => n + x.cores, 0);
    const c0 = total(), v0 = P.void;
    await BS.fireFx(P, 'BLOCKS', t, { subject: t });
    return [total() - c0, v0 - P.void];
  }, SPEC('white-void-and-brilliance'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});

test('K-447 BS17-037 (When Destroyed): only a Brilliance/Evil Light Spirit refreshes', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.refresher, bri = window.SC.brilliance, white = window.SC.whiteOne;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    white.exhausted = true;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [bri.exhausted, white.exhausted];
  }, SPEC('white-void-and-brilliance'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});
