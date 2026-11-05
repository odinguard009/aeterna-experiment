import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const setup = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;`;

test('K-1707 BS73-TX02 + TX02B complete; SEND_TOKEN of a Fungal Bed queues BED_SENT only while a card listens', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const ev = async withListener => {
      BS.testSetup(); const P = BS.G.p.player; P.cpu = true; BS.G.active = P.key; BS.G.evQ = [];
      if (withListener) { const s = BS.mkInst('BS73-TX02'); s.cores = 3; P.spirits = [s]; }
      P.tokens = { 'BS73-T001': 9 }; P.void = 5; P.nexus = [];
      const c = { p: P, opp: BS.G.p.opponent, src: P.spirits[0] || null, ctx: {} };
      await BS.FX_ACTIONS.SEND_TOKEN.run(c, { do: 'SEND_TOKEN', token: 'BS73-T001', n: 1 });
      return { beds: P.nexus.length, q: BS.G.evQ.filter(e => e.type === 'BED_SENT').length };
    };
    return { on: await ev(true), off: await ev(false), f: BS.CARDS['BS73-TX02'].partial === false, b: !!BS.CARDS['BS73-TX02B'] && BS.CARDS['BS73-TX02B'].partial === false };
  })()`);
  const j = JSON.stringify(r);
  assert.ok(r.f && r.b, j);
  assert.equal(r.on.beds, 1, j); assert.equal(r.on.q, 1, j); assert.equal(r.off.q, 0, j);
});

test('K-1708 BS73-TX02 SUMMONED: three cores to self, one core each to two Fungal Beds', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const s = BS.mkInst('BS73-TX02'); s.cores = 1; P.spirits = [s];
    const b1 = BS.mkInst('BS73-T001'), b2 = BS.mkInst('BS73-T001'); b1.token = b2.token = true; P.nexus = [b1, b2]; P.void = 6;
    await BS.fireFx(P, 'SUMMONED', s, {});
    return { s: s.cores, b1: b1.cores, b2: b2.cores };
  })()`);
  const j = JSON.stringify(r);
  assert.equal(r.s, 4, j); assert.equal(r.b1 + r.b2, 2, j);
});

test('K-1709 BS73-TX02B REVEAL_BED_SUMMON: destroys a Bed per Fungal Tree Spirit summoned, rest to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const tree = Object.keys(BS.CARDS).filter(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].families || []).includes('Fungal Tree') && BS.CARDS[id].cost <= 6 && !(BS.CARDS[id].effects || []).some(e => e.trigger === 'SUMMONED') && !/Summoned/i.test(BS.CARDS[id].text || '')).slice(0, 2);
    const junk = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Magic');
    const s = BS.mkInst('BS73-TX02B'); s.cores = 3; P.spirits = [s];
    const mk = () => { const b = BS.mkInst('BS73-T001'); b.token = true; return b; };
    P.nexus = [mk(), mk()]; P.void = 5; P.deck = [BS.mkInst(tree[0]), BS.mkInst(junk), BS.mkInst(tree[1]), BS.mkInst(junk), BS.mkInst(junk)];
    const d0 = P.deck.length;
    const c = { p: P, opp: O, src: s, ctx: {} };
    await BS.FX_ACTIONS.REVEAL_BED_SUMMON.run(c, { do: 'REVEAL_BED_SUMMON', n: 4, match: { family: ['Fungal Tree'] } });
    return { beds: P.nexus.filter(n => n.id === 'BS73-T001').length, sp: P.spirits.length, deck: P.deck.length, d0, tree: tree.length, hand: P.hand.length, trash: P.trash.length, rev: (P.revealed || []).length };
  })()`);
  const j = JSON.stringify(r);
  assert.equal(r.tree, 2, j);
  assert.equal(r.beds, 0, j); assert.equal(r.sp, 3, j); assert.equal(r.deck, r.d0 - 2, j);
});

test('K-1710 BS73-TX02B FLASH_COST_LOCK: Magic with cost <= counters is unusable in the owner Attack Step Flash, higher cost still usable', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const fl = Object.keys(BS.CARDS).filter(id => BS.CARDS[id].type === 'Magic' && BS.CARDS[id].magic && (BS.CARDS[id].magic.timing || []).includes('FLASH') && !BS.CARDS[id].magic.by);
    const lo = fl.find(id => BS.CARDS[id].cost <= 2), hi = fl.find(id => BS.CARDS[id].cost >= 4 && BS.CARDS[id].cost <= 5);
    const s = BS.mkInst('BS73-TX02B'); s.cores = 3; P.spirits = [s]; P.count = 3; P.nexus = []; P.void = 12; G.step = 5; G.active = P.key;
    const use = (pl, id) => { const h = BS.mkInst(id); pl.hand = [h]; return BS.magicUsable(pl, h, 'flash'); };
    const res = { lock: [use(P, lo), use(O, lo)] , hi: use(P, hi) };
    G.step = 4; res.main = use(P, lo); G.step = 5; G.active = O.key; res.off = use(P, lo);
    return { res, lo, hi };
  })()`);
  const j = JSON.stringify(r);
  assert.ok(r.lo && r.hi, j);
  assert.deepEqual(r.res.lock, [false, false], j); assert.equal(r.res.hi, true, j); assert.equal(r.res.off, true, j);
});
