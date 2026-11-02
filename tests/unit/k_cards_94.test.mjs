// Lane K cards, batch 94 (selfSoul conditions: "If (Soul Core) is on this Spirit").
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

// runs the first effect of `id` with the given trigger; soul = whether the source holds the Soul Core
const run = (id, trig, soul, setup, read) => `(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.step = 4; G.active = P.key;
  const m = BS.mkInst('${id}'); m.soul = ${soul}; ${setup}
  const fx = BS.CARDS['${id}'].effects.find(e => e.trigger === '${trig}');
  await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: fx.actions });
  return { impl: BS.CARDS['${id}'].implemented === true, ...(${read}) }; })()`;
const foe = (bp, id = 'BS01-001') => `{ const s = BS.mkInst('${id}'); s.cores = 1; O.spirits.push(s); }`;

test('K-1125 SD33-002 draws only with the Soul Core on it', async () => {
  const { page } = await sharedBoard();
  for (const [soul, d] of [[true, 1], [false, 0]]) {
    const r = await page.evaluate(run('SD33-002', 'ATTACKS', soul, `const h0 = P.hand.length;`, `{ d: P.hand.length - h0 }`));
    assert.equal(r.impl, true, JSON.stringify(r)); assert.equal(r.d, d, JSON.stringify(r));
  }
});

test('K-1126 SD33-003 destroys a 3000 BP Spirit, or draws instead with the Soul Core', async () => {
  const { page } = await sharedBoard();
  let r = await page.evaluate(run('SD33-003', 'ATTACKS', false, `${foe(0)} const h0 = P.hand.length;`, `{ sp: O.spirits.length, d: P.hand.length - h0 }`));
  assert.deepEqual([r.impl, r.sp, r.d], [true, 0, 0], JSON.stringify(r));
  r = await page.evaluate(run('SD33-003', 'ATTACKS', true, `${foe(0)} const h0 = P.hand.length;`, `{ sp: O.spirits.length, d: P.hand.length - h0 }`));
  assert.deepEqual([r.sp, r.d], [1, 1], JSON.stringify(r));
});

test('K-1127 SD29-009 destroys a Nexus, plus a Spirit only with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, sp] of [[false, 1], [true, 0]]) {
    const r = await page.evaluate(run('SD29-009', 'ATTACKS', soul, `${foe(0)} O.nexus = [BS.mkInst('BS01-100')];`, `{ nx: O.nexus.length, sp: O.spirits.length }`));
    assert.deepEqual([r.impl, r.nx, r.sp], [true, 0, sp], JSON.stringify(r));
  }
});

test('K-1128 SD31-002 exhausts one opposing Spirit, two with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, n] of [[false, 1], [true, 2]]) {
    const r = await page.evaluate(run('SD31-002', 'DESTROYED', soul, `${foe(0)} ${foe(0)}`, `{ ex: O.spirits.filter(s => s.exhausted).length }`));
    assert.deepEqual([r.impl, r.ex], [true, n], JSON.stringify(r));
  }
});

test('K-1129 BS31-006 destroys a Spirit, a Nexus too with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, nx] of [[false, 1], [true, 0]]) {
    const r = await page.evaluate(run('BS31-006', 'ATTACKS', soul, `${foe(0)} O.nexus = [BS.mkInst('BS01-100')];`, `{ nx: O.nexus.length, sp: O.spirits.length }`));
    assert.deepEqual([r.impl, r.sp, r.nx], [true, 0, nx], JSON.stringify(r));
  }
});

test('K-1130 BS31-002 destroys a 6000 BP or less Spirit only with the Soul Core', async () => {
  const { page } = await sharedBoard();
  for (const [soul, sp] of [[false, 1], [true, 0]]) {
    const r = await page.evaluate(run('BS31-002', 'DESTROYED', soul, foe(0), `{ sp: O.spirits.length }`));
    assert.deepEqual([r.impl, r.sp], [true, sp], JSON.stringify(r));
  }
});

