import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1107 BS69-033 Guneus: Burst after an opposing Summoned effect summons it and heavy exhausts two; a set copy also activates when cards go to the opposing Removed Zone; Summoned bounces an exhausted Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost <= 3 && k !== 'BS69-033');
    const b = BS.mkInst('BS69-033'); P.burst = b; P.spirits = [];
    const t1 = BS.mkInst(any), t2 = BS.mkInst(any); t1.cores = t2.cores = 2; O.spirits = [t1, t2];
    await BS.maybeBurst(P, 'OPP_REMOVED', {});
    return { summoned: P.spirits.includes(b), heavy: [t1, t2].filter(t => t.heavy).length, left: O.spirits.length, also: BS.CARDS['BS69-033'].burst.also.when, partial: BS.CARDS['BS69-033'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.also, 'OPP_REMOVED', JSON.stringify(r));
  assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.heavy, 1, JSON.stringify(r)); assert.equal(r.left, 1, JSON.stringify(r));   // both heavy exhausted, then the Summoned effect returns one exhausted Spirit to the deck bottom
});

test('K-1108 BS69-067 Gaia\'s Crust Temple: ally Primordial attack gives counter +1 (<=4) or a core to Contractor Gaia (>=5), once per turn; Lv2 destroyed destroys a 15000 BP or less opposing Spirit and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const prim = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Primordial'));
    const gaia = 'BS69-CX01';
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels[0].bp <= 15000);
    const n = BS.mkInst('BS69-067'); n.cores = 2; const g = BS.mkInst(gaia); g.cores = 1; P.nexus = [n, g]; const a = BS.mkInst(prim); a.cores = 1; P.spirits = [a]; P.count = 2;
    await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a, subject: a }); const c1 = P.count;
    n.fxUsed = {};
    P.count = 5; P.reserve.n = 3; const before = g.cores; await BS.fireFx(P, 'ALLY_ATTACKS', a, { attacker: a, subject: a }); const gc = g.cores - before;
    const t = BS.mkInst(any); t.cores = 1; O.spirits = [t]; P.deck = [1,2,3].map(() => BS.mkInst(any)); const h = P.hand.length; P.nexus = [g]; n.lostLv = 1; P.trash.push(n);
    await BS.fireFx(P, 'DESTROYED', n, { subject: n });
    return { c1, gc, gone: !O.spirits.includes(t), drew: P.hand.length - h, partial: BS.CARDS['BS69-067'].partial, prim, gaia }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.c1, 3, JSON.stringify(r)); assert.equal(r.gc, 1, JSON.stringify(r));
  assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r));
});
