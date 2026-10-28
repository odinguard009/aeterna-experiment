// v0.181.0 (schema 29): DESTROY keywords:[..] ("destroy ... Spirit with Clash/Charge") and REVEAL_PICK all:true ("Add every X among them").
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

test('V181-04 DESTROY keywords: parse, text and candidates carry one of the keywords', async () => {
  const r = await ev(`const f = a => !!BS.parseActionList([a]).error;
    const bad = [f({ do: 'DESTROY', keywords: ['Charge'] }), f({ do: 'DESTROY', keywords: [] }), f({ do: 'DESTROY', keywords: [3] })];
    const a = BS.mkInst('BS01-035'), b = BS.mkInst('BS01-035'); a.cores = 1; b.cores = 1; O.spirits.push(a, b);
    const old = BS.CARDS['BS01-035'].keywords; BS.CARDS['BS01-035'].keywords = ['Charge'];
    const act = { do: 'DESTROY', keywords: ['Charge', 'Clash'] };
    const src = BS.mkInst('BS01-035'); const c1 = BS.FX_ACTIONS.DESTROY.cands({ p: P, opp: O, src, ctx: {} }, act).length;
    BS.CARDS['BS01-035'].keywords = old;
    const c2 = BS.FX_ACTIONS.DESTROY.cands({ p: P, opp: O, src, ctx: {} }, act).length;
    return [bad, c1, c2, BS.FX_ACTIONS.DESTROY.txt(act)];`);
  assert.deepEqual(r[0], [false, true, true]);
  assert.equal(r[1], 2);
  assert.equal(r[2], 0);
  assert.match(r[3], /Charge\/Clash/);
});

test('V181-05 REVEAL_PICK all: parse accepts all:true only, every matching card goes to the Hand', async () => {
  const r = await ev(`const f = a => !!BS.parseActionList([a]).error;
    const base = { do: 'REVEAL_PICK', n: 3, match: { name: ['Crimson'] }, rest: 'bottom' };
    return [f({ ...base, all: true }), f({ ...base, all: false }), f({ ...base, all: 'x' })];`);
  assert.deepEqual(r, [false, true, true]);
});
