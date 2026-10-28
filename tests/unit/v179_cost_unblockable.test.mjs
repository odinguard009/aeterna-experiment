// v0.179.0: CANT_BE_BLOCKED_BY costLe/costGe and the onlySymbols condition.
// rules: ETR:battle.block@d20adf64
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { openGame, closeBrowser, ROOT } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.hand = []; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V179-01 costLe skips blockers of that cost or less, costGe those of that cost or more', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), d = sp('BS01-042', O, 1); G.attacker = a; G.battleNo = 3;
    const c = BS.CARDS[d.id].cost; const out = [];
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, { costLe: c });
    out.push(BS.blockedByMark(a, d));
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, { costLe: c - 1 });
    out.push(BS.blockedByMark(a, d));
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, { costGe: c });
    out.push(BS.blockedByMark(a, d));
    return out;`);
  assert.deepEqual(r, [true, false, true]);
});

test('V179-02 compiler reads the cost-bound clause and "only White symbols"', () => {
  const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_v2 as c\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
  assert.deepEqual(py(`print(json.dumps(c.cond_of('there is only White symbols on your Field')))`), { onlySymbols: 'white' });
});
