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

test('K-875 BS06-084 and BS01-113 send the own Trash cores to the Reserve at the opposing step start; BS06-084 LV2 bounces an opposing Spirit; BS01-113 LV2 returns a Void core when a Spirit dies', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = []; const n = BS.mkInst('BS06-084'); n.cores = 0; P.nexus = [n];
    P.trashCores.n = 4; let rs = P.reserve.n; await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(P.trashCores.n, P.reserve.n - rs);
    const e = BS.mkInst('BS01-001'); e.cores = 1; O.spirits = [e]; const oh = O.hand.length;
    await BS.fireFx(P, 'START_STEP', null, {}); out.push(O.spirits.length); n.cores = 3; await BS.fireFx(P, 'START_STEP', null, {}); out.push(O.spirits.length, O.hand.length - oh);
    const m = BS.mkInst('BS01-113'); m.cores = 0; P.nexus = [m]; P.trashCores.n = 3; rs = P.reserve.n;
    await BS.fireFx(P, 'OPP_START_ATTACK', null, {}); out.push(P.trashCores.n, P.reserve.n - rs);
    const y = BS.mkInst('BS01-001'); P.void = 2; G.active = O.key; G.step = 5; rs = P.reserve.n;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: y }); out.push(P.reserve.n - rs); m.cores = 4; await BS.fireFx(P, 'ALLY_DIED', null, { subject: y }); out.push(P.reserve.n - rs);
    return out; })()`);
  assert.deepEqual(r, [0, 4, 1, 0, 1, 0, 3, 0, 1], JSON.stringify(r));
});

test('K-876 BS08-060 puts a Void core on a Shell Insect when a 6000 BP or less Spirit attacks and refreshes them at the End Step (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS08-060'); n.cores = 0; P.nexus = [n]; const out = [];
    const s = BS.mkInst('BS01-050'); s.cores = 1; s.exhausted = true; P.spirits = [s];
    const lo = BS.mkInst('BS01-001'); lo.cores = 1; O.spirits = [lo]; P.void = 3; G.active = O.key; G.step = 5;
    await BS.fireFx(P, 'OPP_ATTACKS', null, { subject: lo, attacker: lo }); out.push(s.cores, P.void);
    await BS.fireFx(P, 'END_STEP', null, {}); out.push(!!s.exhausted);
    n.cores = 1; await BS.fireFx(P, 'END_STEP', null, {}); out.push(!!s.exhausted);
    return out; })()`);
  assert.deepEqual(r, [2, 2, true, false], JSON.stringify(r));
});

test('K-877 BS09-061 puts a Void core on a blocking Giant Beast and refreshes the family at the End Step (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS09-061'); n.cores = 0; P.nexus = [n]; const out = [];
    const g = BS.mkInst('BS01-024'); g.cores = 1; g.exhausted = true; const w = BS.mkInst('BS01-001'); w.cores = 1; P.spirits = [g, w]; P.void = 3; G.active = O.key; G.step = 5;
    await BS.fireFx(P, 'ALLY_BLOCKS', g, { subject: g, blocker: g }); out.push(g.cores, P.void);
    await BS.fireFx(P, 'ALLY_BLOCKS', w, { subject: w, blocker: w }); out.push(w.cores);
    await BS.fireFx(P, 'END_STEP', null, {}); out.push(!!g.exhausted); n.cores = 2; await BS.fireFx(P, 'END_STEP', null, {}); out.push(!!g.exhausted);
    return out; })()`);
  assert.deepEqual(r, [2, 2, 1, true, false], JSON.stringify(r));
});

test('K-878 BS10-088 puts a Void core on a blocking vanilla Spirit and refreshes the vanilla Spirits when an opposing Spirit attacks (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS10-088'); n.cores = 0; P.nexus = [n]; const out = [];
    const v = BS.mkInst('BS01-001'); v.cores = 1; v.exhausted = true; const t = BS.mkInst('BS31-008'); t.cores = 1; t.exhausted = true; P.spirits = [v, t]; P.void = 3; G.active = O.key; G.step = 5;
    await BS.fireFx(P, 'ALLY_BLOCKS', v, { subject: v, blocker: v }); out.push(v.cores);
    await BS.fireFx(P, 'ALLY_BLOCKS', t, { subject: t, blocker: t }); out.push(t.cores);
    const a = BS.mkInst('BS01-001'); a.cores = 1; O.spirits = [a];
    await BS.fireFx(P, 'OPP_ATTACKS', null, { subject: a, attacker: a }); out.push(!!v.exhausted);
    n.cores = 2; await BS.fireFx(P, 'OPP_ATTACKS', null, { subject: a, attacker: a }); out.push(!!v.exhausted, !!t.exhausted);
    return out; })()`);
  assert.deepEqual(r, [2, 1, true, false, true], JSON.stringify(r));
});

