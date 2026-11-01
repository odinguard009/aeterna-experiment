// Lane K tests, file 78 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Schema v247: STATIC UNAFFECTED from.costLe (number | "self" | "counters"). Cards: BS75-035, BS75-041.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

const run = async body => { const { page } = await sharedBoard(); return page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.count = 0; }
  const sp = (id, q, n) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const by = (src) => ({ p: O, src });
  ${body} })()`); };

test('K-780 BS75-041 LV2: unaffected by opposing effects of Cost 9 or less (its own cost), not by a higher one', async () => {
  const r = await run(`const t = sp('BS75-041', P, 3); const lo = sp('BS75-001', O, 1), eq = sp('BS75-041', O, 3), hi = sp('BS75-013', O, 1);
    const cheap = BS.fxImmune(P, t, by(lo)), same = BS.fxImmune(P, t, by(eq));
    BS.CARDS['BS75-013'].cost = 10; const high = BS.fxImmune(P, t, by(hi)); BS.CARDS['BS75-013'].cost = 8; return [cheap, same, high];`);
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});

test('K-781 BS75-041 at LV1 (1 core) is not protected', async () => {
  const r = await run(`const t = sp('BS75-041', P, 1); const lo = sp('BS75-001', O, 1); return BS.fxImmune(P, t, by(lo));`);
  assert.equal(r, false);
});

test('K-782 BS75-035 LV2: Awakened Dragon Spirits are unaffected by opposing Spirit effects up to the counter count', async () => {
  const r = await run(`const a = sp('BS75-035', P, 3), ally = sp('BS75-041', P, 3); P.count = 5;
    const s5 = sp('BS75-011', O, 1), s8 = sp('BS75-013', O, 1);
    const out = [BS.fxImmune(P, a, by(s5)), BS.fxImmune(P, ally, by(s5)), BS.fxImmune(P, a, by(s8))]; P.count = 8; out.push(BS.fxImmune(P, a, by(s8))); P.count = 0; out.push(BS.fxImmune(P, a, by(s5))); return out;`);
  assert.deepEqual(r, [true, true, false, true, false], JSON.stringify(r));
});

test('K-783 BS75-035 does not protect a non-Awakened-Dragon Spirit', async () => {
  const r = await run(`const a = sp('BS75-035', P, 3), other = sp('BS75-011', P, 3); P.count = 9; return BS.fxImmune(P, other, by(sp('BS75-001', O, 1)));`);
  assert.equal(r, false);
});

test('K-784 data: both cards carry the new from.costLe filter', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS75-035', 'BS75-041'].map(i => { const c = BS.CARDS[i]; const e = c.effects.find(x => x.flag === 'UNAFFECTED'); return [true, e && e.from.costLe]; }));
  assert.deepEqual(r, [[true, 'counters'], [true, 'self']], JSON.stringify(r));
});

test('K-785 BS72-050 REVEAL_DEPLOY rest either: the CPU sends the unused revealed cards to the deckbottom', async () => {
  const r = await run(`P.cpu = true; P.deck = []; for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst('BS75-001')); P.deck.push(BS.mkInst('BS75-004'));
    const s = sp('BS72-050', P, 3); const top0 = P.deck[0].id;
    await BS.FX_ACTIONS.REVEAL_DEPLOY.run({ p: P, opp: O, src: s, ctx: {} }, { n: 4, match: { family: ['Scalostle'] }, pay: false, rest: 'either' });
    return [P.deck.length, P.deck[P.deck.length - 1].id, P.deck[0].id === top0];`);
  assert.deepEqual(r, [5, 'BS75-001', false], JSON.stringify(r));
});
