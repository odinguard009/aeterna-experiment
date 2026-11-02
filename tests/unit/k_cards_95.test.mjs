// Lane K cards, batch 95.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1150 BS19-107 refreshes a Spirit, or (nothing to refresh) gives all your Spirits +3000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const a = BS.mkInst('BS01-001'); a.cores = 1; a.exhausted = true; P.spirits = [a]; P.reserve.n = 20;
    const m = BS.mkInst('BS19-107'); P.hand = [m]; const b0 = BS.bpOf(a);
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    const first = { ex: !!a.exhausted, d: BS.bpOf(a) - b0 };
    const m2 = BS.mkInst('BS19-107'); P.hand = [m2]; const b1 = BS.bpOf(a);
    await BS.castMagic(P, { inst: m2, target: null, plan: null, ctx: 'flash' });
    return { first, second: BS.bpOf(a) - b1, ok: BS.CARDS['BS19-107'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.first, { ex: false, d: 0 }, JSON.stringify(r));
  assert.equal(r.second, 3000, JSON.stringify(r));
});

test('K-1151 SD20-015 returns every opposing Cost 3 or less Spirit, or one non-braved Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; };
    const cheap = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 3).slice(0, 2).map(c => c.id);
    O.spirits = [mk(cheap[0]), mk(cheap[1])]; P.reserve.n = 20; const m = BS.mkInst('SD20-015'); P.hand = [m]; const h0 = O.hand.length;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return { left: O.spirits.length, hand: O.hand.length - h0, ok: BS.CARDS['SD20-015'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.left, r.hand], [0, 2], JSON.stringify(r));
});

// run a Magic's action list with the Soul Core paid or not
const runMagic = (id, soul, setup, read) => `(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
  const m = BS.mkInst('${id}'); m.soulPaid = ${soul}; const mk = (id, cores = 2) => { const s = BS.mkInst(id); s.cores = cores; return s; }; ${setup}
  await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['${id}'].magic.actions });
  return { ok: BS.CARDS['${id}'].fxComplete !== false, ...(${read}) }; })()`;
const cheap = `Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 3 && c.cost >= 1).map(c => c.id)`;

test('K-1152 BS31-102 sends one core from an opposing Spirit to the Reserve, one more with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, n] of [[false, 1], [true, 2]]) {
    const r = await page.evaluate(runMagic('BS31-102', soul, `const L = ${cheap}; O.spirits = [mk(L[0], 3), mk(L[1], 3)]; const c0 = O.spirits.reduce((a, s) => a + s.cores, 0);`, `{ lost: c0 - O.spirits.reduce((a, s) => a + s.cores, 0) }`));
    assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.lost, n, JSON.stringify(r));
  }
});

test('K-1153 BS34-077 exhaust an opposing Spirit to refresh a Ninja Gale Spirit; Soul Core puts a Void core in the Reserve', async () => {
  const { page } = await sharedBoard();
  const ng = `Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Ninja Gale')).id`;
  for (const soul of [false, true]) {
    const r = await page.evaluate(runMagic('BS34-077', soul, `const a = mk(${ng}); a.exhausted = true; P.spirits = [a]; O.spirits = [mk(${cheap}[0])]; P.void = P.void || { n: 0 }; const v0 = P.reserve.n;`, `{ opEx: !!O.spirits[0].exhausted, refreshed: !a.exhausted, v: P.reserve.n - v0 }`));
    assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.opEx, true, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r));
  }
});

test('K-1154 BS35-092 exhausts one Spirit or three Cost 4 or less; with the Soul Core both', async () => {
  const { page } = await sharedBoard();
  for (const [soul, n] of [[false, 1], [true, 4]]) {
    const r = await page.evaluate(runMagic('BS35-092', soul, `const L = ${cheap}; O.spirits = [mk(L[0]), mk(L[1]), mk(L[2]), mk(L[3]), mk(L[4])];`, `{ ex: O.spirits.filter(s => s.exhausted).length }`));
    assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.ex, n, JSON.stringify(r));
  }
});

