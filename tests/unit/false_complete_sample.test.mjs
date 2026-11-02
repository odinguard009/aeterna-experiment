// v0.80.0 A2 card-author pilot, false-complete check (docs/ai/roadmap-open.md item A step 6): one scenario per sampled
// newly complete card, written by main from the PRINTED card text (not from the agent's JSON). A failure sends the card
// back to partial and is recorded in docs/audits/26RBS01.md.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
const FIX = [
  { id: 'T80-S2', name: 'Two Thousand', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 2000 }] },
  { id: 'T80-S4', name: 'Four Thousand', type: 'Spirit', color: 'red', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 4000 }] },
  { id: 'T80-S6', name: 'Six Thousand', type: 'Spirit', color: 'red', cost: 6, symbols: 1, levels: [{ cores: 1, bp: 6000 }] },
  { id: 'T80-WF', name: 'Wind Ally', type: 'Spirit', color: 'red', cost: 3, symbols: 1, families: ['Windfang'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'T80-MIN', name: 'Rock Ally', type: 'Spirit', color: 'white', cost: 3, symbols: 1, families: ['Mineroid'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'T80-OG7', name: 'Sea Giant', type: 'Spirit', color: 'green', cost: 7, symbols: 1, families: ['Oceanic Green'], levels: [{ cores: 1, bp: 7000 }] },
  { id: 'T80-OG3', name: 'Sea Small', type: 'Spirit', color: 'green', cost: 3, symbols: 1, families: ['Oceanic Green'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'T80-C4', name: 'Cost Four', type: 'Spirit', color: 'red', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T80-C5', name: 'Cost Five', type: 'Spirit', color: 'red', cost: 5, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T80-BN', name: 'Blue Land', type: 'Nexus', color: 'blue', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
  { id: 'T80-RN', name: 'Red Land', type: 'Nexus', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `const die = (s, q = P) => { q.spirits = q.spirits.filter(x => x !== s); q.trash.push(s); s.lostLv = 0; };
BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 4;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; q.void = 10; q.hand = []; q.life = 5; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; };
  const block = b => { window.cpuChooseBlock = () => b; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('AU80-01 26RBS01-010: destroys an opposing 3000 BP or less Spirit; 5000 BP or less with an exhausted "Windfang" Spirit', async () => {
  const r = await ev(`
    const a = sp('T80-S4', O); const s = sp('26RBS01-010'); await BS.fireFx(P, 'SUMMONED', s); const plain = O.spirits.includes(a);
    O.spirits = []; const w = sp('T80-WF'); w.exhausted = false; const b = sp('T80-S4', O); const s2 = sp('26RBS01-010'); await BS.fireFx(P, 'SUMMONED', s2); const unexhausted = O.spirits.includes(b);
    w.exhausted = true; const s3 = sp('26RBS01-010'); await BS.fireFx(P, 'SUMMONED', s3); const exhausted = O.spirits.includes(b);
    O.spirits = []; const c = sp('T80-S6', O); const s4 = sp('26RBS01-010'); await BS.fireFx(P, 'SUMMONED', s4); const big = O.spirits.includes(c);
    const d = sp('T80-S2', O); O.spirits = O.spirits.filter(x => x === d); w.exhausted = false; const s5 = sp('26RBS01-010'); await BS.fireFx(P, 'SUMMONED', s5);
    return [plain, unexhausted, exhausted, big, O.spirits.includes(d)];`);
  assert.deepEqual(r, [true, true, false, true, false], '[4000 survives without Windfang, survives with a refreshed Windfang, destroyed with an exhausted one, 6000 survives, 2000 destroyed]');
});

test('AU80-02 26RBS01-043 LV2: when only the opposing Spirit is destroyed by BP while attacking, a core from the Void to one of your Spirits', async () => {
  const r = await ev(`
    const a = sp('26RBS01-043', P, 2); const t = sp('T80-S2', O); block(t); const sum = () => P.spirits.reduce((n, x) => n + x.cores, 0); const before = sum();
    await BS.doBattle('player', a); const after = sum();
    const a1 = sp('26RBS01-043', P, 1); P.spirits = P.spirits.filter(x => x === a1); const t1 = sp('T80-S2', O); block(t1); const b1 = a1.cores; await BS.doBattle('player', a1);
    return [O.spirits.includes(t), after - before, a1.cores - b1];`);
  assert.deepEqual(r, [false, 1, 0], '[blocker destroyed, +1 core on your Spirits at LV2, nothing at LV1]');
});

test('AU80-03 26RBS01-085: +3000 BP only while you control three or more Blue Nexuses', async () => {
  const r = await ev(`
    const s = sp('26RBS01-085'); const bp = () => BS.bpOf(s); const out = [bp()];
    nx('T80-BN'); nx('T80-BN'); nx('T80-RN'); out.push(bp()); nx('T80-BN'); out.push(bp()); return out;`);
  assert.deepEqual(r, [5000, 5000, 8000]);
});

test('AU80-04 26RBS01-097: once per turn, when your Cost 7+ "Oceanic Green" Spirit attacks, exhaust an opposing Cost 4 or less Spirit; LV2 +2000 in your Attack Step', async () => {
  const r = await ev(`
    const n = nx('26RBS01-097', P, 3); const big = sp('T80-OG7'); const small = sp('T80-OG3'); const c4 = sp('T80-C4', O); const c5 = sp('T80-C5', O);
    G.step = 5; const bpAtt = BS.bpOf(big), bpSmall = BS.bpOf(small); G.step = 4; const bpMain = BS.bpOf(big); G.step = 5;
    await BS.fireFx(P, 'ALLY_ATTACKS', small, { attacker: small }); const bySmall = c4.exhausted;
    await BS.fireFx(P, 'ALLY_ATTACKS', big, { attacker: big }); const byBig = [c4.exhausted, c5.exhausted];
    c4.exhausted = false; await BS.fireFx(P, 'ALLY_ATTACKS', big, { attacker: big });
    return [bpAtt, bpSmall, bpMain, bySmall, byBig, c4.exhausted];`);
  assert.deepEqual(r, [9000, 3000, 7000, false, [true, false], false], '[+2000 in your Attack Step, not for Cost 3, not in Main Step, no exhaust for Cost 3, Cost 4 exhausted not Cost 5, once per turn]');
});

test('AU80-05 26RBS01-047: destroyed during the opposing Attack Step, you can refresh one of your "Mineroid" Spirits; not in your own turn', async () => {
  const r = await ev(`
    const m = sp('T80-MIN'); m.exhausted = true; const s = sp('26RBS01-047'); G.active = O.key; G.step = 5;
    die(s); await BS.fireFx(P, 'DESTROYED', s); const opp = m.exhausted;
    m.exhausted = true; G.active = P.key; const s2 = sp('26RBS01-047'); die(s2); await BS.fireFx(P, 'DESTROYED', s2);
    return [opp, m.exhausted];`);
  assert.deepEqual(r, [false, true]);
});
