// Lane K tests, file 4 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v189: 26RBS01-X09, 26RBS03-X15, 26RBS02-X02, 26RBS02-X11 (K_STANDARD_INVOKE, saga 50).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-201 26RBS01-X09 LV1-2 (When Summoned): heavy exhaust one opposing Spirit per Spirit with Current you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    await BS.fireFx(P, 'SUMMONED', window.SC.whala);
    return [O.spirits.filter(s => s.heavy).length, O.spirits.length, P.spirits.length];
  }, SPEC('x09-heavy-exhaust-per-current'));
  assert.deepEqual(r, [2, 3, 3], JSON.stringify(r));
});

test('K-202 26RBS01-X09 LV1-2: the per-count is 0 without a Current Spirit, so the optional effect does nothing', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; q.reserve.n = 10; }
    const w = BS.mkInst('26RBS01-X09'); w.cores = 1; P.spirits.push(w);
    for (let i = 0; i < 2; i++) { const s = BS.mkInst('BS48-047'); s.cores = 1; O.spirits.push(s); }
    await BS.fireFx(P, 'SUMMONED', w);
    return [O.spirits.filter(s => s.heavy).length, BS.CARDS['26RBS01-X09'].effects[0].actions[0].per.keyword];
  });
  assert.deepEqual(r, [0, 'Current'], JSON.stringify(r));
});

test('K-203 26RBS01-X09 LV2 (During Attack) Invoke: refresh a Current Spirit, then it can not attack this turn; once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; q.reserve.n = 10; }
    G.step = 5; G.active = P.key; G.battleNo = 1;
    const x = BS.mkInst('26RBS01-X09'); x.cores = 3; P.spirits.push(x);      // LV2
    const cur = BS.mkInst('26RBS01-035'); cur.cores = 1; cur.exhausted = true; P.spirits.push(cur);
    G.attacker = x;
    const avail = () => BS.activatable(P, x, 'FLASH').map(v => v.idx);
    const before = avail();
    await BS.activateFx(P, x, 1);
    return [before, !cur.exhausted, cur.noAtkTurn === G.turnNo, avail(), x.fxUsed[1] === G.turnNo];
  });
  assert.deepEqual(r, [[1], true, true, [], true], JSON.stringify(r));
});

test('K-204 26RBS03-X15 LV1-2 (Either Attack Step): a destroyed Nexus refreshes this Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.alterhibius, n = window.SC.cyantreeNexus;
    x.exhausted = true;
    BS.removeNexus(P, n, 'destroyed'); await BS.flushBursts();
    const byNexus = !x.exhausted;
    x.exhausted = true;
    const n2 = BS.mkInst('26RBS01-106'); n2.cores = 1; n2.exhausted = false;
    P.spirits.push(n2); n2.asSpirit = true;      // a Spirit that is originally a Nexus
    BS.removeSpirit(P, n2, 'destroyed', false); await BS.flushBursts();
    return [byNexus, !x.exhausted, P.trash.includes(n), P.trash.includes(n2)];
  }, SPEC('x15-nexus-destroyed-refresh'));
  assert.deepEqual(r, [true, true, true, true], JSON.stringify(r));
});

test('K-205 26RBS03-X15 LV1-2: the trigger window is the Attack Step only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.alterhibius; x.exhausted = true;
    G.step = 4;
    BS.removeNexus(P, window.SC.cyantreeNexus, 'destroyed'); await BS.flushBursts();
    return [!x.exhausted, BS.CARDS['26RBS03-X15'].effects[0].if.attackStep];
  }, SPEC('x15-nexus-destroyed-refresh'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-206 26RBS03-X15 LV2 Invoke: a Cyantree Nexus with a core becomes a Spirit (LV1 5000 / LV2 7000) and its Nexus effects are off', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.alterhibius; x.cores = 3;      // LV2
    const n = window.SC.cyantreeNexus;                 // 1 core
    G.attacker = null;
    const avail = () => BS.activatable(P, x, 'FLASH').map(v => v.idx);
    const before = avail();
    await BS.activateFx(P, x, 1);
    const b1 = [P.spirits.includes(n), !!n.asSpirit, BS.bpOf(n), BS.lvNo(n), BS.activatable(P, n, 'MAIN').length];
    n.cores = 2; const b2 = [BS.bpOf(n), BS.lvNo(n)];
    n.cores = 0; const afterNoCore = avail();          // match.coresGe 1
    return [before, b1, b2, afterNoCore];
  }, SPEC('x15-nexus-destroyed-refresh'));
  assert.deepEqual(r, [[1], [true, true, 5000, 1, 0], [7000, 2], []], JSON.stringify(r));
});

test('K-207 26RBS02-X02 LV1-2 (When Summoned): +3000 BP this turn for every Red Cloud Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.flendis, big = window.SC.bigSpirit;
    const rcId = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.id !== '26RBS02-X02' && (c.families || []).includes('Red Cloud')).id;
    const ally = BS.mkInst(rcId); ally.cores = 1; P.spirits.push(ally);
    const b = [BS.bpOf(x), BS.bpOf(ally), BS.bpOf(big)];
    await BS.fireFx(P, 'SUMMONED', x);
    return [BS.bpOf(x) - b[0], BS.bpOf(ally) - b[1], BS.bpOf(big) - b[2]];
  }, SPEC('x02-opp-life-not-reduced-two-red-symbols'));
  assert.deepEqual(r, [3000, 3000, 0], JSON.stringify(r));
});

