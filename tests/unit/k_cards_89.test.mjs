// Lane K cards, batch 89.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-917 SD01-004: attack gives this Spirit +2000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0;
    const s = BS.mkInst('SD01-004'); s.cores = 1; P.spirits.push(s);
    const b0 = BS.bpOf(s);
    await BS.fireFx(P, 'ATTACKS', s, {});
    return { d: BS.bpOf(s) - b0 };
  });
  assert.equal(r.d, 2000, JSON.stringify(r));
});

test('K-918 SD01-023: at Lv2 all your White Spirits get +1000 BP, not at Lv1', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0;
    const a = BS.mkInst('SD01-023'); a.cores = 1; P.spirits.push(a);
    const b = BS.mkInst('SD01-023'); b.cores = 1; P.spirits.push(b);
    const lv1 = BS.bpOf(b);
    a.cores = 3;
    return { lv1, lv2: BS.bpOf(b) };
  });
  assert.equal(r.lv2 - r.lv1, 1000, JSON.stringify(r));
});

test('K-919 SD03-003 attack +2000; K-920 SD03-007 also counts as Red', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.spirits.length = 0;
    const s = BS.mkInst('SD03-003'); s.cores = 1; P.spirits.push(s);
    const b0 = BS.bpOf(s);
    await BS.fireFx(P, 'ATTACKS', s, {});
    const c = BS.CARDS['SD03-007'];
    return { d: BS.bpOf(s) - b0, colors: c.colors };
  });
  assert.equal(r.d, 2000, JSON.stringify(r));
  assert.deepEqual(r.colors, ['blue', 'red'], JSON.stringify(r));
});

test('K-921 SD26-001 attack +3000 at Lv2; SD23-004 summon -3000 BP on a foe', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true; P.spirits.length = 0; O.spirits.length = 0;
    const s = BS.mkInst('SD26-001'); s.cores = 2; P.spirits.push(s);
    const b0 = BS.bpOf(s);
    await BS.fireFx(P, 'ATTACKS', s, {});
    const f = BS.mkInst('BS01-002'); f.cores = 2; O.spirits.push(f);
    const f0 = BS.bpOf(f);
    const m = BS.mkInst('SD23-004'); m.cores = 1; P.spirits.push(m);
    await BS.fireFx(P, 'SUMMONED', m, {});
    return { a: BS.bpOf(s) - b0, f: f0 - BS.bpOf(f) };
  });
  assert.equal(r.a, 3000, JSON.stringify(r)); assert.equal(r.f, 3000, JSON.stringify(r));
});

test('K-922 SD20-013 Flash +3000 BP; SD23-015 Flash -5000 BP destroys at 0', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    P.spirits.length = 0; O.spirits.length = 0; P.hand.length = 0; P.reserve.n = 8;
    const s = BS.mkInst('BS01-002'); s.cores = 1; P.spirits.push(s);
    const b0 = BS.bpOf(s);
    const m = BS.mkInst('SD20-013'); P.hand.push(m);
    await BS.castMagic(P, { inst: m, target: s, plan: null, ctx: 'flash' });
    const up = BS.bpOf(s) - b0;
    const f = BS.mkInst('BS01-002'); f.cores = 1; O.spirits.push(f);
    const m2 = BS.mkInst('SD23-015'); P.hand.push(m2);
    await BS.castMagic(P, { inst: m2, target: f, plan: null, ctx: 'flash' });
    return { up, foe: O.spirits.length, bp: BS.bpOf(f) };
  });
  assert.equal(r.up, 3000, JSON.stringify(r)); assert.equal(r.foe, 0, JSON.stringify(r));
});

test('K-923 SD attack-draw cards draw one at their Lv; SD17-001/SD06-008 are also Green/Red', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true;
    const out = {};
    for (const id of ['SD06-002', 'SD10-003', 'SD19-003', 'SD42-002', 'SD37-001']) {
      P.spirits.length = 0; const s = BS.mkInst(id); s.cores = 3; P.spirits.push(s);
      const h = P.hand.length; await BS.fireFx(P, 'ATTACKS', s, {}); out[id] = P.hand.length - h;
    }
    P.spirits.length = 0; const lo = BS.mkInst('SD06-002'); lo.cores = 1; P.spirits.push(lo);
    const h = P.hand.length; await BS.fireFx(P, 'ATTACKS', lo, {}); out.lv1 = P.hand.length - h;
    out.c1 = BS.CARDS['SD17-001'].colors; out.c2 = BS.CARDS['SD06-008'].colors;
    return out;
  });
  const j = JSON.stringify(r);
  for (const id of ['SD06-002', 'SD10-003', 'SD19-003', 'SD42-002', 'SD37-001']) assert.equal(r[id], 1, j);
  assert.equal(r.lv1, 0, j);
  assert.ok(r.c1.includes('green') && r.c2.includes('red'), j);
});

test('K-924 SD13-001: when destroyed, destroys an exhausted cost<=3 foe only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; O.cpu = true;
    P.spirits.length = 0; O.spirits.length = 0; P.trash.length = 0;
    const s = BS.mkInst('SD13-001'); s.cores = 0; s.lostLv = 1; P.trash.push(s);
    const a = BS.mkInst('BS01-002'); a.cores = 1; a.exhausted = false; O.spirits.push(a);
    await BS.fireFx(P, 'DESTROYED', s, { subject: s });
    const none = O.spirits.length;
    a.exhausted = true;
    await BS.fireFx(P, 'DESTROYED', s, { subject: s });
    return { none, after: O.spirits.length, cost: BS.CARDS['BS01-002'].cost };
  });
  const j = JSON.stringify(r);
  assert.equal(r.none, 1, j); assert.equal(r.after, 0, j);
});
