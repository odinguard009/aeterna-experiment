// Lane K tests, file 82. Schema v286-: handLeOpp, OPP_START_STEP.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-865 BS02-077 refreshes Awaken Spirits at the Opposing Start Step (one at LV1, all at LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS02-077'); n.cores = 1; P.nexus = [n];
    const mk = () => { const x = BS.mkInst('BS31-008'); x.cores = 1; x.exhausted = true; return x; };
    const kw = BS.cardHasKeyword ? BS.cardHasKeyword(BS.CARDS['BS31-008'], 'Awaken') : null;
    P.spirits = [mk(), mk()]; const out = [kw];
    await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(P.spirits.filter(x => x.exhausted).length);
    n.cores = 4; P.spirits = [mk(), mk()];
    await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(P.spirits.filter(x => x.exhausted).length);
    return out; })()`);
  assert.deepEqual(r.slice(1), [1, 0], JSON.stringify(r));
});

test('K-866 BS01-109 refreshes a High Speed Spirit at the Opposing Start Step and gives a summoned Spirit +1000 BP at LV2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS01-109'); n.cores = 2; P.nexus = [n];
    const h = BS.mkInst('BS01-053'); h.cores = 1; h.exhausted = true; P.spirits = [h]; const out = [];
    await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(h.exhausted);
    const s = BS.mkInst('BS01-001'); s.cores = 1; P.spirits.push(s); const b = BS.bpOf(s);
    await BS.fireFx(P, 'SUMMONED', s, { subject: s }); out.push(BS.bpOf(s) - b);
    n.cores = 0; const s2 = BS.mkInst('BS01-001'); s2.cores = 1; P.spirits.push(s2); const b2 = BS.bpOf(s2);
    await BS.fireFx(P, 'SUMMONED', s2, { subject: s2 }); out.push(BS.bpOf(s2) - b2);
    return out; })()`);
  assert.deepEqual(r, [false, 1000, 0], JSON.stringify(r));
});

test('K-867 BS01-103 empties the opposing Reserve (LV1+) and exhausts an opposing Spirit at LV2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS01-103'); n.cores = 1; P.nexus = [n];
    const s = BS.mkInst('BS01-001'); s.cores = 1; O.spirits = [s]; O.reserve.n = 4; const t0 = O.trashCores.n; const out = [];
    await BS.fireFx(P, 'START_STEP', null, {}); out.push(O.reserve.n, O.trashCores.n - t0, !!s.exhausted);
    n.cores = 3; O.reserve.n = 2; await BS.fireFx(P, 'START_STEP', null, {}); out.push(O.reserve.n, !!s.exhausted);
    return out; })()`);
  assert.deepEqual(r, [0, 4, false, 0, true], JSON.stringify(r));
});

test('K-868 BS01-099 draws +1 at the Draw Step, discarding one card at LV1 only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS01-099'); n.cores = 1; P.nexus = [n]; const out = [];
    P.deck = [1,2,3,4,5].map(() => BS.mkInst('BS01-001')); P.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    let h = P.hand.length, d = P.trash.length; await BS.fireFx(P, 'DRAW_STEP', null, {}); out.push(P.hand.length - h, P.trash.length - d);
    n.cores = 3; h = P.hand.length; d = P.trash.length; await BS.fireFx(P, 'DRAW_STEP', null, {}); out.push(P.hand.length - h, P.trash.length - d);
    return out; })()`);
  assert.deepEqual(r, [0, 1, 1, 0], JSON.stringify(r));
});

test('K-869 BS02-084 returns a Void core when a Yellow Spirit dies in an Attack Step, and draws at LV2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS02-084'); n.cores = 1; P.nexus = [n]; const out = [];
    const y = BS.mkInst('BS02-049'), w = BS.mkInst('BS01-001');
    P.deck = [1,2,3].map(() => BS.mkInst('BS01-001')); P.void = 3; G.step = 5;
    let rs = P.reserve.n, h = P.hand.length; await BS.fireFx(P, 'ALLY_DIED', null, { subject: y }); out.push(P.reserve.n - rs, P.hand.length - h);
    rs = P.reserve.n; await BS.fireFx(P, 'ALLY_DIED', null, { subject: w }); out.push(P.reserve.n - rs);
    n.cores = 3; rs = P.reserve.n; h = P.hand.length; await BS.fireFx(P, 'ALLY_DIED', null, { subject: y }); out.push(P.reserve.n - rs, P.hand.length - h);
    G.step = 3; rs = P.reserve.n; await BS.fireFx(P, 'ALLY_DIED', null, { subject: y }); out.push(P.reserve.n - rs);
    return out; })()`);
  assert.deepEqual(r, [1, 0, 0, 1, 1, 0], JSON.stringify(r));
});

test('K-870 BS02-080 gives Spirits with 3+ cores +1000 BP in the own Attack Step and puts a Void core on the Nexus after a win (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS02-080'); n.cores = 3; P.nexus = [n];
    const a = BS.mkInst('BS01-001'); a.cores = 3; const b = BS.mkInst('BS01-001'); b.cores = 2; P.spirits = [a, b]; const out = [];
    P.nexus = []; const ba = BS.bpOf(a), bb = BS.bpOf(b); P.nexus = [n]; G.active = P.key; G.step = 5;
    out.push(BS.bpOf(a) - ba, BS.bpOf(b) - bb);
    P.void = 2; await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: a, attacking: true }); out.push(n.cores, P.void);
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: b, attacking: true }); out.push(n.cores);
    return out; })()`);
  assert.deepEqual(r, [1000, 0, 4, 1, 4], JSON.stringify(r));
});

