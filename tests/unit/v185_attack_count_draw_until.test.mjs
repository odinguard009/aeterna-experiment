// v0.185.0: if.firstAttack (owner attack counter), DRAW_UNTIL, CANT_BE_BLOCKED_BY bpLe/coresLe.
// rules: ETR:battle.block@d20adf64
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.hand = []; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V185-01 firstAttack is true on the first attack of the turn only', async () => {
  const r = await ev(`const f = n => { P.attacksThisTurn = n; return BS.fxIf(P, O, { firstAttack: true }, {}) + '/' + BS.fxIf(P, O, { firstAttack: false }, {}); };
    return [f(1), f(2)];`);
  assert.deepEqual(r, ['true/false', 'false/true']);
});

test('V185-02 DRAW_UNTIL tops the Hand up to n and draws nothing above it', async () => {
  const r = await ev(`const run = async n => { await BS.FX_ACTIONS.DRAW_UNTIL.run({ p: P, opp: O, src: sp('BS01-035'), ctx: {} }, { n }); return P.hand.length; };
    const a = await run(3), b = await run(2); return [a, b];`);
  assert.deepEqual(r, [3, 3]);
});

test('V185-03 CANT_BE_BLOCKED_BY bpLe / coresLe skip small blockers', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), d = sp('BS01-042', O, 1); G.attacker = a; G.battleNo = 4;
    const out = []; const run = x => BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, x);
    await run({ bpLe: BS.bpOf(d) }); out.push(BS.blockedByMark(a, d));
    await run({ bpLe: BS.bpOf(d) - 1 }); out.push(BS.blockedByMark(a, d));
    await run({ coresLe: 1 }); out.push(BS.blockedByMark(a, d));
    await run({ coresLe: 0 }); out.push(BS.blockedByMark(a, d));
    return out;`);
  assert.deepEqual(r, [true, false, true, false]);
});
