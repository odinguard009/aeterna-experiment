import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const pre = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
  const sp = (pred) => Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && !c.token && pred(c); });
  P.nexus = []; P.onceUsed = {};
  const run = (m, id) => BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.actions });`;

test('K-1132 BS73-049 Bluezirco: Flash gives up to three opposing Spirits -7000 BP and returns 0 BP targets to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.mkInst('BS73-049'); P.hand = [m];
    const ids = [sp(c => c.levels[0].bp <= 7000 && c.levels[0].bp > 0), sp(c => c.levels[0].bp >= 12000)];
    const a = BS.mkInst(ids[0]); a.cores = 1; const b = BS.mkInst(ids[1]); b.cores = 1; O.spirits = [a, b]; const d0 = O.deck.length;
    await run(m, 'BS73-049');
    return { spirits: O.spirits.length, deck: O.deck.length - d0, b: BS.bpOf(b), partial: BS.CARDS['BS73-049'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.spirits, 1, JSON.stringify(r)); assert.equal(r.deck, 1, JSON.stringify(r));
});

test('K-1133 BS73-049 Bluezirco: When Attacks -10000 BP destroys a 0 BP target and draws two cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const s = BS.mkInst('BS73-049'); s.cores = 2; P.spirits = [s]; P.hand = [];
    P.deck = [BS.mkInst(sp(c => c.cost <= 2)), BS.mkInst(sp(c => c.cost <= 2)), BS.mkInst(sp(c => c.cost <= 2))];
    const a = BS.mkInst(sp(c => c.levels[0].bp > 0 && c.levels[0].bp <= 10000)); a.cores = 1; O.spirits = [a];
    await BS.fireFx(P, 'ATTACKS', s, {});
    return { opp: O.spirits.length, hand: P.hand.length }; })()`);
  assert.equal(r.opp, 0, JSON.stringify(r)); assert.equal(r.hand, 2, JSON.stringify(r));
});

test('K-1134 BS74-X07 Fluora: Flash summons a Prismwing from the Trash paying 1 cost and returns one to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.mkInst('BS74-X07'); P.hand = [m];
    const w = BS.mkInst('BS73-044'); const w2 = BS.mkInst('BS73-045'); P.trash = [w, w2]; P.reserve.n = 5; P.spirits = [];
    await run(m, 'BS74-X07');
    return { field: P.spirits.length, hand: P.hand.length, trash: P.trash.length, partial: BS.CARDS['BS74-X07'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.field, 1, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r));
});

test('K-1135 BS73-050 Koon-Zite: When Attacks casts the Flash of a Prismwing Magic in the Trash for free (Magic ends in the Trash)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const s = BS.mkInst('BS73-050'); s.cores = 3; const w = BS.mkInst('BS73-044'); w.cores = 1; w.exhausted = true; P.spirits = [s, w];
    const g = BS.mkInst('BS73-080'); P.trash = [g]; P.hand = []; P.reserve.n = 0;
    await BS.fireFx(P, 'ATTACKS', s, {});
    return { refreshed: w.exhausted === false, trash: P.trash.includes(g), hand: P.hand.length, reserve: P.reserve.n }; })()`);
  assert.equal(r.refreshed, true, JSON.stringify(r)); assert.equal(r.trash, true, JSON.stringify(r)); assert.equal(r.hand, 0, JSON.stringify(r)); assert.equal(r.reserve, 0, JSON.stringify(r));
});

test('K-1136 BS73-CX02 Morrigan: Flash bounce-summon returns a non-battling Yellow-only Spirit and summons a cheaper Prismwing from the Hand free', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const nx = BS.mkInst('BS73-CX02'); nx.cores = 3; P.nexus = [nx];
    const hi = BS.mkInst('BS73-049'); hi.cores = 2; P.spirits = [hi];
    const lo = BS.mkInst('BS73-044'); P.hand = [lo];
    await BS.runActions({ p: P, opp: O, src: nx, ctx: { selfInst: nx } }, { actions: [{ do: 'MORRIGAN_BOUNCE_SUMMON', match: { family: ['Prismwing'] } }] });
    return { field: P.spirits.map(s => s.id), hand: P.hand.map(s => s.id), partial: BS.CARDS['BS73-CX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.field, ['BS73-044'], JSON.stringify(r)); assert.deepEqual(r.hand, ['BS73-049'], JSON.stringify(r));
});

test('K-1137 BS73-CX02 Morrigan: a Spirit returned to the Hand fires OWN_RETURNED', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const nx = BS.mkInst('BS73-CX02'); nx.cores = 3; P.nexus = [nx]; P.hand = [];
    const f = BS.mkInst('BS73-044'); f.cores = 1; P.spirits = [f];
    G.evQ = []; BS.bounceCard(P, f, 'hand');
    return { ev: G.evQ.map(e => e.type), hand: P.hand.length }; })()`);
  assert.ok(r.ev.includes('OWN_RETURNED'), JSON.stringify(r)); assert.equal(r.hand, 1, JSON.stringify(r));
});