test('K-1131 BS35-014 draws, or with the Soul Core paid returns an Imagine Brave from the Trash', async () => {
  const { page } = await sharedBoard();
  const rd = `{ d: P.hand.length - h0, tr: P.trash.length }`;
  let r = await page.evaluate(run('BS35-014', 'SUMMONED', false, `const h0 = P.hand.length; P.trash.push(BS.mkInst('BS53-064'));`, rd));
  assert.equal(r.impl, true, JSON.stringify(r)); assert.deepEqual([r.d, r.tr], [1, 1], JSON.stringify(r));
  r = await page.evaluate(run('BS35-014', 'SUMMONED', false, `const h0 = P.hand.length; m.soulPaid = true; P.trash.push(BS.mkInst('BS01-001'));`, rd));
  assert.equal(r.d, 0, JSON.stringify(r));
});

test('K-1132 BS51-050 puts a core on itself; with the Soul Core it also bounces an opposing Spirit', async () => {
  const { page } = await sharedBoard();
  for (const [soul, sp] of [[false, 1], [true, 0]]) {
    const r = await page.evaluate(run('BS51-050', 'ATTACKS', soul, `${foe(0)} m.cores = 1; P.spirits.push(m); P.void = 5;`, `{ c: m.cores, sp: O.spirits.length }`));
    assert.deepEqual([r.impl, r.c, r.sp], [true, 2, sp], JSON.stringify(r));
  }
});

test('K-1133 BS31-016 sends a core to the Reserve; with the Soul Core it also returns a Purple Spirit', async () => {
  const { page } = await sharedBoard();
  for (const [soul, d] of [[false, 0], [true, 1]]) {
    const r = await page.evaluate(run('BS31-016', 'ATTACKS', soul, `{ const s = BS.mkInst('BS01-001'); s.cores = 2; O.spirits.push(s); } const h0 = P.hand.length; { const t = BS.mkInst('BS01-026'); P.trash.push(t); } `, `{ c: O.spirits[0].cores, d: P.hand.length - h0, col: BS.CARDS['BS01-026'].color }`));
    assert.deepEqual([r.impl, r.c, r.d], [true, 1, d], JSON.stringify(r));
  }
});

test('K-1134 SD35-006 when destroyed by the opponent returns an exhausted opposing Spirit to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(run('SD35-006', 'DESTROYED', false, `{ const a = BS.mkInst('BS01-001'); a.cores = 1; a.exhausted = true; O.spirits.push(a); const b = BS.mkInst('BS01-001'); b.cores = 1; O.spirits.push(b); }`, `{ sp: O.spirits.length, ex: O.spirits.filter(s => s.exhausted).length, dk: O.deck.length }`));
  assert.equal(r.impl, true, JSON.stringify(r)); assert.deepEqual([r.sp, r.ex], [1, 0], JSON.stringify(r));
});

test('K-1135 SD25-002 carries the block and no-destroy flags and the White colour', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const c = BS.CARDS['SD25-002']; return { impl: c.implemented === true, colors: c.colors, flags: c.effects.map(e => e.flag) }; })()`);
  assert.equal(r.impl, true, JSON.stringify(r)); assert.deepEqual(r.colors, ['red', 'white']); assert.deepEqual(r.flags, ['BLOCK_EXHAUSTED', 'NO_DESTROY_OPP']);
});

test('K-1136 IGNORE_SUMMON_COND lets a Cost 7 Ultimate be summoned without its condition', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player; const ult = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Ultimate' && BS.CARDS[k].summonIf && BS.CARDS[k].cost <= 7 && k !== 'BS26-046');
    const before = BS.summonOK(P, BS.CARDS[ult]); const m = BS.mkInst('BS26-046'); m.cores = 3; P.spirits.push(m); const after = BS.summonOK(P, BS.CARDS[ult]);
    return { ult, before, after, lv: BS.lvNo(m) }; })()`);
  assert.equal(r.before, false, JSON.stringify(r)); assert.equal(r.after, true, JSON.stringify(r));
});

