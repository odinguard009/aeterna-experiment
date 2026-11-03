import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1096 BS44-CP02/XX02 Lolo: a Cost 3+ Spirit summon charges the Nexus once per turn, Cost 2 does not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const nx = BS.mkInst('BS44-XX02'); nx.cores = 1; P.nexus = [nx]; P.void = 5; P.onceUsed = {};
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const lo = BS.mkInst(ids.find(k => BS.CARDS[k].cost === 2)), hi = BS.mkInst(ids.find(k => BS.CARDS[k].cost >= 3));
    await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: lo }); const a = nx.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: hi }); const b = nx.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: hi }); const c = nx.cores;
    return { a, b, c, p1: BS.CARDS['BS44-CP02'].partial, p2: BS.CARDS['BS44-XX02'].partial }; })()`);
  assert.equal(r.p1, false, JSON.stringify(r)); assert.equal(r.p2, false, JSON.stringify(r));
  assert.equal(r.a, 1, JSON.stringify(r)); assert.equal(r.b, 2, JSON.stringify(r)); assert.equal(r.c, 2, JSON.stringify(r));
});

test('K-1097 BS44-XX02/CP02: activation pays 3 Nexus cores to the Void; XX02 (CPU) draws, CP02 puts a Void core into the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const out = {};
    for (const id of ['BS44-XX02', 'BS44-CP02']) {
      const nx = BS.mkInst(id); nx.cores = 3; P.nexus = [nx]; P.onceUsed = {}; P.void = 0; P.reserve.n = 2; P.hand = []; P.deck = [BS.mkInst('BS74-048'), BS.mkInst('BS74-049')];
      const idx = BS.CARDS[id].effects.findIndex(e => e.trigger === 'ACTIVATE');
      const ok = await BS.activateFx(P, nx, idx);
      out[id] = { ok, cores: nx.cores, hand: P.hand.length, res: P.reserve.n, void: P.void };
    }
    return out; })()`);
  assert.equal(r['BS44-XX02'].ok, true, JSON.stringify(r)); assert.equal(r['BS44-XX02'].cores, 0, JSON.stringify(r)); assert.equal(r['BS44-XX02'].hand, 1, JSON.stringify(r));
  assert.equal(r['BS44-CP02'].ok, true, JSON.stringify(r)); assert.equal(r['BS44-CP02'].cores, 0, JSON.stringify(r)); assert.equal(r['BS44-CP02'].hand, 0, JSON.stringify(r)); assert.equal(r['BS44-CP02'].res, 3, JSON.stringify(r));
});

test('K-1098 BS44-XX02 Lv2: also treated as all six colours (symbol)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const x = BS.mkInst('BS44-XX02'); x.cores = 3; P.nexus = [x]; P.spirits = [];
    const sy = BS.symbolsOn(P); const colours = ['red','purple','green','white','yellow','blue'].map(c => (sy[c] || 0) > 0);
    x.cores = 0; const sy0 = BS.symbolsOn(P); const lv1 = ['purple','blue'].map(c => (sy0[c] || 0) > 0);
    return { colours, lv1 }; })()`);
  assert.deepEqual(r.colours, [true, true, true, true, true, true], JSON.stringify(r));
  assert.deepEqual(r.lv1, [false, false], JSON.stringify(r));
});
