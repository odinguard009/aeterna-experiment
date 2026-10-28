// v0.183.0: DESTROY_EVERY {bpLe} hits both sides; DESTROY_ANY {kind:'spirit', bpLe} picks one Spirit of either side (CPU: opposing only).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 10; q.onceUsed = {}; q.life = 3; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const vanilla = bp => Object.values(BS.CARDS).find(k => k.type === 'Spirit' && !(k.effects || []).length && k.levels && k.levels[0] && k.levels[0].bp === bp && k.levels[0].cores === 1).id;`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V183-DE1 DESTROY_EVERY destroys low-BP Spirits on both sides and keeps the bigger one', async () => {
  const r = await ev(`const lo = vanilla(3000), hi = vanilla(5000); const a = sp(lo, P), b = sp(lo, O), c = sp(hi, O), src = sp(hi, P);
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: [{ do: 'DESTROY_EVERY', bpLe: 3000 }] });
    return [P.spirits.includes(a), O.spirits.includes(b), O.spirits.includes(c), P.spirits.includes(src)];`);
  assert.deepEqual(r, [false, false, true, true]);
});

test('V183-DE2 DESTROY_ANY bpLe: the CPU only takes an opposing Spirit within the BP limit', async () => {
  const r = await ev(`const lo = vanilla(3000), hi = vanilla(5000); const own = sp(lo, P), t = sp(lo, O), big = sp(hi, O), src = sp(hi, P);
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: [{ do: 'DESTROY_ANY', kind: 'spirit', bpLe: 3000 }] });
    return [P.spirits.includes(own), O.spirits.includes(t), O.spirits.includes(big)];`);
  assert.deepEqual(r, [true, false, true]);
});
