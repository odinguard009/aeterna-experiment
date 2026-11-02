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
