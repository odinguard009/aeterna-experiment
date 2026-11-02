// v0.45.0 BS71-X09 Agateram (blue Nuadha deck): SA Unleash 3 and the Lv2-3 block lock, both "unless the opponent discards a Magic card".
// New vocabulary: ALLY_ATTACKS gate `subjBraved` (the attacker is a Brave Spirit), OPP_LIFE_TO_TRASH {perBraveNames}, OPP_NO_BLOCK (this Attack Step).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const AGA = 'BS71-X09', NUA = 'BS71-CX03', SPEAR = 'BS71-063', RIFLE = 'BS71-064', SWORD = 'BS72-068', SCOUT = 'BS71-053', MUSK = 'BS71-057', M1 = 'BS68-076', M2 = 'BS68-077', HOUND = 'BS68-014';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; q.trashCores.n = 0; q.life = 5; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);
// Agateram at `lv` cores, Nuadha with `nc` cores, attacker = a Scalostle Spirit with `braves` combined (first one) plus extra Brave Spirits on the Field
const setup = ({ agaCores = 1, nc = 3, braves = [SPEAR], extra = [], oppMagic = [], oppLife = 5 } = {}) => `
  const a = sp('${AGA}', P, ${agaCores}); const n = nx('${NUA}', P, ${nc});
  const att = sp('${MUSK}', P, 1); ${braves.length ? `att.brave = BS.mkInst('${braves[0]}');` : ''}
  ${extra.map(id => `{ const s = sp('${SCOUT}', P, 1); s.brave = BS.mkInst('${id}'); }`).join(' ')}
  ${oppMagic.map(id => `hd('${id}', O);`).join(' ')} O.life = ${oppLife};`;
const unleash = `await BS.fireFx(P, 'ALLY_ATTACKS', att, { attacker: att });`;

