// Lane K tests, file 59 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 19 (Eternal): BS10-018 (EXHAUST_OPP.nexus) and BS34-033 (STATIC.perSymbolColors).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-477 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS10-018', 'BS34-033'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger + (e.bp ? ':' + e.bp : '')).join(',')];
  }));
  assert.deepEqual(r, [['BS10-018', true, 'DESTROYED'], ['BS34-033', true, 'STATIC:2000']], JSON.stringify(r));
});

test('K-478 BS10-018 (When Destroyed): exhausts up to three opposing Spirits and Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.kraken;
    G.step = 5; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [O.spirits.every(s => s.exhausted), O.nexus.every(s => s.exhausted)];
  }, SPEC('el-kraken-colors'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-479 BS34-033: +2000 BP for each symbol colour you have', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.colors;
    const two = BS.staticBp(t);
    const extra = BS.mkInst('26RBS01-031'); extra.cores = 1; P.spirits.push(extra);      // another colour (blue)
    const three = BS.staticBp(t);
    return [two, three];
  }, SPEC('el-kraken-colors'));
  assert.equal(r[1] - r[0], 2000, JSON.stringify(r));
});
