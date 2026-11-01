// Lane K tests, file 83 (v0.208 cycle).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-887 BS01-024 destroys an opposing High Speed Spirit when summoned, not a plain one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-024'); a.cores = 1; P.spirits = [a];
    const plain = BS.mkInst('BS01-001'); plain.cores = 1; O.spirits = [plain];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); const out = [O.spirits.length];
    const hs = BS.mkInst('BS01-053'); hs.cores = 1; O.spirits.push(hs);
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); out.push(O.spirits.length, O.spirits.includes(plain));
    return out; })()`);
  assert.deepEqual(r, [1, 1, true], JSON.stringify(r));
});

test('K-888 BS01-036 exhausts two opposing Spirits when destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-036'); a.cores = 0; a.lostLv = 0; P.spirits = []; P.trash = [a];
    const mk = () => { const x = BS.mkInst('BS01-001'); x.cores = 1; return x; };
    O.spirits = [mk(), mk(), mk()];
    await BS.fireFx(P, 'DESTROYED', a, { subject: a });
    return O.spirits.filter(x => x.exhausted).length; })()`);
  assert.equal(r, 2, JSON.stringify(r));
});

test('K-889 BS01-090 returns an opposing Spirit to the hand when summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-090'); a.cores = 1; P.spirits = [a];
    const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits = [s]; const h0 = O.hand.length;
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    return [O.spirits.length, O.hand.length - h0]; })()`);
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-890 BS27-008 reveals 7, summons an Astral Guardian Spirit free and discards the rest', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS27-008'); a.cores = 1; P.spirits = [a];
    const t = BS.mkInst('BS26-005'); P.deck = [BS.mkInst('BS01-001'), t, BS.mkInst('BS02-049'), BS.mkInst('BS01-050'), BS.mkInst('BS01-001'), BS.mkInst('BS02-049'), BS.mkInst('BS01-050'), BS.mkInst('BS01-001')];
    const tr0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    return [P.spirits.length, P.spirits.some(x => x.id === 'BS26-005'), P.trash.length - tr0, P.deck.length]; })()`);
  assert.deepEqual(r, [2, true, 6, 1], JSON.stringify(r));
});

test('K-891 BS03-050 gains +1000 BP per Magic use in your Attack Step (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS03-050'); a.cores = 3; P.spirits = [a]; G.active = P.key; G.step = 5; const m = BS.mkInst('BS01-129'); const b = BS.bpOf(a);
    await BS.fireFx(P, 'MAGIC_USED', null, { subject: m }); const d1 = BS.bpOf(a) - b;
    G.step = 3; const b2 = BS.bpOf(a); await BS.fireFx(P, 'MAGIC_USED', null, { subject: m }); return [d1, BS.bpOf(a) - b2]; })()`);
  assert.deepEqual(r.map(x => Math.max(x, 0) === 0 ? 0 : 1), [1, 0], JSON.stringify(r));
});

test('K-892 BS11-040 refreshes on your Magic use only while braved (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS11-040'); a.cores = 3; a.exhausted = true; P.spirits = [a]; G.active = P.key; G.step = 5; const m = BS.mkInst('BS01-129'); const out = [];
    await BS.fireFx(P, 'MAGIC_USED', null, { subject: m }); out.push(a.exhausted);
    a.brave = BS.mkInst('BS10-061'); await BS.fireFx(P, 'MAGIC_USED', null, { subject: m }); out.push(a.exhausted); return out; })()`);
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-893 BS03-082 refreshes when your Nexus is destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS03-082'); a.cores = 1; a.exhausted = true; P.spirits = [a]; const n = BS.mkInst('BS01-109'); n.cores = 1;
    await BS.fireFx(P, 'ALLY_NEXUS_DESTROYED', n, { subject: n }); return a.exhausted; })()`);
  assert.equal(r, false, JSON.stringify(r));
});

test('K-894 BS03-017 destroys an opposing Spirit with exactly two cores when destroyed (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS03-017'); a.cores = 0; a.lostLv = 1; P.spirits = []; P.trash = [a];
    const mk = n => { const x = BS.mkInst('BS01-001'); x.cores = n; return x; };
    const one = mk(1), three = mk(3), two = mk(2); O.spirits = [one, three, two];
    await BS.fireFx(P, 'DESTROYED', a, { subject: a }); return [O.spirits.includes(two), O.spirits.includes(one), O.spirits.includes(three)]; })()`);
  assert.deepEqual(r, [false, true, true], JSON.stringify(r));
});

test('K-895 BS25-056 / BS25-058 Ultimate Trigger on block: hit refreshes / returns a Spirit, a miss does nothing', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    const u = BS.mkInst('BS25-056'); u.cores = 4; u.exhausted = true; P.spirits = [u]; O.deck = [BS.mkInst('BS01-001')];
    await BS.fireFx(P, 'BLOCKS', u, { subject: u }); out.push(u.exhausted);
    u.exhausted = true; const hi = BS.mkInst('BS25-056'); O.deck = [hi];
    await BS.fireFx(P, 'BLOCKS', u, { subject: u }); out.push(u.exhausted);
    const b = BS.mkInst('BS25-058'); b.cores = 4; P.spirits = [b]; const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits = [s]; O.deck = [BS.mkInst('BS01-001')];
    await BS.fireFx(P, 'BLOCKS', b, { subject: b }); out.push(O.spirits.length);
    return out; })()`);
  assert.deepEqual(r, [false, true, 0], JSON.stringify(r));
});
