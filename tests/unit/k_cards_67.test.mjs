// Lane K tests, file 67 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 3 (v0.203.0+): BS45-044 and BS12-051 (RETURN_TRASH with a family match).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-507 data: both cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS45-044', 'BS12-051'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS45-044', true, 'SUMMONED'], ['BS12-051', true, 'SUMMONED']], JSON.stringify(r));
});

test('K-508 BS45-044 (When Summoned): the Egyt Grandwalker Nexus returns from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.heqrot;
    G.step = 4; G.active = P.key;
    const inTrash = P.trash.some(x => x.id === 'BS44-X08');
    await BS.fireFx(P, 'SUMMONED', t);
    return [inTrash, P.hand.some(x => x.id === 'BS44-X08'), P.trash.some(x => x.id === 'BS44-X08')];
  }, SPEC('trash-family-return'));
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});

test('K-509 BS12-051 (When Summoned): an Astral Soul family Spirit returns from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const brave = BS.mkInst('BS12-051'); brave.cores = 1; P.spirits.push(brave);
    G.step = 4; G.active = P.key;
    const other0 = P.trash.some(x => x.id === '26RBS01-004');
    await BS.fireFx(P, 'SUMMONED', brave);
    return [P.hand.some(x => x.id === 'BS10-006'), other0, P.trash.some(x => x.id === '26RBS01-004')];
  }, SPEC('trash-family-return'));
  assert.deepEqual(r, [true, true, true], JSON.stringify(r));
});
