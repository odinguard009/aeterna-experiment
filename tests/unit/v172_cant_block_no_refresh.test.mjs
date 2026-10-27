// v0.172.0: CANT_BLOCK_OPP (targeted, this battle only) and NO_REFRESH_OPP (targeted exhausted Spirit skips the next opposing Refresh Step).
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

test('V172-01 CANT_BLOCK_OPP: the targeted Spirit can not block in this battle only', async () => {
  const r = await ev(`const a = sp('BS09-042', P, 3), d = sp('BS01-042', O, 1); G.attacker = a; G.battleNo = 5;
    const before = BS.canBlockState(O, d);
    await BS.FX_ACTIONS.CANT_BLOCK_OPP.run({ p: P, opp: O, src: a, ctx: {} }, {});
    const during = BS.canBlockState(O, d); G.battleNo = 6; const next = BS.canBlockState(O, d);
    return [before, during, next];`);
  assert.deepEqual(r, [true, false, true]);
});

test('V172-02 NO_REFRESH_OPP: needs an exhausted target; it skips exactly the next opposing Refresh Step', async () => {
  const r = await ev(`const a = sp('BS11-055', P, 1), d = sp('BS01-042', O, 1);
    const none = BS.FX_ACTIONS.NO_REFRESH_OPP.can({ p: P, opp: O, src: a, ctx: {} });
    d.exhausted = true;
    const ok = BS.FX_ACTIONS.NO_REFRESH_OPP.can({ p: P, opp: O, src: a, ctx: {} });
    await BS.FX_ACTIONS.NO_REFRESH_OPP.run({ p: P, opp: O, src: a, ctx: {} }, {});
    await BS.beginTurn('opponent'); const first = d.exhausted;
    d.noRefreshT = undefined; return [none, ok, first];`);
  assert.deepEqual(r, [false, true, true]);
  const s = await ev(`const a = sp('BS11-055', P, 1), d = sp('BS01-042', O, 1); d.exhausted = true;
    await BS.FX_ACTIONS.NO_REFRESH_OPP.run({ p: P, opp: O, src: a, ctx: {} }, {});
    await BS.beginTurn('opponent'); const first = d.exhausted; await BS.beginTurn('opponent'); return [first, d.exhausted];`);
  assert.deepEqual(s, [true, false]);
});
