// Lane K tests, file 78 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Schema v247: STATIC UNAFFECTED from.costLe (number | "self" | "counters"). Cards: BS75-035, BS75-041.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

const run = async body => { const { page } = await sharedBoard(); return page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.count = 0; }
  const sp = (id, q, n) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const by = (src) => ({ p: O, src });
  ${body} })()`); };

test('K-780 BS75-041 LV2: unaffected by opposing effects of Cost 9 or less (its own cost), not by a higher one', async () => {
  const r = await run(`const t = sp('BS75-041', P, 3); const lo = sp('BS75-001', O, 1), eq = sp('BS75-041', O, 3), hi = sp('BS75-013', O, 1);
    const cheap = BS.fxImmune(P, t, by(lo)), same = BS.fxImmune(P, t, by(eq));
    BS.CARDS['BS75-013'].cost = 10; const high = BS.fxImmune(P, t, by(hi)); BS.CARDS['BS75-013'].cost = 8; return [cheap, same, high];`);
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});

test('K-781 BS75-041 at LV1 (1 core) is not protected', async () => {
  const r = await run(`const t = sp('BS75-041', P, 1); const lo = sp('BS75-001', O, 1); return BS.fxImmune(P, t, by(lo));`);
  assert.equal(r, false);
});

test('K-782 BS75-035 LV2: Awakened Dragon Spirits are unaffected by opposing Spirit effects up to the counter count', async () => {
  const r = await run(`const a = sp('BS75-035', P, 3), ally = sp('BS75-041', P, 3); P.count = 5;
    const s5 = sp('BS75-011', O, 1), s8 = sp('BS75-013', O, 1);
    const out = [BS.fxImmune(P, a, by(s5)), BS.fxImmune(P, ally, by(s5)), BS.fxImmune(P, a, by(s8))]; P.count = 8; out.push(BS.fxImmune(P, a, by(s8))); P.count = 0; out.push(BS.fxImmune(P, a, by(s5))); return out;`);
  assert.deepEqual(r, [true, true, false, true, false], JSON.stringify(r));
});

test('K-783 BS75-035 does not protect a non-Awakened-Dragon Spirit', async () => {
  const r = await run(`const a = sp('BS75-035', P, 3), other = sp('BS75-011', P, 3); P.count = 9; return BS.fxImmune(P, other, by(sp('BS75-001', O, 1)));`);
  assert.equal(r, false);
});

test('K-784 data: both cards carry the new from.costLe filter', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS75-035', 'BS75-041'].map(i => { const c = BS.CARDS[i]; const e = c.effects.find(x => x.flag === 'UNAFFECTED'); return [true, e && e.from.costLe]; }));
  assert.deepEqual(r, [[true, 'counters'], [true, 'self']], JSON.stringify(r));
});

test('K-785 BS72-050 REVEAL_DEPLOY rest either: the CPU sends the unused revealed cards to the deckbottom', async () => {
  const r = await run(`P.cpu = true; P.deck = []; for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst('BS75-001')); P.deck.push(BS.mkInst('BS75-004'));
    const s = sp('BS72-050', P, 3); const top0 = P.deck[0].id;
    await BS.FX_ACTIONS.REVEAL_DEPLOY.run({ p: P, opp: O, src: s, ctx: {} }, { n: 4, match: { family: ['Scalostle'] }, pay: false, rest: 'either' });
    return [P.deck.length, P.deck[P.deck.length - 1].id, P.deck[0].id === top0];`);
  assert.deepEqual(r, [5, 'BS75-001', false], JSON.stringify(r));
});

test('K-786 BS74-045: Awakened Dragon Spirits are unaffected by opposing purple/white/blue effects only', async () => {
  const r = await run(`const t = sp('BS74-045', P, 1), ally = sp('BS75-035', P, 1), other = sp('BS75-011', P, 1);
    const find = col => Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && (BS.CARDS[i].colors || [BS.CARDS[i].symbol]).length === 1 && (BS.CARDS[i].colors || [BS.CARDS[i].symbol])[0] === col);
    const res = {}; for (const col of ['purple', 'white', 'blue', 'red']) res[col] = [BS.fxImmune(P, t, by(sp(find(col), O, 1))), BS.fxImmune(P, ally, by(sp(find(col), O, 1))), BS.fxImmune(P, other, by(sp(find(col), O, 1)))];
    return res;`);
  assert.deepEqual(r, { purple: [true, true, false], white: [true, true, false], blue: [true, true, false], red: [false, false, false] }, JSON.stringify(r));
});

const RED = `Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && (BS.CARDS[i].colors || [BS.CARDS[i].symbol]).join() === 'red')`;
const BLUE = `Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && (BS.CARDS[i].colors || [BS.CARDS[i].symbol]).join() === 'blue')`;

test('K-787 BS55-043: every own Spirit is unaffected by opposing red effects, not blue ones', async () => {
  const r = await run(`const t = sp('BS75-011', P, 1); sp('BS55-043', P, 3);
    return [BS.fxImmune(P, t, by(sp(${RED}, O, 1))), BS.fxImmune(P, t, by(sp(${BLUE}, O, 1)))];`);
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-788 BS56-033 LV2: itself and Astroblazer+Machine Beast Spirits resist red; a Machine Beast alone does not', async () => {
  const r = await run(`const me = sp('BS56-033', P, 3); const both = sp('BS58-036', P, 1); const mbOnly = sp('BS73-035', P, 1); const red = sp(${RED}, O, 1);
    return [BS.fxImmune(P, me, by(red)), BS.fxImmune(P, both, by(red)), BS.fxImmune(P, mbOnly, by(red))];`);
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});

test('K-789 BS58-036 LV2: own purple/white Proximate/Astroblazer Spirits resist red and purple effects', async () => {
  const r = await run(`const me = sp('BS58-036', P, 3); const red = sp(${RED}, O, 1), blue = sp(${BLUE}, O, 1);
    const a = [BS.fxImmune(P, me, by(red)), BS.fxImmune(P, me, by(blue))]; const other = sp('BS75-011', P, 1); return a.concat([BS.fxImmune(P, other, by(red))]);`);
  assert.deepEqual(r, [true, false, false], JSON.stringify(r));
});

test('K-790 BS54-034: unaffected by opposing Spirit/Nexus effects only while you control a Grandstone Nexus', async () => {
  const r = await run(`const t = sp('BS54-034', P, 3); const o = sp('BS75-011', O, 1); const before = BS.fxImmune(P, t, by(o));
    const n = BS.mkInst('BS54-061'); n.cores = 0; P.nexus.push(n); return [before, BS.fxImmune(P, t, by(o))];`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-791 BS53-037 LV2: an opposing Cost 5 or less attacker refreshes it and a Void core moves onto it; a Cost 6 attacker does not', async () => {
  const r = await run(`const t = sp('BS53-037', P, 2); t.exhausted = true; P.void = P.void || []; const before = t.cores;
    const lo = sp('BS75-001', O, 1); BS.CARDS['BS75-001'].cost = 5; BS.G.attacker = lo; await BS.fireFx(P, 'OPP_ATTACKS', lo, { attacker: lo });
    const a = [t.exhausted]; t.exhausted = true; BS.CARDS['BS75-001'].cost = 6; await BS.fireFx(P, 'OPP_ATTACKS', lo, { attacker: lo }); a.push(t.exhausted); return a;`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-792 BS42-002 LV2: unaffected by opposing Spirit effects only while exhausted', async () => {
  const r = await run(`const t = sp('BS42-002', P, 3); const o = sp('BS75-011', O, 1); t.exhausted = false; const a = BS.fxImmune(P, t, by(o)); t.exhausted = true; return [a, BS.fxImmune(P, t, by(o))];`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-793 BS70-036 LV2: unaffected by opposing red Spirit effects, not blue ones', async () => {
  const r = await run(`const t = sp('BS70-036', P, 3); return [BS.fxImmune(P, t, by(sp(${RED}, O, 1))), BS.fxImmune(P, t, by(sp(${BLUE}, O, 1)))];`);
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-794 BS12-028 LV2: own white Spirits resist opposing Brave effects only in the opposing Main Step', async () => {
  const r = await run(`const me = sp('BS12-028', P, 3), ally = sp(Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && (BS.CARDS[i].colors || [BS.CARDS[i].symbol]).join() === 'white'), P, 1);
    const brv = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Brave'); const src = BS.mkInst(brv); const c = { p: O, src };
    const own = BS.fxImmune(P, ally, c); G.active = 'opponent'; G.step = 4; const opp = BS.fxImmune(P, ally, c); G.step = 5; const atk = BS.fxImmune(P, ally, c); return [own, opp, atk];`);
  assert.deepEqual(r.slice(0, 3), [false, true, false], JSON.stringify(r));
});

test('K-795 BS21-046 / BS22-040: to:"opp" CANT_ATTACK bars only the opposing Spirits of the matching cost', async () => {
  const r = await run(`const byCost = c => Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.CARDS[i].cost === c);
    sp('BS21-046', P, 1); const z = sp(byCost(0), O, 1), one = sp(byCost(1), O, 1), mine = sp(byCost(0), P, 1);
    const out = [BS.flagActive(O, 'CANT_ATTACK', z), BS.flagActive(O, 'CANT_ATTACK', one), BS.flagActive(P, 'CANT_ATTACK', mine)];
    sp('BS22-040', P, 2); const three = sp(byCost(3), O, 1); out.push(BS.flagActive(O, 'CANT_ATTACK', three)); return out;`);
  assert.deepEqual(r, [true, false, false, true], JSON.stringify(r));
});

test('K-796 Charge: core removal sends +1, deck discard +1 (non-Ultimate gate), BP destruction limit +1000, BP- +1000, exhaust +1', async () => {
  const r = await run(`const mk = (id, q) => sp(id, q, 3); const c = (src, q) => ({ p: q, opp: q === P ? O : P, src, ctx: {} });
    const a = BS.chargeAction(c(sp('BS75-001', P, 1), P), { do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1 }); const base = a.each;
    mk('BS23-015', P); const b = BS.chargeAction(c(sp('BS75-001', P, 1), P), { do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1 }).each, t = BS.chargeAction(c(sp('BS75-001', P, 1), P), { do: 'OPP_CORES_TO_RESERVE', total: 2 }).total;
    mk('BS19-057', P); const m = BS.chargeAction(c(sp('BS75-001', P, 1), P), { do: 'MILL_OPP', n: 2 }).n;
    mk('BS21-002', P); const d = BS.chargeAction(c(sp('BS75-001', P, 1), P), { do: 'DESTROY', bpLe: 5000 }).bpLe;
    mk('BS20-037', P); const bp = BS.chargeAction(c(sp('BS75-001', P, 1), P), { do: 'BP_MINUS', n: 2000 }).n;
    mk('BS20-020', P); const ex = BS.chargeAction(c(sp('BS75-001', P, 1), P), { do: 'EXHAUST_OPP', n: 1 }).n;
    const opp = BS.chargeAction(c(sp('BS75-001', O, 1), O), { do: 'MILL_OPP', n: 2 }).n; return [base, b, t, m, d, bp, ex, opp];`);
  assert.deepEqual(r, [1, 2, 3, 3, 6000, 3000, 2, 2], JSON.stringify(r));
});

test('K-797 BS19-029 / BS19-052 / BS21-039: Charge by level together with NO_DECK_DISCARD and CANT_ATTACK', async () => {
  const r = await run(`const c = src => ({ p: P, opp: O, src, ctx: {} });
    const a = sp('BS19-029', P, 1), x1 = BS.chargeAction(c(a), { do: 'EXHAUST_OPP', n: 1 }).n; a.cores = 3; const x2 = BS.chargeAction(c(a), { do: 'EXHAUST_OPP', n: 1 }).n;
    const b = sp('BS21-039', P, 1); const atk = BS.flagActive(P, 'CANT_ATTACK', b), nd = BS.flagActive(P, 'NO_DECK_DISCARD', sp('BS19-052', P, 1));
    return [x1, x2, atk, nd];`);
  assert.deepEqual(r, [1, 2, true, true], JSON.stringify(r));
});

test('K-798 Charge kind refresh: Spirit-refreshing effects refresh one more body (REFRESH_SPIRIT count)', async () => {
  const r = await run(`P.cpu = true; sp('BS21-033', P, 1); const x = sp('BS75-001', P, 1), y = sp('BS75-011', P, 1); x.exhausted = true; y.exhausted = true;
    const src = sp('BS75-004', P, 1); const act = BS.chargeAction({ p: P, opp: O, src, ctx: {} }, { do: 'REFRESH_SPIRIT' });
    await BS.FX_ACTIONS.REFRESH_SPIRIT.run({ p: P, opp: O, src, ctx: {} }, act); return [act.count, x.exhausted, y.exhausted];`);
  assert.deepEqual(r, [2, false, false], JSON.stringify(r));
});

test('K-799 Spirit Soul (BS24-001 / BS38-042): an Ultimate being summoned yields an extra symbol of the Spirit colour at its levels only', async () => {
  const r = await run(`const ult = Object.values(BS.CARDS).find(k => k.type === 'Ultimate'), spirit = BS.CARDS['BS75-001'];
    const t = sp('BS24-001', P, 1); const a = summonSymbols(P, ult).length, b = summonSymbols(P, spirit).length;
    const u = sp('BS38-042', P, 1); const c = summonSymbols(P, ult).map(x => x[0]).sort().join();
    return [a, b, c];`);
  assert.deepEqual(r, [1, 0, 'blue,red'], JSON.stringify(r));
});

test('K-800 NO_DESTROY_OPP (BS25-028 / BS28-001 / BS30-034): survives an opposing effect, still dies by own effect or battle', async () => {
  const r = await run(`const t = sp('BS28-001', P, 1); BS.G.fxBy = O.key; BS.removeSpirit(P, t, 'destroyed', true); const a = P.spirits.includes(t);
    BS.G.fxBy = P.key; BS.removeSpirit(P, t, 'destroyed', false); const b = P.spirits.includes(t); BS.G.fxBy = null;
    const u = sp('BS30-034', P, 1); BS.removeSpirit(P, u, 'destroyed', 'battle'); return [a, b, P.spirits.includes(u)];`);
  assert.deepEqual(r, [true, false, false], JSON.stringify(r));
});
