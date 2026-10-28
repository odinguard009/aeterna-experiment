// v0.180.0 (Lane K): SUMMON_HAND noFx — "any (When Summoned) effects of the Spirit summoned by this effect can't activate" (BS02-034).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => {
  g = await openGame('');
  const fix = [{ id: 'NF-G', name: 'NF-G', type: 'Spirit', color: 'green', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 2000 }], text: '[LV1] (When Summoned) Draw a card.', effects: [{ trigger: 'SUMMONED', lv: [1], actions: [{ do: 'DRAW', n: 1 }] }] }];
  const r = await g.page.evaluate(f => BS.importCards(JSON.stringify(f)), fix);
  assert.equal(r.ok, 1, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

const run = (noFx) => g.page.evaluate(async noFx => {
  BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player;
  P.cpu = true; P.spirits = []; P.hand = []; P.nexus = []; P.reserve.n = 5;
  const t = BS.mkInst('BS02-034'); t.cores = 1; P.spirits.push(t);
  P.hand.push(BS.mkInst('NF-G')); P.deck = Array.from({ length: 5 }, () => BS.mkInst('NF-G'));
  if (!noFx) BS.CARDS['BS02-034'].effects[0].actions[0].noFx = false;
  await BS.fireFx(P, 'SUMMONED', t, {});
  return [P.spirits.map(s => s.id), P.hand.length];
}, noFx);

test('NF01 noFx summon: the summoned Spirit is on the field and its own (When Summoned) draw does not fire', async () => {
  assert.deepEqual(await run(true), [['BS02-034', 'NF-G'], 0]);
});
test('NF02 without noFx the summoned Spirit draws a card', async () => {
  assert.deepEqual(await run(false), [['BS02-034', 'NF-G'], 1]);
});

test('NF03 OPP_DISCARD: the opponent discards a card from their Hand (Matchra BS01-056 when summoned)', async () => {
  const r = await g.page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
    P.cpu = true; O.cpu = true; P.spirits = []; O.hand = [BS.mkInst('NF-G'), BS.mkInst('NF-G')]; O.trash = [];
    const t = BS.mkInst('BS01-056'); t.cores = 1; P.spirits.push(t);
    await BS.fireFx(P, 'SUMMONED', t, {});
    return [O.hand.length, O.trash.length];
  });
  assert.deepEqual(r, [1, 1]);
});

test('NF04 NO_DECK_DISCARD (BS19-007): MILL does nothing while the lock is on the field, works once it is gone', async () => {
  const r = await g.page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player;
    P.cpu = true; P.spirits = []; P.trash = []; P.deck = Array.from({ length: 5 }, () => BS.mkInst('NF-G'));
    const src = BS.mkInst('BS01-056'); src.cores = 1; P.spirits.push(src);
    const lock = BS.mkInst('BS19-007'); lock.cores = 2; G.p.opponent.spirits = [lock];
    const c = { p: P, opp: G.p.opponent, src, ctx: {} };
    await BS.FX_ACTIONS.MILL.run(c, { do: 'MILL', n: 2 });
    const locked = P.trash.length; G.p.opponent.spirits = [];
    await BS.FX_ACTIONS.MILL.run({ p: P, opp: G.p.opponent, src, ctx: {} }, { do: 'MILL', n: 2 });
    return [locked, P.trash.length];
  });
  assert.deepEqual(r, [0, 2]);
});

test('NF05 RETURN_TRASH Magic (BS02-072): returns a Magic card, not a Spirit, from the Trash', async () => {
  const r = await g.page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player;
    P.cpu = true; P.spirits = []; P.hand = []; const mg = BS.mkInst('BS01-117');
    P.trash = [BS.mkInst('NF-G'), mg];
    const t = BS.mkInst('BS02-072'); t.cores = 1; P.spirits.push(t);
    await BS.fireFx(P, 'SUMMONED', t, {});
    return [P.hand.map(x => BS.CARDS[x.id].type), P.trash.length];
  });
  assert.deepEqual(r, [['Magic'], 1]);
});

test('NF06 STATIC perHand (BS10-049): +1000 BP for each card in the owner Hand', async () => {
  const r = await g.page.evaluate(() => {
    BS.testSetup(); const P = BS.G.p.player; P.spirits = []; P.hand = [];
    const t = BS.mkInst('BS10-049'); t.cores = 2; P.spirits.push(t);
    const a = BS.bpOf(t); P.hand = [BS.mkInst('NF-G'), BS.mkInst('NF-G'), BS.mkInst('NF-G')];
    return BS.bpOf(t) - a;
  });
  assert.equal(r, 3000);
});