test('K-1155 SD37-013 / BS40-080 / BS31-098 destroy a braved Brave, then the follow-up destroy', async () => {
  const { page } = await sharedBoard();
  const brv = `Object.values(BS.CARDS).find(c => c.type === 'Brave').id`;
  const setup = `const L = ${cheap}; const a = mk(L[0]); a.brave = BS.mkInst(${brv}); O.spirits = [a, mk(L[1]), mk(L[2])];`;
  for (const [id, soul, left] of [['SD37-013', false, 2], ['BS31-098', false, 3], ['BS31-098', true, 2], ['BS40-080', false, null]]) {
    const r = await page.evaluate(runMagic(id, soul, setup, `{ left: O.spirits.length, brave: O.spirits.filter(s => s.brave).length }`));
    assert.equal(r.ok, true, JSON.stringify(r)); if (left == null) assert.ok(r.left < 3 && r.brave === 0, id + ' ' + JSON.stringify(r)); else assert.equal(r.left, left, id + ' ' + JSON.stringify(r));
  }
});

test('K-1156 BS11-081 draws a card and gives Brilliance/Holy Life Spirits +1000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const kw = k => Object.values(BS.CARDS).find(c => c.type === 'Spirit' && BS.cardHasKeyword(c, k)).id;
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; return s; };
    const a = mk(kw('Brilliance')), b = mk(kw('Holy Life')), z = mk('BS01-001'); P.spirits = [a, b, z]; const m = BS.mkInst('BS11-081'); const h0 = P.hand.length, base = [a, b, z].map(s => BS.bpOf(s));
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS11-081'].magic.actions });
    return { d: P.hand.length - h0, bp: [a, b, z].map((s, i) => BS.bpOf(s) - base[i]), ok: BS.CARDS['BS11-081'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.d, 1, JSON.stringify(r)); assert.deepEqual(r.bp, [1000, 1000, 0], JSON.stringify(r));
});

test('K-1157 BS08-075 gives Dark/Black-named Spirits +2000 BP per exhausted Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const dk = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && /^(Dark|Black)/.test(c.name)).id;
    const mk = (id, ex) => { const s = BS.mkInst(id); s.cores = 1; s.exhausted = ex; return s; };
    const a = mk(dk, true), b = mk('BS01-001', true), c = mk('BS01-001', false); P.spirits = [a, b, c]; const m = BS.mkInst('BS08-075'); const base = [a, c].map(s => BS.bpOf(s));
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS08-075'].magic.actions });
    return { bp: [a, c].map((s, i) => BS.bpOf(s) - base[i]), ok: BS.CARDS['BS08-075'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.bp, [4000, 0], JSON.stringify(r));
});

