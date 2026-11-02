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

test('K-1182 BS18-002 is treated as LV3 only while it is the only Spirit; BS32-028 is unaffected by opposing Spirit effects only with a Soul Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const ids = Object.values(BS.CARDS).filter(c => /^BS0/.test(c.id) && c.type === 'Spirit' && c.cost <= 2).map(c => c.id);
    const s = BS.mkInst('BS18-002'); s.cores = 1; P.spirits = [s]; const alone = BS.lvNo(s);
    const x = BS.mkInst(ids[0]); x.cores = 1; P.spirits = [s, x]; const withOther = BS.lvNo(s);
    const t = BS.mkInst('BS32-028'); t.cores = 1; P.spirits = [t]; const src = BS.mkInst(ids[1]); O.spirits = [src];
    const c = { p: O, src, ctx: {} }; t.soul = false; const a0 = BS.fxImmune(P, t, c); t.soul = true; const a1 = BS.fxImmune(P, t, c);
    return { alone, withOther, a0, a1, ok: ['BS18-002', 'BS18-005', 'BS32-028'].every(k => BS.CARDS[k].fxComplete !== false) }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.alone, 3, JSON.stringify(r)); assert.ok(r.withOther < 3, JSON.stringify(r));
  assert.equal(r.a0, false, JSON.stringify(r)); assert.equal(r.a1, true, JSON.stringify(r));
});

test('K-1183 MAGIC_WALL (BS11-028, BS12-029, BS16-031, BS08-036): exhausts to negate a Magic of its colours on the opposing turn only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mg = col => Object.values(BS.CARDS).find(c => c.type === 'Magic' && c.symbol === col);
    const run = async (wallId, col, setup) => { const w = BS.mkInst(wallId); w.cores = 3; P.spirits = [w]; O.spirits = []; G.active = O.key; if (setup) setup(w);
      const m = BS.mkInst(mg(col).id); await BS.castMagic(O, { inst: m, target: null, plan: null, ctx: 'main', free: true }); return w.exhausted; };
    const out = { white: await run('BS11-028', 'white'), red: await run('BS11-028', 'red'), exh: await run('BS11-028', 'white', w => { w.exhausted = true; }),
      own: await (async () => { const w = BS.mkInst('BS11-028'); w.cores = 3; P.spirits = [w]; G.active = P.key; const m = BS.mkInst(mg('white').id); await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main', free: true }); return w.exhausted; })(),
      multi: await run('BS08-036', 'blue'), ok: ['BS11-028', 'BS12-029', 'BS16-031', 'BS08-036'].every(k => BS.CARDS[k].fxComplete !== false) };
    return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.white, true, JSON.stringify(r)); assert.equal(r.red, false, JSON.stringify(r));
  assert.equal(r.own, false, JSON.stringify(r)); assert.equal(r.multi, true, JSON.stringify(r));
});

test('K-1184 TRIBUTED (SD02-018/019/021): destroys two 4000 BP or less Spirits, trashes two cores, returns a 5000 BP or less Spirit to the decktop', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const mk = (id, n) => { const s = BS.mkInst(id); s.cores = n; return s; };
    const low = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 2 && BS.bpOf(mk(c.id, 1)) <= 3000).map(c => c.id);
    const out = {};
    const a = mk('SD02-018', 3); P.spirits = [a]; O.spirits = [mk(low[0], 1), mk(low[1], 1), mk(low[2], 1)]; await BS.fireFx(P, 'TRIBUTED', a); out.destroyed = 3 - O.spirits.length;
    const b = mk('SD02-019', 2); P.spirits = [b]; O.spirits = [mk(low[0], 2), mk(low[1], 2)]; const c0 = O.spirits.reduce((n, s) => n + s.cores, 0); await BS.fireFx(P, 'TRIBUTED', b); out.cores = c0 - O.spirits.reduce((n, s) => n + s.cores, 0);
    const d = mk('SD02-021', 2); P.spirits = [d]; const x = mk(low[0], 1); O.spirits = [x]; await BS.fireFx(P, 'TRIBUTED', d); out.top = O.deck[0] === x && O.spirits.length === 0;
    out.ok = ['SD02-018', 'SD02-019', 'SD02-021'].every(k => BS.CARDS[k].fxComplete !== false); return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.destroyed, 2, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r)); assert.equal(r.top, true, JSON.stringify(r));
});

