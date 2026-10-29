// v0.185.0: CANT_BE_BLOCKED_BY all:true and the selfAttacking condition.
// rules: ETR:battle.block@d20adf64
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.hand = []; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V185-01 all:true makes the attacker unblockable for this battle only', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), d = sp('BS01-042', O, 1); G.attacker = a; G.battleNo = 3;
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, { all: true });
    const on = BS.blockedByMark(a, d); G.battleNo = 4; return [on, BS.blockedByMark(a, d)];`);
  assert.deepEqual(r, [true, false]);
});

test('V185-02 selfAttacking is true only for the current attacker', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), b = sp('BS01-042', P, 1); G.attacker = a;
    const f = s => BS.fxIf(P, O, { selfAttacking: true }, { selfInst: s }); return [f(a), f(b)];`);
  assert.deepEqual(r, [true, false]);
});
