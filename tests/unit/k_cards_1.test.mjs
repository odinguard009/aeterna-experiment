// Lane K tests, file 1 (new rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SETUP = `const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; }
  const hit = async cores => { const a = BS.mkInst('26RBS01-001'); a.cores = cores; a.exhausted = false; O.spirits.length = 0; O.spirits.push(a); G.active = O.key; G.step = 5; const l = P.life; await BS.doBattle(O.key, a); return l - P.life; };`;

test('K-97 26RSD02-013 Rainy Poison: LIFE_CORE_SHIELD only after the Life was reduced; attackers with one core then take no Life this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const t = BS.mkInst('26RBS01-001'); t.cores = 1; t.exhausted = true; P.spirits.push(t);
    const cast = async () => { const m = BS.mkInst('26RSD02-013'); G.active = O.key; G.step = 5; await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' }); };
    P.life = 5; P.lifeRedTurn = -1; await cast(); const noShield = !P.coreShield;
    P.lifeRedTurn = G.turnNo; await cast(); const shield = !!P.coreShield;
    return [noShield, shield, await hit(1), await hit(2)]; })()`);
  assert.deepEqual(r, [true, true, 0, 1], JSON.stringify(r));
});

test('K-98 26RBS03-076 Venomous Bottomless Swamp: Invoke destroys the Nexus for a this-battle shield (gone with the next battle); Life hit exhausts it and sends cores until one remains', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS03-076'); n.cores = 3; P.nexus.push(n);
    const i = BS.CARDS['26RBS03-076'].effects.findIndex(e => e.invoke);
    G.active = O.key; G.step = 5; const ok = await BS.activateFx(P, n, i);
    const gone = !P.nexus.includes(n), set = !!(P.coreShield && P.coreShield.b === (G.battleNo || 0));
    const later = await hit(1);
    const m = BS.mkInst('26RBS03-076'); m.cores = 3; P.nexus.push(m);
    const e = BS.mkInst('26RBS01-001'); e.cores = 4; O.spirits.length = 0; O.spirits.push(e);
    await BS.fireFx(P, 'OWN_LIFE_HIT', null, { attacker: e }); await BS.flushBursts();
    return [ok, gone, set, later, m.exhausted, e.cores]; })()`);
  assert.deepEqual(r, [true, true, true, 1, true, 1], JSON.stringify(r));
});

test('K-99 26RBS01-X01 Restiel: Invoke needs an own Clash attacker (attackerKeyword), exhausts itself and lets an opposing Spirit block while exhausted this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const w = BS.mkInst('26RBS01-X01'); w.cores = 3; P.spirits.push(w);
    const o = BS.mkInst('26RBS01-001'); o.cores = 1; o.exhausted = true; O.spirits.push(o);
    const i = BS.CARDS['26RBS01-X01'].effects.findIndex(e => e.invoke);
    G.active = P.key; G.step = 5; G.battleNo = 5;
    const a = BS.mkInst('BS06-012'); a.cores = 1; P.spirits.push(a);
    G.attacker = a; const ok = await BS.activateFx(P, w, i); const marked = o.blockExB === 5 && w.exhausted;
    w.exhausted = false; o.blockExB = null;
    const b = BS.mkInst('26RBS01-001'); b.cores = 1; P.spirits.push(b); G.attacker = b;
    const no = await BS.activateFx(P, w, i); G.attacker = null;
    return [ok, marked, !!no, o.blockExB == null]; })()`);
  assert.deepEqual(r, [true, true, false, true], JSON.stringify(r));
});
