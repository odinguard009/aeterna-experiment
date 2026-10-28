// v0.175.0: CANT_BE_BLOCKED_BY ("This Spirit can't be blocked by <colour> / LV<n> / High Speed Spirits", this battle only).
// rules: ETR:battle.block@d20adf64
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 10; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V175-01 colour: Green Spirits are skipped as blockers during this battle only', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), gr = sp('BS01-042', O, 1); G.attacker = a; G.battleNo = 5;
    const col = BS.CARDS[gr.id].colors || [BS.CARDS[gr.id].symbol];
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, { color: col });
    const during = BS.blockedByMark(a, gr); G.battleNo = 6; const next = BS.blockedByMark(a, gr);
    return [during, next];`);
  assert.deepEqual(r, [true, false]);
});

test('V175-02 levels: only the listed levels are skipped', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), d = sp('BS01-042', O, 1); G.attacker = a; G.battleNo = 2;
    const lv = BS.lvNo(d);
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, { levels: [lv] });
    const hit = BS.blockedByMark(a, d);
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, { levels: [lv === 1 ? 2 : 1] });
    return [hit, BS.blockedByMark(a, d)];`);
  assert.deepEqual(r, [true, false]);
});
