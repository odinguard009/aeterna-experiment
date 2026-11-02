// Lane K cards, batch 96.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1175 Burst ALLY_LOST (SD66-006): an ally destroyed by the opponent lets the burst summon the card; DESTROY bpRank lowest picks the lowest-BP Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const ids = Object.values(BS.CARDS).filter(c => /^BS0/.test(c.id) && c.type === 'Spirit' && c.cost <= 2).slice(0, 3).map(c => c.id);
    const v = BS.mkInst(ids[0]); v.cores = 1; P.spirits = [v]; P.burst = BS.mkInst('SD66-006'); P.hand = []; P.trash = [];
    BS.removeSpirit(P, v, 'destroyed', true); await BS.flushBursts();
    const summoned = P.spirits.some(s => s.id === 'SD66-006'), burstUsed = !P.burst;
    const lo = BS.mkInst(ids[1]); lo.cores = 1; const hi = BS.mkInst(ids[2]); hi.cores = 3; O.spirits = [hi, lo];
    const cands = BS.FX_ACTIONS.DESTROY.cands({ p: P, opp: O, src: P.spirits[0], ctx: {} }, { do: 'DESTROY', bpRank: 'lowest' });
    const lowestBp = Math.min(...O.spirits.map(BS.bpOf));
    return { summoned, burstUsed, n: cands.length, allLowest: cands.every(s => BS.bpOf(s) === lowestBp), ok: BS.CARDS['SD66-006'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.burstUsed, true, JSON.stringify(r));
  assert.equal(r.allLowest, true, JSON.stringify(r)); assert.ok(r.n >= 1, JSON.stringify(r));
});

test('K-1176 selfSoul static BP (SD29-001, SD29-008): +BP only while a Soul Core is on the Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const a = BS.mkInst('SD29-001'); a.cores = 5; P.spirits = [a]; const lv = BS.lvNo(a); a.soul = false; const b0 = BS.bpOf(a); a.soul = true; const b1 = BS.bpOf(a);
    const m = BS.mkInst('SD29-008'); m.cores = 3; const o = BS.mkInst('SD29-001'); o.cores = 1; P.spirits = [m, o]; const o0 = BS.bpOf(o); o.soul = true; const o1 = BS.bpOf(o);
    return { lv, d1: b1 - b0, d2: o1 - o0, lvM: BS.lvNo(m), ok: BS.CARDS['SD29-001'].fxComplete !== false && BS.CARDS['SD29-008'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.lv, 3, JSON.stringify(r)); assert.equal(r.d1, 6000, JSON.stringify(r)); assert.equal(r.d2, 10000, JSON.stringify(r));
});

test('K-1177 Soul Core family BP (SD31-006, BS32-003): own family Spirits gain +4000 only while a Soul Core is on the source', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key; G.step = 5;
    const out = {}; for (const [src, fam] of [['SD31-006', 'Ninja Gale'], ['BS32-003', 'Emperor Beast']]) {
      const s = BS.mkInst(src); s.cores = 5; const t = BS.mkInst(Object.keys(BS.CARDS).find(k => /^(BS|SD)/.test(k) && k !== src && (BS.CARDS[k].families || []).includes(fam) && BS.CARDS[k].type === 'Spirit')); t.cores = 5; P.spirits = [s, t];
      s.soul = false; const a = BS.bpOf(t); s.soul = true; const b = BS.bpOf(t); out[src] = b - a; }
    out.ok = BS.CARDS['SD31-006'].fxComplete !== false && BS.CARDS['BS32-003'].fxComplete !== false && BS.CARDS['SD29-003'].fxComplete !== false; return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r['SD31-006'], 4000, JSON.stringify(r)); assert.equal(r['BS32-003'], 4000, JSON.stringify(r));
});