test('K-879 BS13-066 returns a Void core when an opposing effect or battle destroys a Spirit and on a Life hit with a refresh (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS13-066'); n.cores = 0; P.nexus = [n]; const out = [];
    const y = BS.mkInst('BS01-001'); P.void = 5; let rs = P.reserve.n;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: y, byOpp: true }); out.push(P.reserve.n - rs);
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: y }); out.push(P.reserve.n - rs);
    const s = BS.mkInst('BS01-001'); s.cores = 1; s.exhausted = true; P.spirits = [s]; G.active = O.key; G.step = 5; rs = P.reserve.n;
    await BS.fireFx(P, 'OWN_LIFE_HIT', null, {}); out.push(P.reserve.n - rs, !!s.exhausted);
    n.cores = 2; await BS.fireFx(P, 'OWN_LIFE_HIT', null, {}); out.push(P.reserve.n - rs, !!s.exhausted);
    return out; })()`);
  assert.deepEqual(r, [1, 1, 0, true, 1, false], JSON.stringify(r));
});

test('K-880 BS18-061 destroys an opposing 5000 BP or less Spirit when a Red Spirit is destroyed by the opponent (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS18-061'); n.cores = 0; P.nexus = [n]; const out = [];
    const y = BS.mkInst('BS01-001'); const e = BS.mkInst('BS01-001'); e.cores = 1; O.spirits = [e];
    n.cores = 2; await BS.fireFx(P, 'ALLY_DIED', null, { subject: y }); out.push(O.spirits.length);
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: y, byOpp: true }); out.push(O.spirits.length);
    return [out, O.trash.length, P.nexus[0].cores, BS.CARDS["BS18-061"].effects.length]; })()`);
  assert.deepEqual(r, [[1, 0], 1, 2, 2], JSON.stringify(r));
});

test('K-881 BS14-080 gives Green Spirits +1000 BP per opposing Spirit in your Attack Step and refreshes them at your End Step (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS14-080'); n.cores = 0; P.nexus = [n]; const out = [];
    const g = BS.mkInst('BS01-050'); g.cores = 1; g.exhausted = true; const r = BS.mkInst('BS01-001'); r.cores = 1; r.exhausted = true; P.spirits = [g, r];
    const e1 = BS.mkInst('BS01-001'), e2 = BS.mkInst('BS01-001'); O.spirits = [e1, e2];
    G.active = P.key; G.step = 5; 
    G.step = 5; out.push(BS.bpOf(g) - BS.bpOf(r));
    G.step = 3; out.push(BS.bpOf(g) - BS.bpOf(r));
    n.cores = 2; await BS.fireFx(P, 'END_STEP', null, {}); out.push(!!g.exhausted, !!r.exhausted);
    return out; })()`);
  assert.deepEqual(r, [2000, 0, false, true], JSON.stringify(r));
});

test('K-882 BS15-065 gives Windstorm Spirit cards an extra Green reduction symbol and exhausts an opposing Spirit at your Start Step while the opponent has a Burst set (LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS15-065'); n.cores = 0; P.nexus = [n]; const out = [];
    out.push(BS.extraReduction(P, BS.CARDS['BS14-032']).length, BS.extraReduction(P, BS.CARDS['BS01-003']).length);
    const e = BS.mkInst('BS01-001'); e.cores = 1; O.spirits = [e]; G.active = P.key;
    await BS.fireFx(P, 'START_STEP', null, {}); out.push(!!e.exhausted);
    n.cores = 1; await BS.fireFx(P, 'START_STEP', null, {}); out.push(!!e.exhausted);
    O.burst = BS.mkInst('BS01-001'); await BS.fireFx(P, 'START_STEP', null, {}); out.push(!!e.exhausted);
    return out; })()`);
  assert.deepEqual(r, [1, 0, false, false, true], JSON.stringify(r));
});
