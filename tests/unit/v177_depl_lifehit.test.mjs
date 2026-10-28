// v0.177.0: alsoDepleted on DESTROYED effects, and the OWN_LIFE_HIT trigger.
// rules: ETR:battle.block@d20adf64
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 0; q.reserve.soul = false; }`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V177-01 alsoDepleted: fires on depletion by an opposing effect only, plain (When Destroyed) stays silent', async () => {
  const r = await ev(`const out = [];
    for (const [id, why, fxBy] of [['BS31-013', 'depleted', 'opponent'], ['BS31-013', 'depleted', 'player'], ['BS31-013', 'destroyed', 'opponent'], ['BS31-038', 'depleted', 'opponent']]) {
      const s = BS.mkInst(id); s.cores = 1; P.spirits.push(s); G.evQ = []; G.fxBy = fxBy;
      BS.removeSpirit(P, s, why, fxBy === 'opponent');
      out.push(G.evQ.filter(e => e.type === 'DESTROYED').length); P.spirits = [];
    }
    return out;`);
  assert.deepEqual(r, [1, 0, 1, 0]);
});

test('V177-02 OWN_LIFE_HIT compiles with the attacker filter (Spirit vs Ultimate)', async () => {
  const r = await ev(`const fx = BS.CARDS['BS27-068'].effects.map(e => e.trigger + ':' + JSON.stringify(e.match || null));
    const seen = []; const e0 = BS.CARDS['BS27-068'].effects[0], keep = e0.trigger;
    return [fx, BS.CARDS['BS06-081'].effects[0].trigger];`);
  assert.deepEqual(r[0].slice(0, 2), ['OWN_LIFE_HIT:{"noUlt":true}', 'OWN_LIFE_HIT:{"type":"Ultimate"}']);
  assert.equal(r[1], 'OWN_LIFE_HIT');
});