test('K-871 BS03-108 refreshes one vanilla exhausted Spirit at LV1 and all of them at LV2 in the opposing Attack start', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS03-108'); n.cores = 1; P.nexus = [n]; const out = [];
    const mk = id => { const x = BS.mkInst(id); x.cores = 1; x.exhausted = true; return x; };
    const v1 = mk('BS01-001'), v2 = mk('BS01-001'), t = mk('BS31-008'); P.spirits = [v1, v2, t];
    await BS.fireFx(P, 'OPP_START_ATTACK', null, {}); out.push(P.spirits.filter(x => !x.exhausted).length);
    n.cores = 3; await BS.fireFx(P, 'OPP_START_ATTACK', null, {}); out.push(P.spirits.filter(x => !x.exhausted).length, t.exhausted);
    return out; })()`);
  assert.deepEqual(r, [1, 2, true], JSON.stringify(r));
});

test('K-872 BS03-104 draws when a vanilla Spirit is destroyed in an Attack Step and exhausts an opposing Spirit when one wins (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS03-104'); n.cores = 1; P.nexus = [n]; const out = [];
    const v = BS.mkInst('BS01-001'), t = BS.mkInst('BS31-008'); P.deck = [1,2,3].map(() => BS.mkInst('BS01-001')); G.step = 5; G.active = P.key;
    let h = P.hand.length; await BS.fireFx(P, 'ALLY_DIED', null, { subject: v }); out.push(P.hand.length - h);
    h = P.hand.length; await BS.fireFx(P, 'ALLY_DIED', null, { subject: t }); out.push(P.hand.length - h);
    const e = BS.mkInst('BS01-001'); e.cores = 1; O.spirits = [e];
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: v, attacking: true }); out.push(!!e.exhausted);
    n.cores = 3; await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: t, attacking: true }); out.push(!!e.exhausted);
    await BS.fireFx(P, 'ALLY_BATTLE_WIN', null, { subject: v, attacking: true }); out.push(!!e.exhausted);
    return out; })()`);
  assert.deepEqual(r, [1, 0, false, false, true], JSON.stringify(r));
});

test('K-873 BS05-058 gives Evil Shadow Spirits +2000 BP in the own Attack Step and exhausts an opposing Spirit in the Start Step while one is controlled (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS05-058'); n.cores = 1; P.nexus = [n]; const out = [];
    const a = BS.mkInst('BS02-018'); a.cores = 2; const b = BS.mkInst('BS01-001'); b.cores = 2; P.spirits = [a, b];
    P.nexus = []; G.active = P.key; G.step = 5; const ba = BS.bpOf(a), bb = BS.bpOf(b); P.nexus = [n];
    out.push(BS.bpOf(a) - ba, BS.bpOf(b) - bb);
    const e = BS.mkInst('BS01-001'); e.cores = 1; O.spirits = [e];
    await BS.fireFx(P, 'START_STEP', null, {}); out.push(!!e.exhausted);
    n.cores = 3; await BS.fireFx(P, 'START_STEP', null, {}); out.push(!!e.exhausted);
    e.exhausted = false; P.spirits = [b]; await BS.fireFx(P, 'START_STEP', null, {}); out.push(!!e.exhausted);
    return out; })()`);
  assert.deepEqual(r, [2000, 0, false, true, false], JSON.stringify(r));
});

test('K-874 BS06-073 draws one extra card then discards one in the Draw Step and gives all Spirits +1000 BP in the own Attack Step (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS06-073'); n.cores = 0; P.nexus = [n]; const out = [];
    P.deck = [1,2,3,4].map(() => BS.mkInst('BS01-001')); P.hand = [BS.mkInst('BS01-001')];
    const h = P.hand.length, t = P.trash.length; await BS.fireFx(P, 'DRAW_STEP', null, {}); out.push(P.hand.length - h, P.trash.length - t);
    const a = BS.mkInst('BS01-001'); a.cores = 2; P.spirits = [a]; G.active = P.key; G.step = 5;
    P.nexus = []; const ba = BS.bpOf(a); P.nexus = [n]; out.push(BS.bpOf(a) - ba); n.cores = 1; out.push(BS.bpOf(a) - ba);
    return out; })()`);
  assert.deepEqual(r, [0, 1, 0, 1000], JSON.stringify(r));
});