test('K-1138 BS73-044 Quoise: Lv2 reveals three, adds a Mani Prismwing Spirit and a Prismwing Magic/Nexus, discards the rest', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const q = BS.mkInst('BS73-044'); q.cores = 2; P.spirits = [q]; P.hand = [];
    P.deck = [BS.mkInst('BS73-050'), BS.mkInst('BS73-080'), BS.mkInst(sp(c => !(c.families || []).includes('Prismwing'))), BS.mkInst(sp(c => c.cost <= 2))]; P.trash = [];
    await BS.fireFx(P, 'SUMMONED', q, {});
    return { hand: P.hand.map(x => x.id).sort(), trash: P.trash.length, deck: P.deck.length, partial: BS.CARDS['BS73-044'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.hand, ['BS73-050', 'BS73-080'], JSON.stringify(r)); assert.equal(r.trash, 1, JSON.stringify(r));
});

test('K-1139 BS74-053 Yellodianna: reveals one card per Prismwing Spirit/Nexus, adds a Yellow Magic, rest to the deckbottom; LV2 locks opposing hand-increase effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const y = BS.mkInst('BS74-053'); y.cores = 2; const w = BS.mkInst('BS73-044'); w.cores = 1; P.spirits = [y, w]; P.hand = [];
    P.deck = [BS.mkInst(sp(c => c.cost <= 2)), BS.mkInst('BS73-080'), BS.mkInst(sp(c => c.cost <= 2))]; P.trash = [];
    await BS.fireFx(P, 'ATTACKS', y, {});
    G.active = P.key; const lockOn = handUpLocked(P.key); y.cores = 1; const lockLv1 = handUpLocked(P.key); G.active = O.key; const lockOff = handUpLocked(P.key);
    return { hand: P.hand.map(x => x.id), deck: P.deck.length, trash: P.trash.length, partial: BS.CARDS['BS74-053'].partial, lockOn, lockLv1, lockOff }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.hand, ['BS73-080'], JSON.stringify(r)); assert.equal(r.deck, 2, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r));
  assert.equal(r.lockOn, true, JSON.stringify(r)); assert.equal(r.lockLv1, false, JSON.stringify(r)); assert.equal(r.lockOff, false, JSON.stringify(r));
});

test('K-1140 BS74-055 Aquamarine: Flash returns a non-highest-level opposing Spirit to the deckbottom, not a highest-level one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.mkInst('BS74-055'); P.hand = [m];
    const k = sp(c => c.levels.length === 3); const a = BS.mkInst(k); a.cores = 1; O.spirits = [a];
    await run(m, 'BS74-055'); const low = O.spirits.length;
    const b = BS.mkInst(k); b.cores = 9; O.spirits = [b]; await run(m, 'BS74-055');
    return { low, high: O.spirits.length, partial: BS.CARDS['BS74-055'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.low, 0, JSON.stringify(r)); assert.equal(r.high, 1, JSON.stringify(r));
});

test('K-1141 BS74-055 Aquamarine: returned from the Trash by a Yellow-only effect, its Flash can be used free', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const src = BS.mkInst('BS73-044'); P.spirits = [src]; const aq = BS.mkInst('BS74-055'); P.trash = [aq]; P.hand = []; P.reserve.n = 0;
    const k = sp(c => c.levels.length === 3); const t = BS.mkInst(k); t.cores = 1; O.spirits = [t]; const d0 = O.deck.length;
    await BS.runActions({ p: P, opp: O, src, ctx: { selfInst: src } }, { actions: [{ do: 'RETURN_TRASH', n: 1, match: { name: ['Aquamarine'] } }] });
    return { opp: O.spirits.length, deck: O.deck.length - d0, handHas: P.hand.includes(aq), onField: P.spirits.includes(aq) }; })()`);
  assert.equal(r.opp, 0, JSON.stringify(r)); assert.equal(r.deck, 1, JSON.stringify(r));
});