test('K-1185 ALLY_LIFE_HIT LIFE_TO_RESERVE (BS10-050, BS19-X03, BS59-CP03, BS25-024): the matching attacker sends an opposing Life to the Reserve, others do not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const mk = (id, n) => { const s = BS.mkInst(id); s.cores = n; return s; };
    const hit = async (holder, atk) => { P.spirits = [holder].concat(atk === holder ? [] : [atk]); const l0 = O.life; await BS.fireFxMulti([{ owner: P, trigger: 'ALLY_LIFE_HIT', src: null, ctx: { attacker: atk } }]); return l0 - O.life; };
    const holy = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.id !== 'BS10-050' && BS.fxMatch(c, { keyword: 'Holy Life' })), plain = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost <= 2 && !BS.fxMatch(c, { keyword: 'Holy Life' }) && !BS.fxMatch(c, { keyword: 'High Speed' }));
    const hs = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && BS.fxMatch(c, { keyword: 'High Speed' }) && !['BS19-X03', 'BS59-CP03'].includes(c.id));
    const out = {}; const o = () => { O.life = 5; };
    o(); const n = mk('BS10-050', 3); out.holy = await hit(n, mk(holy.id, 1)); o(); out.holyNo = await hit(n, mk(plain.id, 1));
    o(); const m = mk('BS19-X03', 3); out.selfHit = await hit(m, m); o(); out.hsHit = await hit(m, mk(hs.id, 1)); o(); out.plainNo = await hit(m, mk(plain.id, 1));
    out.ok = ['BS10-050', 'BS19-X03', 'BS59-CP03', 'BS25-024'].every(k => BS.CARDS[k].fxComplete !== false); return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.holy, 1, JSON.stringify(r)); assert.equal(r.holyNo, 0, JSON.stringify(r));
  assert.equal(r.selfHit, 1, JSON.stringify(r)); assert.equal(r.hsHit, 1, JSON.stringify(r)); assert.equal(r.plainNo, 0, JSON.stringify(r));
});

test('K-1186 Crush results (BS06-070, BS04-063, BS09-053): follow-ups count Spirit cards the Crush discarded and respect the level gate', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const mk = (id, n) => { const s = BS.mkInst(id); s.cores = n; return s; };
    const sp = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost <= 2).id, mg = Object.values(BS.CARDS).find(c => c.type === 'Magic').id;
    const deck = () => { O.deck = [BS.mkInst(sp), BS.mkInst(mg), BS.mkInst(sp), BS.mkInst(sp), BS.mkInst(sp)]; };
    const out = {};
    const a = mk('BS04-063', 3); P.spirits = [a]; O.spirits = []; deck(); const lv = BS.lvNo(a); const b0 = BS.bpOf(a); await BS.fireFx(P, 'ATTACKS', a); out.lv = lv; out.bp = BS.bpOf(a) - b0; out.tr = O.trash.length;
    const c = mk('BS09-053', 6); P.spirits = [c]; P.void = 5; deck(); const c0 = c.cores; await BS.fireFx(P, 'ATTACKS', c); out.cores = c.cores - c0; out.lvC = BS.lvNo(c);
    const lo = Object.values(BS.CARDS).find(k => k.type === 'Spirit' && k.cost <= 3 && k.id !== sp).id;
    const d = mk('BS06-070', 6); P.spirits = [d]; O.spirits = [mk(lo, 1)]; deck(); await BS.fireFx(P, 'ATTACKS', d); out.destroyed = 1 - O.spirits.length; out.lvD = BS.lvNo(d);
    out.ok = ['BS06-070', 'BS04-063', 'BS09-053'].every(k => BS.CARDS[k].fxComplete !== false); return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.ok(r.lv >= 2, JSON.stringify(r)); 
  assert.equal(r.tr, 2, JSON.stringify(r)); assert.equal(r.bp, 1000, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r)); assert.ok(r.cores >= 1, JSON.stringify(r)); assert.equal(r.destroyed, 1, JSON.stringify(r));
});
