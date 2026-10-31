// Lane K tests, file 24 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 10 of v0.202.0: 26RBS03-060 (Ermineia).
// Engine piece: STATIC flag UNBLOCKABLE_LOW {bpLe} ("your Spirits can't be blocked by opposing N BP or less Spirits").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-354 data: the card carries its printed clauses and the new static flag', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RBS03-060'];
    return [c.implemented === true, (c.effects || []).map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(','), c.effects[1].bpLe];
  });
  assert.deepEqual(r, [true, 'ATTACKS,STATIC:UNBLOCKABLE_LOW', 3000], JSON.stringify(r));
});

test('K-355 26RBS03-060 (When Attacks): with every card Topaz and Cost 2/4/6/8, one opposing Spirit gets -5000 BP and is destroyed at 0', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.ermineia, target = window.SC.opp3000;
    G.step = 5; G.active = P.key;
    const bp0 = BS.bpOf(target);
    await BS.fireFx(P, 'ATTACKS', t);
    const ok = [bp0, !O.spirits.includes(target)];
    const off = BS.mkInst('26RBS01-004'); off.cores = 1; P.spirits.push(off);          // a non-Topaz Cost 4 Spirit breaks the condition
    const other = BS.mkInst('26RBS01-002'); other.cores = 1; O.spirits.push(other);
    await BS.fireFx(P, 'ATTACKS', t);
    return [ok, O.spirits.includes(other)];
  }, SPEC('ermineia'));
  assert.deepEqual(r, [[3000, true], true], JSON.stringify(r));
});

test('K-356 26RBS03-060 LV2: opposing 3000 BP or less blockers are skipped while the condition holds', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.ermineia;
    const low = BS.mkInst('26RBS01-001'); low.cores = 1; O.spirits.push(low);      // 2000 BP
    const high = BS.mkInst('26RBS01-003'); high.cores = 1; O.spirits.push(high);   // 4000 BP
    const on = [BS.unblockableLow(P, t, low), BS.unblockableLow(P, t, high)];
    const off = BS.mkInst('26RBS01-004'); off.cores = 1; P.spirits.push(off);          // condition broken: the flag is off
    return [on, BS.unblockableLow(P, t, low)];
  }, SPEC('ermineia'));
  assert.deepEqual(r, [[true, false], false], JSON.stringify(r));
});