test('AG01 Agateram now has two effects; the only residual is the Lv2 timing house reading', async () => {
  const r = await g.page.evaluate(i => { const c = BS.CARDS[i]; return [Array.isArray(c.effects) && c.effects.length, (c.residual || []).length, (c.residual || []).some(x => /Unleash/i.test(x))]; }, AGA);
  assert.deepEqual(r, [2, 1, false]);
});
test('AG02 Unleash effect: ALLY_ATTACKS, Lv1-3, subjBraved Scalostle, optional, BY Nuadha cores then discard-or then Life to Trash', async () => {
  const r = await g.page.evaluate(i => { const e = BS.CARDS[i].effects[0]; return [e.trigger, e.lv.join(''), e.subjBraved, !!e.optional, e.actions[0].do, e.actions[0].cost.do, e.actions[0].cost.n, e.actions[0].then.map(x => x.do).join('>')]; }, AGA);
  assert.deepEqual(r, ['ALLY_ATTACKS', '123', 'Scalostle', true, 'BY', 'NEXUS_CORES_TO_SELF', 3, 'OPP_DISCARD_MAGIC_OR>OPP_LIFE_TO_TRASH']);
});
test('AG03 block-lock effect: START_ATTACK, Lv2-3, discard-or then OPP_NO_BLOCK', async () => {
  const r = await g.page.evaluate(i => { const e = BS.CARDS[i].effects[1]; return [e.trigger, e.lv.join(''), e.actions.map(x => x.do).join('>')]; }, AGA);
  assert.deepEqual(r, ['START_ATTACK', '23', 'OPP_DISCARD_MAGIC_OR>OPP_NO_BLOCK']);
});
test('AG04 Unleash: 3 cores move from Nuadha to Agateram', async () => {
  assert.deepEqual(await ev(setup() + unleash + ' return [n.cores, a.cores];'), [0, 4]);
});
test('AG05 Unleash with one Scalostle Brave: one opposing Life goes to the opposing Trash', async () => {
  assert.deepEqual(await ev(setup() + unleash + ' return [O.life, O.trashCores.n];'), [4, 1]);
});
test('AG06 two differently named Scalostle Braves: two Lives', async () => {
  assert.equal(await ev(setup({ extra: [RIFLE] }) + unleash + ' return O.life;'), 3);
});
test('AG07 three different Braves: three Lives', async () => {
  assert.equal(await ev(setup({ extra: [RIFLE, SWORD] }) + unleash + ' return O.life;'), 2);
});
test('AG08 two Braves with the same name count once', async () => {
  assert.equal(await ev(setup({ extra: [SPEAR] }) + unleash + ' return O.life;'), 4);
});
test('AG09 Nuadha with fewer than 3 cores: no Unleash, no Life loss', async () => {
  assert.deepEqual(await ev(setup({ nc: 2 }) + unleash + ' return [n.cores, a.cores, O.life];'), [2, 1, 5]);
});
test('AG10 the attacker without a Brave does not trigger Unleash', async () => {
  assert.deepEqual(await ev(setup({ braves: [] }) + unleash + ' return [n.cores, O.life];'), [3, 5]);
});
test('AG11 a non-Scalostle Brave Spirit does not trigger Unleash', async () => {
  assert.deepEqual(await ev(setup({ braves: [] }) + ` const x = sp('${HOUND}', P, 1); x.brave = BS.mkInst('${SPEAR}'); att.brave = null; await BS.fireFx(P, 'ALLY_ATTACKS', x, { attacker: x }); return [n.cores, O.life];`), [0, 4]);
});
test('AG12 the CPU opponent with two Magic cards discards one and keeps its Life', async () => {
  assert.deepEqual(await ev(setup({ oppMagic: [M2, M1] }) + unleash + ' return [O.life, O.hand.length, O.trash.length, n.cores];'), [5, 1, 1, 0]);
});
test('AG13 the CPU with one Magic card at Life 5 keeps it and loses the Life', async () => {
  assert.deepEqual(await ev(setup({ oppMagic: [M1] }) + unleash + ' return [O.life, O.hand.length];'), [4, 1]);
});
test('AG14 Life loss to 0 ends the game for the active player', async () => {
  const r = await ev(setup({ oppLife: 1 }) + unleash + ' return [O.life, !!G.over];');
  assert.equal(r[0], 0); assert.equal(r[1], true);
});
test('AG15 Life loss is capped at the remaining Life', async () => {
  assert.deepEqual(await ev(setup({ oppLife: 2, extra: [RIFLE, SWORD] }) + unleash + ' return [O.life, O.trashCores.n];'), [0, 2]);
});
test('AG16 OPP_LIFE_TO_TRASH counts combined and Field Braves by distinct name', async () => {
  const r = await ev(setup({ extra: [RIFLE] }) + ` const b = BS.mkInst('${SWORD}'); b.cores = 1; P.spirits.push(b); ` + unleash + ' return O.life;');
  assert.equal(r, 2);
});
test('AG17 block lock at Lv2: the opponent without Magic cards cannot block this turn', async () => {
  const r = await ev(setup({ agaCores: 3 }) + ` await BS.fireFx(P, 'START_ATTACK', a, {}); return BS.noBlockActive(O);`);
  assert.equal(r, true);
});
test('AG18 block lock at Lv1 does not apply', async () => {
  assert.equal(await ev(setup({ agaCores: 1 }) + ` await BS.fireFx(P, 'START_ATTACK', a, {}); return BS.noBlockActive(O);`), false);
});
test('AG19 block lock: the CPU with two Magic cards discards one and may block', async () => {
  assert.deepEqual(await ev(setup({ agaCores: 3, oppMagic: [M2, M1] }) + ` await BS.fireFx(P, 'START_ATTACK', a, {}); return [BS.noBlockActive(O), O.hand.length];`), [false, 1]);
});
test('AG20 block lock ends when Agateram leaves the Field', async () => {
  assert.equal(await ev(setup({ agaCores: 3 }) + ` await BS.fireFx(P, 'START_ATTACK', a, {}); P.spirits.splice(P.spirits.indexOf(a), 1); return BS.noBlockActive(O);`), false);
});
test('AG21 block lock ends with the turn', async () => {
  assert.equal(await ev(setup({ agaCores: 3 }) + ` await BS.fireFx(P, 'START_ATTACK', a, {}); G.turnNo++; return BS.noBlockActive(O);`), false);
});
test('AG22 block lock ends when Agateram drops below Lv2', async () => {
  assert.equal(await ev(setup({ agaCores: 3 }) + ` await BS.fireFx(P, 'START_ATTACK', a, {}); a.cores = 1; return BS.noBlockActive(O);`), false);
});
test('AG23 a real battle: the opposing untapped Spirit does not block and the Life is hit', async () => {
  const r = await ev(setup({ agaCores: 3 }) + ` const d = sp('${HOUND}', O, 1); await BS.fireFx(P, 'START_ATTACK', a, {}); const life = O.life;
    await BS.doBattle(P.key, a); return [d.exhausted, O.life < life];`);
  assert.deepEqual(r, [false, true]);
});
test('AG24 the lock does not affect the player who owns Agateram', async () => {
  assert.equal(await ev(setup({ agaCores: 3 }) + ` await BS.fireFx(P, 'START_ATTACK', a, {}); return BS.noBlockActive(P);`), false);
});
