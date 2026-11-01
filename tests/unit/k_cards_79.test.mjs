// Lane K tests, file 79 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Schemas v256-v257: EXHAUST_OPP lv, CHOOSE_ONE. Cards: BS03-032, BS38-066, BS10-098.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

const run = async body => { const { page } = await sharedBoard(); return page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.count = 0; }
  const sp = (id, q, n) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const by = (src) => ({ p: O, src });
  ${body} })()`); };

test('K-804 EXHAUST_OPP lv: only the opposing LV1 Spirit is exhausted (BS03-032)', async () => {
  const r = await run(`const a = sp('BS03-032', P, 3); const c0 = BS.CARDS['BS09-001']; const lv1 = sp('BS09-001', O, c0.levels[0].cores), lv2 = sp('BS09-001', O, c0.levels[1].cores);
    const c = { p: P, opp: O, src: a, ctx: {} }; const act = { do: 'EXHAUST_OPP', n: 1, lv: 1 };
    const n = BS.FX_ACTIONS.EXHAUST_OPP.cands(c, act);
    return [n.length, n[0] === lv1, n.includes(lv2), BS.CARDS['BS03-032'].effects.length];`);
  assert.deepEqual(r, [1, true, false, 1], JSON.stringify(r));
});

test('K-805 CHOOSE_ONE: the CPU takes the first option (BS38-066 draws two); BS10-098 carries a Trash-return option', async () => {
  const r = await run(`const a = sp('BS38-066', P, 1); P.cpu = true; P.hand = []; P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    const act = BS.CARDS['BS38-066'].magic.by.MAIN.actions[0]; const c = { p: P, opp: O, src: a, ctx: {} };
    await BS.FX_ACTIONS.CHOOSE_ONE.run(c, act); return [P.hand.length, BS.CARDS['BS10-098'].magic.by.MAIN.actions[0].options[1][0].do];`);
  assert.deepEqual(r, [2, 'RETURN_TRASH'], JSON.stringify(r));
});
