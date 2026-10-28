// v0.183.0: Windstorm = "(When Attacks) When this Spirit is blocked, the opponent exhausts N Spirits they control"
// (ALLY_BLOCKED self + EXHAUST_OPP oppChooses n), and DESTROY_ANY (CPU only picks the opposing side).
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

test('V183-01 Windstorm 2: when the Spirit itself is blocked the opponent exhausts two Spirits', async () => {
  const r = await ev(`const a = sp('BS06-036', P, 3); G.active = P.key; const o = [1, 2, 3].map(() => sp('BS01-042', O, 1));
    await BS.fireFx(P, 'ALLY_BLOCKED', a, { attacker: a, blocker: o[0] });
    return o.filter(x => x.exhausted).length;`);
  assert.equal(r, 2);
});

test('V183-02 Windstorm does not fire when another ally is blocked', async () => {
  const r = await ev(`const a = sp('BS06-036', P, 3), b = sp('BS01-042', P, 1); G.active = P.key; const o = [1, 2, 3].map(() => sp('BS01-042', O, 1));
    await BS.fireFx(P, 'ALLY_BLOCKED', b, { attacker: b, blocker: o[0] });
    return o.filter(x => x.exhausted).length;`);
  assert.equal(r, 0);
});
