// Lane K tests, file 43 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 3 (Eternal): BS32-010 (Soul Ogre) and BS12-035 (Phul).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-427 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const s = BS.CARDS['BS32-010'], p = BS.CARDS['BS12-035'];
    return [s.implemented === true, s.effects.map(e => e.trigger).join(','), p.implemented === true, p.effects.map(e => e.trigger).join(',')];
  });
  assert.deepEqual(r, [true, 'DESTROYED', true, 'DESTROYED'], JSON.stringify(r));
});

test('K-428 BS32-010 (When Destroyed): draws only when the Soul Core was on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.soulOgre;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    const kill = soul => { P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1; t.soulLost = soul; };
    kill(false);
    const h0 = P.hand.length;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    const off = P.hand.length - h0;
    kill(true);
    const h1 = P.hand.length;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [off, P.hand.length - h1];
  }, SPEC('soul-ogre-phul'));
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-429 BS12-035 (When Destroyed): a core goes to your Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.phul;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    const l0 = P.life, r0 = P.reserve.n;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [P.life - l0, r0 - P.reserve.n];
  }, SPEC('soul-ogre-phul'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});