test('K-1158 BS01-142 / BS09-076 / BS06-103 refresh all exhausted Spirits; the non-exempt ones cannot attack this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.turnNo = 5;
    const find = f => Object.values(BS.CARDS).find(c => c.type === 'Spirit' && f(c)).id;
    const tri = find(c => BS.cardHasKeyword(c, 'Tribute')), mw = find(c => (c.families || []).includes('Mounted Warrior')), pl = find(c => !BS.cardHasKeyword(c, 'Tribute') && !(c.families || []).includes('Mounted Warrior'));
    const mk = id => { const s = BS.mkInst(id); s.cores = 1; s.exhausted = true; return s; }; const out = {};
    for (const [id, ex] of [['BS01-142', null], ['BS09-076', tri], ['BS06-103', mw]]) {
      const a = mk(pl), b = mk(ex || pl); P.spirits = [a, b]; const m = BS.mkInst(id);
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS[id].magic.actions });
      out[id] = { refreshed: [a, b].map(s => !s.exhausted), noAtk: [a, b].map(s => s.noAtkTurn === G.turnNo), ok: BS.CARDS[id].fxComplete !== false }; }
    return out; })()`);
  for (const id of ['BS01-142', 'BS09-076', 'BS06-103']) assert.equal(r[id].ok, true, JSON.stringify(r));
  assert.deepEqual(r['BS01-142'].noAtk, [true, true], JSON.stringify(r));
  for (const id of ['BS09-076', 'BS06-103']) { assert.deepEqual(r[id].refreshed, [true, true], JSON.stringify(r)); assert.deepEqual(r[id].noAtk, [true, false], id + JSON.stringify(r)); }
});

test('K-1159 BS06-112 treats only your Fighting Spirit family Spirits as their highest LV', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const fs = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels.length > 1 && (c.families || []).includes('Fighting Spirit')).id;
    const ot = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels.length > 1 && !(c.families || []).includes('Fighting Spirit')).id;
    const a = BS.mkInst(fs), b = BS.mkInst(ot); a.cores = b.cores = 1; P.spirits = [a, b]; const m = BS.mkInst('BS06-112');
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS06-112'].magic.actions });
    return { a: !!a.lvHighTurn, b: !!b.lvHighTurn, ok: BS.CARDS['BS06-112'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual([r.a, r.b], [true, false], JSON.stringify(r));
});

test('K-1160 BS31-112 draws three and discards two, or one with a WisdomKing/Douji Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const wk = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && /WisdomKing/.test(c.name)).id; const out = [];
    for (const sp of [[], [wk]]) { P.spirits = sp.map(id => { const s = BS.mkInst(id); s.cores = 1; return s; }); const h0 = P.hand.length; const m = BS.mkInst('BS31-112');
      await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['BS31-112'].magic.by.MAIN.actions }); out.push(P.hand.length - h0); }
    return { out, ok: BS.CARDS['BS31-112'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.out, [1, 2], JSON.stringify(r));
});

test('K-1161 BS17-017 sends a core from an opposing Spirit to the Trash when its owner sets a Burst', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const id = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost <= 3 && !c.effects && c.id !== 'BS17-017').id;
    const m = BS.mkInst('BS17-017'); m.cores = 3; P.spirits = [m]; const t = BS.mkInst(id); t.cores = 2; O.spirits = [t]; const tr = O.trashCores.n;
    await BS.fireFx(P, 'BURST_SET', null, {}); await BS.fireFx(O, 'OPP_BURST_SET', null, {});
    return { cores: t.cores, trash: O.trashCores.n - tr, ok: BS.CARDS['BS17-017'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.cores, 1, JSON.stringify(r)); assert.equal(r.trash, 1, JSON.stringify(r));
});

test('K-1162 BS17-050 puts a core from the Void on a Spirit when the opponent sets a Burst, not when you do', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const m = BS.mkInst('BS17-050'); m.cores = 2; P.spirits = [m]; P.void = 3;
    await BS.fireFx(P, 'BURST_SET', null, {}); const a = m.cores; await BS.fireFx(O, 'BURST_SET', null, {}); await BS.fireFx(P, 'OPP_BURST_SET', null, {});
    return { a, b: m.cores, ok: BS.CARDS['BS17-050'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.a, 2, JSON.stringify(r)); assert.equal(r.b, 3, JSON.stringify(r));
});

test('K-1163 BS15-062 destroys an opposing 3000 BP or less Spirit when you set a Burst in your Main Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const n = BS.mkInst('BS15-062'); n.cores = 2; P.nexus = [n]; const id = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost <= 2 && !c.effects).id;
    const t = BS.mkInst(id); t.cores = 1; O.spirits = [t]; const bp = BS.bpOf(t);
    await BS.fireFx(P, 'BURST_SET', null, {});
    return { bp, left: O.spirits.length, ok: BS.CARDS['BS15-062'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.ok(r.bp <= 3000, JSON.stringify(r)); assert.equal(r.left, 0, JSON.stringify(r));
});

test('K-1164 BS01-059 refreshes when the opponent draws; BS15-001 gains 2000 only while all your cards are Red', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const m = BS.mkInst('BS01-059'); m.cores = 2; m.exhausted = true; P.spirits = [m]; await BS.fireFx(P, 'OPP_DRAWS', null, {}); const ref = !m.exhausted;
    const mk = BS.mkInst('BS15-001'); mk.cores = 2; P.spirits = [mk]; const b0 = BS.bpOf(mk); await BS.fireFx(P, 'ATTACKS', mk, {}); const b1 = BS.bpBonusOf ? 0 : 0;
    return { ref, ok: ['BS01-059', 'BS15-001'].every(i => BS.CARDS[i].fxComplete !== false), b0, bp: BS.bpOf(mk) }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.ref, true, JSON.stringify(r));
});

test('K-1165 BS39-029 refreshes the blocking Machine Beast; SD03-008 puts cores equal to its level on a Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const mb = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Machine Beast') && c.id !== 'BS39-029').id;
    const m = BS.mkInst('BS39-029'); m.cores = 3; const b = BS.mkInst(mb); b.cores = 2; b.exhausted = true; P.spirits = [m, b];
    await BS.fireFx(P, 'ALLY_BLOCKS', b, { blocker: b, attacker: BS.mkInst(mb), subject: b }); const ref = !b.exhausted;
    G.active = P.key; const s = BS.mkInst('SD03-008'); s.cores = 3; const lv = BS.lvNo ? BS.lvNo(s) : 0; const nx = Object.values(BS.CARDS).find(c => c.type === 'Nexus').id; const n = BS.mkInst(nx); n.cores = 0; P.spirits = [s]; P.nexus = [n]; P.void = 5;
    await BS.fireFx(P, 'ATTACKS', s, {}); return { ref, cores: n.cores, lv, ok: BS.CARDS['SD03-008'].fxComplete !== false && BS.CARDS['BS39-029'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.ref, true, JSON.stringify(r)); assert.ok(r.cores >= 1, JSON.stringify(r));
});

test('K-1166 SD24-003 gets a Void core when a Fighting Spirit Ultimate is summoned; BS25-048 buffs battling Fighting Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const ult = Object.values(BS.CARDS).find(c => c.type === 'Ultimate' && (c.families || []).includes('Fighting Spirit')).id;
    const a = BS.mkInst('SD24-003'); a.cores = 2; const u = BS.mkInst(ult); P.spirits = [a, u]; const before = a.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', u, { subject: u }); const after = a.cores;
    const fs = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Fighting Spirit') && c.id !== 'BS25-048').id;
    const p = BS.mkInst('BS25-048'); p.cores = 2; const f = BS.mkInst(fs); f.cores = 2; P.spirits = [p, f]; G.step = 5; G.attacker = null; G.blocker = null;
    const idle = BS.bpOf(f); G.attacker = f; const fight = BS.bpOf(f);
    return { before, after, idle, fight, ok: BS.CARDS['SD24-003'].fxComplete !== false && BS.CARDS['BS25-048'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.after, r.before + 1, JSON.stringify(r)); assert.equal(r.fight, r.idle + 2000, JSON.stringify(r));
});

test('K-1167 BS69-058 gives Roaring Azure Spirits +3000 BP when it heavily exhausts', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 4;
    const ra = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Roaring Azure') && c.id !== 'BS69-058').id;
    const o = BS.mkInst('BS69-058'); o.cores = 3; const f = BS.mkInst(ra); f.cores = 2; P.spirits = [o, f]; const before = BS.bpOf(f);
    await BS.fireFx(P, 'EXHAUSTED_FX', o, { subject: o, side: 'own', heavy: true }); const after = BS.bpOf(f);
    return { before, after, ok: BS.CARDS['BS69-058'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.after, r.before + 3000, JSON.stringify(r));
});

test('K-1168 BS07-038 is complete and carries the Flash invoke that exhausts itself', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const c = BS.CARDS['BS07-038']; const e = (c.fx || c.effects || []).find(x => x.invoke); return { ok: c.fxComplete !== false, ex: !!(e && e.cost && e.cost.exhaustSelf), n: e && e.actions[0].n }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.ex, true, JSON.stringify(r)); assert.equal(r.n, 2000, JSON.stringify(r));
});

test('K-1169 ALSO_TREATED: a level-gated extra colour and symbol (SD20-002, BS25-029, SD02-001)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key; G.step = 4;
    const w = BS.mkInst('SD20-002'); w.cores = 1; P.spirits = [w]; const k = BS.CARDS['SD20-002']; const lv1 = BS.lvNo(w);
    const sym = (BS.symbolsOn(P).white || 0), col = BS.fxMatch(k, { color: ['white'] }, w), colOther = BS.fxMatch(k, { color: ['white'] }, BS.mkInst('SD20-002'));
    const b = BS.mkInst('BS25-029'); b.cores = 1; const kb = BS.CARDS['BS25-029']; P.spirits = [b]; const blue1 = BS.fxMatch(kb, { color: ['blue'] }, b), red1 = BS.fxMatch(kb, { color: ['red'] }, b);
    b.cores = 4; const red2 = BS.fxMatch(kb, { color: ['red'] }, b), lv2 = BS.lvNo(b);
    return { lv1, sym, col, colOther, blue1, red1, red2, lv2, base: kb.colors || [kb.symbol], ok: ['SD20-002', 'BS25-029', 'SD02-001'].every(i => BS.CARDS[i].fxComplete !== false) }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.col, true, JSON.stringify(r)); assert.ok(r.sym >= 1, JSON.stringify(r));
  assert.equal(r.blue1, true, JSON.stringify(r)); assert.equal(r.red1, false, JSON.stringify(r)); assert.equal(r.red2, true, JSON.stringify(r));
});

test('K-1170 BS09-023 puts a Void core on each of two White Spirits when summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key; G.step = 4;
    const wh = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && (c.colors || [c.symbol]).length === 1 && (c.colors || [c.symbol])[0] === 'white' && c.id !== 'BS09-023').slice(0, 2).map(c => c.id);
    const s = BS.mkInst('BS09-023'); s.cores = 2; const a = BS.mkInst(wh[0]); a.cores = 1; const b = BS.mkInst(wh[1]); b.cores = 1; P.spirits = [s, a, b]; P.void = 5;
    await BS.fireFx(P, 'SUMMONED', s, { subject: s }); const tot = [s, a, b].map(x => x.cores);
    return { tot, ok: BS.CARDS['BS09-023'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.tot.reduce((x, y) => x + y, 0), 6, JSON.stringify(r));
});

test('K-1171 SD43-002 destroys a small opposing Spirit and draws; BS09-040 exhausts two Cost 3 or less Spirits when blocking', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const low = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 3 && BS.CARDS[c.id]).slice(0, 2).map(c => c.id);
    const s = BS.mkInst('SD43-002'); s.cores = 2; const t = BS.mkInst(low[0]); t.cores = 1; P.spirits = [s]; O.spirits = [t]; const h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', s, { subject: s }); const gone = !O.spirits.includes(t), drew = P.hand.length - h0;
    G.active = O.key; G.step = 5; const bl = BS.mkInst('BS09-040'); bl.cores = 2; const a = BS.mkInst(low[0]), b = BS.mkInst(low[1]); a.cores = 1; b.cores = 1; P.spirits = [bl]; O.spirits = [a, b];
    await BS.fireFx(P, 'BLOCKS', bl, { subject: bl, blocker: bl }); const ex = [a, b].filter(x => x.exhausted).length;
    return { gone, drew, ex, ok: ['SD43-002', 'BS09-040'].every(i => BS.CARDS[i].fxComplete !== false) }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r)); assert.equal(r.ex, 2, JSON.stringify(r));
});

test('K-1172 ATTACK_SPIRIT (BS01-037): the attack goes at an opposing exhausted Spirit, cannot be blocked and spares the Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const ids = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 2 && !c.effects).slice(0, 2).map(c => c.id);
    const a = BS.mkInst('BS01-037'); a.cores = 6; const t = BS.mkInst(ids[0]); t.cores = 1; t.exhausted = true; const b = BS.mkInst(ids[1]); b.cores = 1;
    P.spirits = [a]; O.spirits = [t, b]; const life = O.life; await BS.doBattle(P.key, a);
    return { life: O.life - life, gone: !O.spirits.includes(t), blockerKept: O.spirits.includes(b) && !b.exhausted, lv: BS.lvNo(a), ok: BS.CARDS['BS01-037'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.life, 0, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.blockerKept, true, JSON.stringify(r));
});

test('K-1173 ATTACK_SPIRIT coresLe/coresGe (BS01-044): only an opposing Spirit with exactly one core can be targeted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const ids = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.cost <= 2 && !c.effects).slice(0, 2).map(c => c.id);
    const a = BS.mkInst('BS01-044'); a.cores = 7; const t1 = BS.mkInst(ids[0]); t1.cores = 3; const t2 = BS.mkInst(ids[1]); t2.cores = 1;
    P.spirits = [a]; O.spirits = [t1, t2]; const life = O.life; await BS.doBattle(P.key, a);
    return { life: O.life - life, t1: O.spirits.includes(t1), t2gone: !O.spirits.includes(t2), ok: BS.CARDS['BS01-044'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.life, 0, JSON.stringify(r)); assert.equal(r.t2gone, true, JSON.stringify(r)); assert.equal(r.t1, true, JSON.stringify(r));
});
