// Lane K tests, file 69 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 5 (v0.203.0+): BS13-022 and BS21-066 (VOID_TO_RESERVE.perLv, RETURN_TRASH.all).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-513 data: both cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS13-022', 'BS21-066'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS13-022', true, 'DESTROYED'], ['BS21-066', true, 'SUMMONED']], JSON.stringify(r));
});

test('K-514 BS13-022 (When Destroyed): cores equal to its level go from the Void to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.levelCores;
    G.step = 4; G.active = P.key;
    const lv = BS.lvNo(t), r0 = P.reserve.n;
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [lv, P.reserve.n - r0];
  }, SPEC('lv-cores-and-trash-all'));
  assert.deepEqual(r, [2, 2], JSON.stringify(r));
});

test('K-515 BS21-066 (When Summoned): all matching White/Blue Nexuses return from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const brave = BS.mkInst('BS21-066'); brave.cores = 1; P.spirits.push(brave);
    G.step = 4; G.active = P.key;
    await BS.fireFx(P, 'SUMMONED', brave);
    const inHand = P.hand.filter(x => ['26RBS01-092', 'BS44-X08'].includes(x.id)).length;
    return [inHand, P.trash.some(x => x.id === '26RBS01-004')];
  }, SPEC('lv-cores-and-trash-all'));
  assert.deepEqual(r, [2, true], JSON.stringify(r));
});
