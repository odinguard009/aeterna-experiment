// v0.186 STATIC NO_ATTACK_LIFE {costLe}: "Neither player's Life can be reduced by the attacks of Cost N or less Spirits."
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

after(closeBrowser);
let g;
before(async () => {
  g = await openGame('');
  const mk = (id, cost, extra) => Object.assign({ id, name: id, type: 'Spirit', color: 'red', cost, symbols: 1, levels: [{ cores: 1, bp: 3000 }] }, extra);
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), [mk('T186-LOCK', 2, { effects: [{ trigger: 'STATIC', flag: 'NO_ATTACK_LIFE', to: 'self', costLe: 2 }] }), mk('T186-C2', 2), mk('T186-C3', 3)]);
  assert.equal(r.ok, 3, JSON.stringify(r));
});
const ev = (holderSide, attId) => g.page.evaluate(`(async () => { BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 3; P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; } const h = BS.mkInst('T186-LOCK'); h.exhausted = true; ${holderSide}.spirits.push(h);
  const a = BS.mkInst('${attId}'); P.spirits.push(a); const life = O.life; await BS.doBattle(P.key, a); return life - O.life; })()`);

test('ATL186-01 a Cost 2 attacker takes no Life while either player holds the lock; Cost 3 still does', async () => {
  assert.equal(await ev('O', 'T186-C2'), 0);
  assert.equal(await ev('P', 'T186-C2'), 0);
  assert.equal(await ev('O', 'T186-C3'), 1);
});

test('HC186-01 HAND_COST sets the base cost of matching hand cards', async () => {
  await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), [
    { id: 'T186-HC', name: 'T186-HC', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'STATIC', flag: 'HAND_COST', to: 'self', n: 1, match: { family: ['Zed'] } }] },
    { id: 'T186-ZED', name: 'T186-ZED', type: 'Spirit', color: 'red', cost: 6, symbols: 1, families: ['Zed'], levels: [{ cores: 1, bp: 3000 }] }]);
  const r = await g.page.evaluate(`(() => { BS.testSetup(); const P = BS.G.p.player; P.spirits = [BS.mkInst('T186-HC')]; const z = BS.mkInst('T186-ZED'); P.hand = [z]; P.reserve.n = 2; const a = BS.canPlayCard(P, z); P.spirits = []; return [a, BS.canPlayCard(P, z)]; })()`);
  assert.deepEqual(r, [true, false]);
});
