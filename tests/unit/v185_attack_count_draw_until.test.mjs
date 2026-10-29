// v0.185.0: if.firstAttack (owner attack counter), DRAW_UNTIL, CANT_BE_BLOCKED_BY bpLe/coresLe.
// rules: ETR:battle.block@d20adf64
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.hand = []; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V185-01 firstAttack is true on the first attack of the turn only', async () => {
  const r = await ev(`const f = n => { P.attacksThisTurn = n; return BS.fxIf(P, O, { firstAttack: true }, {}) + '/' + BS.fxIf(P, O, { firstAttack: false }, {}); };
    return [f(1), f(2)];`);
  assert.deepEqual(r, ['true/false', 'false/true']);
});

test('V185-02 DRAW_UNTIL tops the Hand up to n and draws nothing above it', async () => {
  const r = await ev(`const run = async n => { await BS.FX_ACTIONS.DRAW_UNTIL.run({ p: P, opp: O, src: sp('BS01-035'), ctx: {} }, { n }); return P.hand.length; };
    const a = await run(3), b = await run(2); return [a, b];`);
  assert.deepEqual(r, [3, 3]);
});

test('V185-03 CANT_BE_BLOCKED_BY bpLe / coresLe skip small blockers', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), d = sp('BS01-042', O, 1); G.attacker = a; G.battleNo = 4;
    const out = []; const run = x => BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: a, ctx: {} }, x);
    await run({ bpLe: BS.bpOf(d) }); out.push(BS.blockedByMark(a, d));
    await run({ bpLe: BS.bpOf(d) - 1 }); out.push(BS.blockedByMark(a, d));
    await run({ coresLe: 1 }); out.push(BS.blockedByMark(a, d));
    await run({ coresLe: 0 }); out.push(BS.blockedByMark(a, d));
    return out;`);
  assert.deepEqual(r, [true, false, true, false]);
});

test('V185-04 blockerBpLe passes only when the blocker BP is at or below the limit', async () => {
  const r = await ev(`const d = sp('BS01-042', O, 1), b = BS.bpOf(d);
    return [BS.fxIf(P, O, { blockerBpLe: b }, { blocker: d }), BS.fxIf(P, O, { blockerBpLe: b - 1 }, { blocker: d }), BS.fxIf(P, O, { blockerBpLe: b }, {})];`);
  assert.deepEqual(r, [true, false, false]);
});

test('V185-05 MUST_BLOCK_OPP marks an exhausted target for this battle and needs an attack', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), d = sp('BS01-042', O, 1); d.exhausted = true; G.battleNo = 7;
    const run = x => BS.FX_ACTIONS.MUST_BLOCK_OPP.run({ p: P, opp: O, src: a, ctx: {} }, x);
    G.attacker = null; await run({ state: 'exhausted' }); const none = d.mustB;
    G.attacker = a; await run({ state: 'refreshed' }); const wrongState = d.mustB;
    await run({ state: 'exhausted' }); return [none, wrongState, d.mustB, d.blockExB];`);
  assert.deepEqual(r, [undefined, undefined, 7, 7]);
});

test('V185-06 selfBlocked is true only while this Spirit attacks and has a blocker', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), d = sp('BS01-042', O, 1), f = () => BS.fxIf(P, O, { selfBlocked: true }, { selfInst: a });
    G.attacker = a; G.blocker = null; const x = f(); G.blocker = d; const y = f(); G.attacker = null; return [x, y, f()];`);
  assert.deepEqual(r, [false, true, false]);
});

test('V185-07 DEPLOY_TRASH deploys a matching Nexus from the Trash and leaves other cards', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3); P.cores = P.cores || []; const n = BS.mkInst('BS01-098'), m = BS.mkInst('BS01-100'); P.trash.push(n, m);
    const c = { p: P, opp: O, src: a, ctx: {} }; await BS.FX_ACTIONS.DEPLOY_TRASH.run(c, { match: { costLe: 3 } });
    return [c.ctx.did, P.nexus.includes(n), P.trash.includes(m), P.trash.includes(n)];`);
  assert.deepEqual(r, [true, true, true, false]);
});

test('V185-08 STATIC perCores (26RDB01-018): +1000 BP per core while LV2 in your Attack Step', async () => {
  const r = await ev(`const t = sp('26RDB01-018', P, 3); G.active = P.key; G.step = 5; const a = BS.bpOf(t); t.cores = 4; return BS.bpOf(t) - a;`);
  assert.equal(r, 1000);
});

test('V185-09 STATIC per + to own (26RBS01-083): all your Spirits get +1000 BP per Blue Nexus in your Attack Step', async () => {
  const r = await ev(`const t = sp('26RBS01-083', P, 3), o = sp('26RBS01-083', P, 3); G.active = P.key; G.step = 5; const a = BS.bpOf(o); P.nexus.push(BS.mkInst('BS03-113')); return BS.bpOf(o) - a;`);
  assert.equal(r, 2000);      // two copies of the card: each adds +1000 per Blue Nexus to every Spirit (the Nexus is Blue)
});

test('V185-10 HAND_RECYCLE returns the Hand to the deckbottom, then draws per opposing Hand card / N when all match', async () => {
  const r = await ev(`const run = async (a, h) => { P.hand = []; for (let i = 0; i < h; i++) P.hand.push(BS.mkInst('BS01-035')); O.hand = [BS.mkInst('BS01-035'), BS.mkInst('BS01-035')]; const d = P.deck.length;
      const c = { p: P, opp: O, src: sp('BS01-035'), ctx: {} }; await BS.FX_ACTIONS.HAND_RECYCLE.run(c, a); return [P.hand.length, P.deck.length - d, c.ctx.did]; };
    return [await run({ do: 'HAND_RECYCLE', perOppHand: true }, 3), await run({ do: 'HAND_RECYCLE', drawIfAll: { match: { costLe: 99 }, n: 3 } }, 4), await run({ do: 'HAND_RECYCLE', perOppHand: true }, 0)];`);
  assert.deepEqual(r, [[2, 1, true], [3, 1, true], [0, 0, false]]);
});

test('V185-11 DESTROY_OWN other: this Spirit is never a candidate', async () => {
  const r = await ev(`const a = sp('BS01-035', P, 3), b = sp('BS01-042', P, 1); const m = { type: 'Spirit' };
    return [BS.FX_ACTIONS.DESTROY_OWN.cands({ p: P, src: a }, { match: m, other: true }).length, BS.FX_ACTIONS.DESTROY_OWN.cands({ p: P, src: a }, { match: m }).length];`);
  assert.deepEqual(r, [1, 2]);
});

test('V185-12 DESTROY_ANY noTR skips a True Release Nexus at LV2+; drawIfDone draws for any side', async () => {
  const r = await ev(`const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].trueRelease && BS.CARDS[k].type === 'Nexus'); const n = BS.mkInst(id); n.cores = 9; O.nexus.push(n); const x = BS.mkInst('BS01-098'); O.nexus.push(x);
    const c = { p: P, opp: O, src: sp('BS01-035', P, 3), ctx: {} }; return [!!id, BS.lvNo(n) >= 2, BS.FX_ACTIONS.DESTROY_ANY.cands(c, { do: 'DESTROY_ANY', kind: 'nexus', noTR: true }).includes(n), BS.FX_ACTIONS.DESTROY_ANY.cands(c, { do: 'DESTROY_ANY', kind: 'nexus', noTR: true }).includes(x)];`);
  assert.deepEqual(r, [true, true, false, true]);
});