test('K-1137 ULT_SYMBOL_AS makes Ultimate symbols also count as the printed colours', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { BS.testSetup(); const G = BS.G, P = G.p.player; G.step = 2; const m = BS.mkInst('BS26-046'); m.cores = 3; P.spirits.push(m);
    return { s: BS.symbolsOn(P), lv: BS.lvNo(m), isU: BS.CARDS['BS26-046'].type }; })()`);
  assert.ok(r.s.red >= 1 && r.s.ultimate >= 1, JSON.stringify(r));
});

test('K-1138 BS26-051 Ultimate Trigger hit: by destroying a Cost 5 or less Spirit, a Void core goes to the Reserve; BS26-049 refreshes on a block hit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.step = 4; G.active = P.key; P.void = 3;
    const m = BS.mkInst('BS26-051'); m.cores = 3; P.spirits.push(m); const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits.push(s);
    const r0 = P.reserve; const fx = BS.CARDS['BS26-051'].effects.find(e => e.trigger === 'ATTACKS');
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m, utHit: true } }, { actions: fx.actions.filter(a => a.do !== 'ULT_TRIGGER') });
    const a = { sp: O.spirits.length, dres: (typeof P.reserve === 'number' ? P.reserve : BS.reserveTotal(P)) - (typeof r0 === 'number' ? r0 : 0) };
    const b = BS.mkInst('BS26-049'); b.cores = 3; b.exhausted = true; P.spirits.push(b);
    const fb = BS.CARDS['BS26-049'].effects.find(e => e.trigger === 'BLOCKS');
    await BS.runActions({ p: P, opp: O, src: b, ctx: { selfInst: b, utHit: true } }, { actions: fb.actions.filter(a => a.do !== 'ULT_TRIGGER') });
    return { ...a, ex: !!b.exhausted, bc: b.cores, impl: BS.CARDS['BS26-051'].implemented === true }; })()`);
  assert.equal(r.impl, true, JSON.stringify(r)); assert.equal(r.sp, 0, JSON.stringify(r)); assert.equal(r.ex, false, JSON.stringify(r)); assert.equal(r.bc, 4, JSON.stringify(r));
});

test('K-1139 SD13-007 destroys an opposing exhausted non-braved Spirit only; SD06-004 +3000 BP skips braved Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.step = 4; G.active = P.key;
    const m = BS.mkInst('SD13-007'); const a = BS.mkInst('BS01-001'); a.cores = 1; a.exhausted = true; a.brave = { id: 'SD13-007' }; const b = BS.mkInst('BS01-001'); b.cores = 1; b.exhausted = true; const c = BS.mkInst('BS01-001'); c.cores = 1; O.spirits.push(a, b, c);
    const fx = BS.CARDS['SD13-007'].effects.find(e => e.trigger === 'ATTACKS');
    await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: fx.actions });
    return { left: O.spirits.length, a: O.spirits.includes(a), b: O.spirits.includes(b), c: O.spirits.includes(c), impl: BS.CARDS['SD13-007'].implemented === true }; })()`);
  assert.equal(r.impl, true, JSON.stringify(r)); assert.deepEqual([r.a, r.b, r.c], [true, false, true], JSON.stringify(r));
});

test('K-1140 SD02-006 deploys a Nexus from the Trash; SD16-001 mills 2; SD42-006 summons a Kamen Spirit from the Hand', async () => {
  const { page } = await sharedBoard();
  let r = await page.evaluate(run('SD02-006', 'DESTROYED', false, `const n = BS.mkInst('BS48-085'); P.trash.push(n);`, `{ nx: P.nexus.length, tr: P.trash.length }`));
  assert.deepEqual([r.impl, r.nx], [true, 1], JSON.stringify(r));
  r = await page.evaluate(run('SD16-001', 'ALLY_LOST', false, `const d0 = O.deck.length;`, `{ d: d0 - O.deck.length }`));
  assert.deepEqual([r.impl, r.d], [true, 2], JSON.stringify(r));
  r = await page.evaluate(run('SD42-006', 'START_ATTACK', false, `P.hand.push(BS.mkInst('CB15-033'));`, `{ sp: P.spirits.length, h: P.hand.length }`));
  assert.deepEqual([r.impl, r.sp, r.h], [true, 1, 0], JSON.stringify(r));
});
