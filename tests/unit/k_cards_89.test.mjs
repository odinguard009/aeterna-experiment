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
