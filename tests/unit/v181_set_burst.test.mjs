// v0.181.0 (schema 30): SET_BURST ("set a card with Burst effect from your Hand").
// rules: ETR:cost.paying@06d788b2
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; q.hand = []; }`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V181-06 SET_BURST: parses, sets a hand card with Burst, did=false without one', async () => {
  const r = await ev(`const ok = !BS.parseActionList([{ do: 'SET_BURST' }]).error;
    const bid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].burst && BS.CARDS[k].type === 'Magic');
    const src = BS.mkInst('BS01-035'), ctx = {};
    const c = { p: P, opp: O, src, ctx };
    await BS.FX_ACTIONS.SET_BURST.run(c, { do: 'SET_BURST' });
    const none = ctx.did;
    const h = BS.mkInst(bid); P.hand.push(h);
    const n = BS.FX_ACTIONS.SET_BURST.cands(c).length;
    const ctx2 = {}; await BS.FX_ACTIONS.SET_BURST.run({ p: P, opp: O, src, ctx: ctx2 }, { do: 'SET_BURST' });
    return [ok, none, n, !!P.burst, P.hand.length];`);
  assert.deepEqual(r, [true, false, 1, true, 0]);
});

test('V181-07 TREAT_LV3: a Spirit with 1 core is LV3 while its owner controls two or less Spirits', async () => {
  const r = await ev(`const s = BS.mkInst('BS02-002'); s.cores = 1; P.spirits.push(s);
    const a = BS.lvNo(s);
    P.spirits.push(BS.mkInst('BS01-035'), BS.mkInst('BS01-035'));
    const b = BS.lvNo(s);
    return [a, b];`);
  assert.deepEqual(r, [3, 1]);
});
