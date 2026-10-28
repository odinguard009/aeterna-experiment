// v0.183.0: Immortality = STATIC flag IMMORTALITY {costIn | family}: when your Spirit is destroyed in an Attack Step,
// an Immortality Spirit card in your Trash whose printed Cost matches can be summoned by paying its cost.
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
// BS11-010 Gaheris: Immortality Cost 3. BS01-042 is a cheap vanilla-ish Spirit; find costs from the data instead of assuming.
const costOf = id => `BS.CARDS['${id}'].cost`;

test('V183-IM1 a destroyed Cost 3 Spirit in an Attack Step lets Gaheris come back from the Trash', async () => {
  const r = await ev(`const c3 = Object.values(BS.CARDS).find(k => k.cost === 3 && k.type === 'Spirit' && k.id !== 'BS11-010' && !(k.effects || []).length).id;
    const x = sp(c3, P, 3); const gh = BS.mkInst('BS11-010'); P.trash.push(gh); G.active = O.key; G.step = 5;
    BS.removeSpirit(P, x, 'destroyed', 'battle'); await BS.flushBursts();
    return [P.spirits.includes(gh), P.trash.includes(gh)];`);
  assert.deepEqual(r, [true, false]);
});

test('V183-IM2 not in the Main Step, and not for a Spirit of another cost', async () => {
  const r = await ev(`const k3 = Object.values(BS.CARDS).find(k => k.cost === 3 && k.type === 'Spirit' && k.id !== 'BS11-010' && !(k.effects || []).length).id;
    const k4 = Object.values(BS.CARDS).find(k => k.cost === 4 && k.type === 'Spirit' && !(k.effects || []).length).id;
    const gh = BS.mkInst('BS11-010'); P.trash.push(gh); G.active = P.key; G.step = 4;
    BS.removeSpirit(P, sp(k3, P, 3), 'destroyed', true); await BS.flushBursts(); const a = P.spirits.includes(gh);
    G.step = 5; BS.removeSpirit(P, sp(k4, P, 3), 'destroyed', 'battle'); await BS.flushBursts();
    return [a, P.spirits.includes(gh)];`);
  assert.deepEqual(r, [false, false]);
});
