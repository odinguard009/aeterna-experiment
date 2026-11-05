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

test('K-1711 BS75-CP03 is complete and EXHAUST_UNPREVENTABLE only applies to Fungal Tree / Contractor Yum-Kaax sources', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const tree = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].families || []).includes('Fungal Tree') && id !== 'BS75-CP03');
    const other = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && !(BS.CARDS[id].families || []).includes('Fungal Tree') && BS.CARDS[id].name !== 'Contractor Yum-Kaax');
    const s = BS.mkInst('BS75-CP03'); s.cores = 3; P.spirits = [s];
    const a = BS.mkInst(tree), b = BS.mkInst(other);
    const res = { complete: BS.CARDS['BS75-CP03'].partial === false, tree: !!BS.exhUnprev({ p: P, opp: O, src: a }), other: !!BS.exhUnprev({ p: P, opp: O, src: b }) };
    P.spirits = []; res.none = !!BS.exhUnprev({ p: P, opp: O, src: a });
    return res;
  })()`);
  const j = JSON.stringify(r);
  assert.deepEqual(r, { complete: true, tree: true, other: false, none: false }, j);
});

test('K-1712 Prismwing cards BS73-043/048/051 (+B) and P25-04 are complete; Rebirth keyword matches Rebirth cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const ids = ['BS73-043', 'BS73-043B', 'BS73-048', 'BS73-048B', 'BS73-051', 'BS73-051B', 'P25-04'];
    const res = { incomplete: ids.filter(id => !BS.CARDS[id] || BS.CARDS[id].partial !== false) };
    res.hits = ['BS73-051', 'BS73-043'].filter(id => fxMatch(BS.CARDS[id], { keyword: 'Rebirth', color: 'yellow' })).length;
    return res;
  })()`);
  const j = JSON.stringify(r);
  assert.deepEqual(r.incomplete, [], j);
  assert.equal(r.hits, 2, j);
});

test('K-1713 BS73-TX04: FLASH_RESOLVED gives +1 core, flips at 4+ cores and trims the new Spirit to its LV1 cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const n = BS.mkInst('BS73-TX04'); n.cores = 3; P.nexus = [n]; P.spirits = []; P.reserve.n = 3; P.void = 0; P.count = 0;
    await BS.fireFx(P, 'FLASH_RESOLVED', null, { subject: BS.mkInst('BS73-051') });
    const b = P.spirits.find(s => s.id === 'BS73-TX04B');
    return { flipped: !!b, nexusLeft: P.nexus.length, cores: b ? b.cores : -1, voidN: P.void, complete: BS.CARDS['BS73-TX04'].partial === false && BS.CARDS['BS73-TX04B'].partial === false };
  })()`);
  const j = JSON.stringify(r);
  assert.ok(r.complete, j); assert.ok(r.flipped, j); assert.equal(r.nexusLeft, 0, j); assert.equal(r.cores, 1, j);
});

test('K-1714 BS73-TX04B: NO_LOSE_NEXT_TURN once per game, SELF_UNAFFECTED_TURN marks the Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const s = BS.mkInst('BS73-TX04B'); s.cores = 2; P.spirits = [s];
    const c = { p: P, opp: O, src: s, ctx: {} };
    await BS.FX_ACTIONS.NO_LOSE_NEXT_TURN.run(c, { do: 'NO_LOSE_NEXT_TURN' });
    const first = P.noLoseThru; P.noLoseThru = 0;
    const c2 = { p: P, opp: O, src: s, ctx: {} };
    await BS.FX_ACTIONS.NO_LOSE_NEXT_TURN.run(c2, { do: 'NO_LOSE_NEXT_TURN' });
    await BS.FX_ACTIONS.SELF_UNAFFECTED_TURN.run({ p: P, opp: O, src: s, ctx: {} }, { do: 'SELF_UNAFFECTED_TURN' });
    return { first: first === G.turnNo + 2, second: P.noLoseThru, did2: c2.ctx.did, un: s.unaffTurn === G.turnNo };
  })()`);
  const j = JSON.stringify(r);
  assert.ok(r.first, j); assert.equal(r.second, 0, j); assert.equal(r.did2, false, j); assert.ok(r.un, j);
});
