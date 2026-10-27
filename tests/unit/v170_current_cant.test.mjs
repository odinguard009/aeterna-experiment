// v0.170.0: keyword Current (Invoke Flash + extra Green symbol), plain "(Once Per Turn)" after a trigger head,
// "The opponent targets a refreshed Spirit they control. Exhaust it." (EXHAUST_OPP oppChooses), and the printed
// "This Spirit can't attack / block." as STATIC flags CANT_ATTACK / CANT_BLOCK.
// rules: ETR:battle.block@d20adf64
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

test('V170-01 Current cards carry the Invoke Flash + SYMBOL_TARGET effect', async () => {
  const r = await ev(`return ['26RBS01-035', '26RBS01-038', '26RBS01-040', '26RBS01-041', '26RBS01-X08', '26RBS02-028'].map(id => { const c = BS.CARDS[id]; const e = c.effects.find(x => x.invoke); return [c.fxComplete !== false, e.when, JSON.stringify(e.cost), JSON.stringify(e.actions)]; });`);
  for (const x of r) { assert.equal(x[0], true); assert.equal(x[1], 'yourAttack'); assert.equal(x[2], '{"exhaustSelf":true}'); assert.equal(x[3], '{"do":"SYMBOL_TARGET","n":1,"match":{"family":["Oceanic Green"],"costGe":8}}'.replace(/^/, '[').replace(/$/, ']')); }
});

test('V170-02 Na-Nascita: the block refresh is limited to once per turn', async () => {
  const r = await ev(`const e = BS.CARDS['26RBS01-041'].effects.find(x => x.trigger === 'BLOCKS'); return [e.once, e.optional, e.sameName || false];`);
  assert.deepEqual(r, [true, true, false]);
});

test('V170-03 Carchalord: when destroyed, the opponent exhausts one of its own refreshed Spirits', async () => {
  const r = await ev(`const d = sp('26RBS02-028', P, 3), a = sp('BS01-042', O, 1), b = sp('BS01-042', O, 1); a.exhausted = true;
    BS.removeSpirit(P, d, 'destroyed', true); await BS.flushBursts();
    return [a.exhausted, b.exhausted];`);
  assert.deepEqual(r, [true, true]);      // a was exhausted already; the only refreshed Spirit (b) is exhausted by the opponent's choice
});

test('V170-04 Harshee: a printed "can\'t attack" blocks the attack but not the block', async () => {
  const r = await ev(`const h = sp('26RBS01-031', P, 1); G.active = P.key;
    return [BS.flushDerived ? 1 : 1, BS.flagActive(P, 'CANT_ATTACK', h), BS.flagActive(P, 'CANT_BLOCK', h), BS.canBlockState(P, h)];`);
  assert.deepEqual(r.slice(1), [true, false, true]);
});

test('V170-05 Teranosaber: "can\'t block opposing Spirits" stops the block, attacking stays possible', async () => {
  const r = await ev(`const t = sp('BS01-003', O, 1);
    return [BS.flagActive(O, 'CANT_BLOCK', t), BS.canBlockState(O, t), BS.flagActive(O, 'CANT_ATTACK', t)];`);
  assert.deepEqual(r, [true, false, false]);
});

test('V170-06 a Spirit without the flag still blocks', async () => {
  const r = await ev(`const t = sp('BS01-042', O, 1); return [BS.canBlockState(O, t)];`);
  assert.deepEqual(r, [true]);
});