test('K-208 26RBS02-X02 LV2 Invoke: available only while the opposing Life was NOT reduced this turn (pay two costs)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.flendis;
    G.attacker = window.SC.bigSpirit;
    const avail = () => BS.activatable(P, x, 'FLASH').map(v => v.idx);
    const notReduced = avail();
    O.lifeRedTurn = G.turnNo;
    const reduced = avail();
    O.lifeRedTurn = G.turnNo - 1;
    return [notReduced, reduced, BS.CARDS['26RBS02-X02'].effects[1].cost.pay];
  }, SPEC('x02-opp-life-not-reduced-two-red-symbols'));
  assert.deepEqual(r, [[1], [], 2], JSON.stringify(r));
});

test('K-209 26RBS02-X02 LV2 Invoke: two Red symbols this battle and "the number of symbols can not increase except via this effect"', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.flendis, big = window.SC.bigSpirit;
    G.attacker = big; G.battleNo = 4;
    const s0 = BS.attackSymbols(big), r0 = P.reserve.n, t0 = P.trashCores.n;
    await BS.activateFx(P, x, 1);
    const s1 = BS.attackSymbols(big);
    big.symBattle = (big.symBattle || 0) + 2;                 // a later battle symbol boost
    big.symTurn = { turn: G.turnNo, cols: ['red'] };          // a later turn symbol boost
    const s2 = BS.attackSymbols(big);
    return [s0, s1, s2, r0 - P.reserve.n, P.trashCores.n - t0, big.symLockBattle === G.battleNo, big.symLockN];
  }, SPEC('x02-opp-life-not-reduced-two-red-symbols'));
  assert.deepEqual(r, [1, 3, 3, 2, 2, true, 2], JSON.stringify(r));
});

test('K-210 26RBS02-X02 LV2 Invoke: a 10000 BP or more target filter (a smaller Spirit is not a candidate)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.flendis, big = window.SC.bigSpirit;
    G.attacker = big; G.battleNo = 5;
    const small = BS.mkInst('BS48-047'); small.cores = 1; P.spirits.push(small);
    const act = BS.CARDS['26RBS02-X02'].effects[1].actions[0];
    const cands = BS.FX_ACTIONS.SYMBOL_TARGET.can({ p: P, opp: G.p.opponent, src: x, ctx: {} }, act);
    const before = BS.attackSymbols(small);
    await BS.activateFx(P, x, 1);
    return [cands, BS.attackSymbols(small) - before, BS.attackSymbols(big)];
  }, SPEC('x02-opp-life-not-reduced-two-red-symbols'));
  assert.deepEqual(r, [true, 0, 3], JSON.stringify(r));
});

test('K-211 26RBS02-X11 LV1-2 (Your Attack Step): a Leucomyst Spirit activating Amplify gives every own Spirit the inferior-blocker mark this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.tyranno, amp = window.SC.leucomystAmplify;
    G.battleNo = 7; G.attacker = x;
    const before = P.spirits.filter(s => s.noBlockInferiorBattle === G.battleNo).length;
    await BS.fireFx(P, 'AMPLIFY', amp, { subject: amp });
    const marked = P.spirits.filter(s => s.noBlockInferiorBattle === G.battleNo).length;
    const weak = window.SC.weakBlocker, strong = window.SC.bigBlocker;   // 2000 vs 11000; Tyranno is 6000
    return [before, marked, P.spirits.length, BS.blockedByMark(x, weak), BS.blockedByMark(x, strong)];
  }, SPEC('x11-amplify-no-block-inferior'));
  assert.deepEqual(r, [0, 3, 3, true, false], JSON.stringify(r));
});

test('K-212 26RBS02-X11 LV1-2: only a Leucomyst Amplify in your Attack Step triggers the mark', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.battleNo = 8; G.attacker = window.SC.tyranno;
    const other = BS.mkInst('26RBS01-X09'); other.cores = 1; P.spirits.push(other);
    await BS.fireFx(P, 'AMPLIFY', other, { subject: other });      // not a Leucomyst Spirit
    const byOther = P.spirits.filter(s => s.noBlockInferiorBattle === G.battleNo).length;
    G.step = 4;                                                     // not the Attack Step
    await BS.fireFx(P, 'AMPLIFY', window.SC.leucomystAmplify, { subject: window.SC.leucomystAmplify });
    return [byOther, P.spirits.filter(s => s.noBlockInferiorBattle === G.battleNo).length];
  }, SPEC('x11-amplify-no-block-inferior'));
  assert.deepEqual(r, [0, 0], JSON.stringify(r));
});

test('K-213 26RBS02-X11 LV2 Amplify Invoke: pay one cost, +1000 per Leucomyst Spirit this battle, once per battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.tyranno; x.cores = 3;                       // LV2
    G.battleNo = 9; G.attacker = x; G.step = 5; G.active = P.key;
    const avail = () => BS.activatable(P, x, 'FLASH').map(v => v.idx);
    const before = avail(); const bp0 = BS.bpOf(x), r0 = P.reserve.n;
    await BS.activateFx(P, x, 1);
    const gain = BS.bpOf(x) - bp0;
    return [before, gain, r0 - P.reserve.n, avail()];
  }, SPEC('x11-amplify-no-block-inferior'));
  assert.deepEqual(r, [[1], 3000, 1, []], JSON.stringify(r));
});
