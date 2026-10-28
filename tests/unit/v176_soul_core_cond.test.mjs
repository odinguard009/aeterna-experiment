// v0.176.0: fxIf soulPaid ("If (Soul Core) was used to pay the summon cost") and selfSoul ("If (Soul Core) is on this Spirit").
// rules: ETR:summon.cost@d20adf64
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 0; q.reserve.soul = false; }`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V176-01 soulPaid: true only when the Soul Core was among the paid cores', async () => {
  const r = await ev(`const out = [];
    for (const withSoul of [false, true]) {
      P.reserve.n = 5; P.reserve.soul = withSoul; const i = BS.mkInst('BS01-035'); P.hand = [i];
      const c = BS.effCost(P, BS.CARDS[i.id]);
      BS.summon(P, i, { reserve: c - (withSoul ? 1 : 0), by: {}, rsoul: withSoul, fsoul: null });
      out.push([BS.fxIf(P, O, { soulPaid: true }, { selfInst: i }), BS.fxIf(P, O, { soulPaid: false }, { selfInst: i })]);
      P.spirits = []; P.reserve.n = 0; P.reserve.soul = false;
    }
    return out;`);
  assert.deepEqual(r, [[false, true], [true, false]]);
});

test('V176-02 selfSoul: holds the Soul Core on the Field, and is remembered once destroyed', async () => {
  const r = await ev(`const s = BS.mkInst('BS01-035'); s.cores = 2; s.soul = true; P.spirits.push(s);
    const on = BS.fxIf(P, O, { selfSoul: true }, { selfInst: s });
    BS.removeSpirit(P, s, 'destroyed', true);
    const gone = BS.fxIf(P, O, { selfSoul: true }, { selfInst: s });
    const t = BS.mkInst('BS01-035'); t.cores = 2; P.spirits.push(t);
    return [on, gone, BS.fxIf(P, O, { selfSoul: true }, { selfInst: t })];`);
  assert.deepEqual(r, [true, true, false]);
});