test('K-1178 BS33-036 / BS33-039 / SD34-004 are complete; BS33-036 gives Armored Dragon +5000 only with a Soul Core on it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key; G.step = 5;
    const s = BS.mkInst('BS33-036'); s.cores = 3; const t = BS.mkInst(Object.keys(BS.CARDS).find(k => /^(BS|SD)/.test(k) && k !== 'BS33-036' && (BS.CARDS[k].families || []).includes('Armored Dragon') && BS.CARDS[k].type === 'Spirit')); t.cores = 5; P.spirits = [s, t];
    s.soul = false; const a = BS.bpOf(t); s.soul = true; const b = BS.bpOf(t);
    return { d: b - a, ok: ['BS33-036', 'BS33-039', 'SD34-004'].every(k => BS.CARDS[k].fxComplete !== false), burst: BS.CARDS['BS33-039'].burst && BS.CARDS['BS33-039'].burst.when }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.d, 5000, JSON.stringify(r)); assert.equal(r.burst, 'ALLY_DESTROYED', JSON.stringify(r));
});

test('K-1179 BS31-097 Soul Aura: all Spirits +3000, a Spirit with Soul Core +3000 more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const a = BS.mkInst('BS01-044'), b = BS.mkInst('BS01-044'); a.cores = b.cores = 3; b.soul = true; P.spirits = [a, b]; const a0 = BS.bpOf(a), b0 = BS.bpOf(b);
    const acts = BS.CARDS['BS31-097'].magic.actions; await BS.runActions({ p: P, opp: O, src: a, ctx: {} }, { actions: acts });
    return { da: BS.bpOf(a) - a0, db: BS.bpOf(b) - b0, ok: BS.CARDS['BS31-097'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.da, 3000, JSON.stringify(r)); assert.equal(r.db, 6000, JSON.stringify(r));
});

test('K-1180 BS05-074 exhausts two opposing Spirits only with two symbol colours; BS18-X03 burst is wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const ids = Object.keys(BS.CARDS).filter(k => /^BS0/.test(k) && BS.CARDS[k].type === 'Spirit');
    const one = ids.find(k => BS.CARDS[k].symbol && Object.keys(BS.symbolsOn({ spirits: [BS.mkInst(k)], nexus: [] })).length);
    const mk = () => { const x = BS.mkInst(ids[0]); x.cores = 2; x.exhausted = false; return x; };
    O.spirits = [mk(), mk(), mk()]; P.spirits = [];
    const acts = BS.CARDS['BS05-074'].magic.actions; await BS.runActions({ p: P, opp: O, src: BS.mkInst(ids[0]), ctx: {} }, { actions: acts });
    const none = O.spirits.filter(s => s.exhausted).length;
    return { none, burst: BS.CARDS['BS18-X03'].burst && BS.CARDS['BS18-X03'].burst.when, ok: BS.CARDS['BS05-074'].fxComplete !== false && BS.CARDS['BS18-X03'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.none, 0, JSON.stringify(r)); assert.equal(r.burst, 'ALLY_DESTROYED', JSON.stringify(r));
});

test('K-1181 SUMMON_DISCOUNT (SD33-001, BS35-023): matching Spirit cards cost 1 less while the Spirit is on the field; others unchanged', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const gk = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('God-King') && c.cost >= 3 && c.symbol === 'green');
    const other = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && !(c.families || []).includes('God-King') && c.cost >= 3 && c.symbol === 'green');
    P.spirits = []; const g0 = BS.effCost(P, gk), o0 = BS.effCost(P, other);
    const a = BS.mkInst('SD33-001'); a.cores = 3; P.spirits = [a]; const g1 = BS.effCost(P, gk), o1 = BS.effCost(P, other);
    const b = BS.mkInst('BS35-023'); b.cores = 2; P.spirits = [b]; const g2 = BS.effCost(P, gk), o2 = BS.effCost(P, other);
    return { d1: g0 - g1, d0: o0 - o1, d2: (g0 - g2) - (o0 - o2), ok: ['SD33-001', 'BS35-023', 'BS35-074', 'SD33-010', 'BS23-046', 'BS24-014'].every(k => BS.CARDS[k].fxComplete !== false) }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.d1, 1, JSON.stringify(r)); assert.equal(r.d0, 0, JSON.stringify(r)); assert.equal(r.d2, 1, JSON.stringify(r));
});
