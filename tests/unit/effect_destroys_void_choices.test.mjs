// v0.77.0 bundle (plan W, 3-4 packs per release from docs/reports/pack-plan.md "Measured order"; rules: docs/mechanics/effect-depletes-void-choices.md):
//  1. "When this effect destroys / depletes any Spirit, draw a card." after the action it watches (DESTROY thenDraw,
//     OPP_CORES_TO_RESERVE drawPerDepleted); "If it depletes, draw a card.";
//  2. Void destinations: "your Spirit/Reserve", "this Spirit, or your Reserve" (orReserve), "that Spirit" after
//     "When your X Spirit attacks" (to: 'attacker'); early wording "Gain N core(s) on this spirit / in your Reserve / on target nexus";
//  3. conditions "If you control fewer Spirits than the opponent" (fewerSpirits), "If you control a <colour> nexus" (nexusGe);
//  4. "Target an opposing <Cost N or less | exhausted | N cores or less> Spirit. Send N core(s) from it to the Reserve
//     [. Its number of cores can't be brought to less than one]" and "... until one core remains"; "Target X, destroy it."
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);
const eff = text => { const r = compile(text); return r.review ? 'REVIEW ' + r.review : r.effects[0]; };
const acts = text => { const r = eff(text); return typeof r === 'string' ? r : r.actions; };
const S = '[LV1] (When Summoned)\n';

test('PK77-01 compiler: "When this effect destroys / depletes any Spirit, draw a card" joins the action before it', () => {
  assert.deepEqual(acts(S + 'Destroy an opposing 5000 BP or less Spirit. When this effect destroys any opposing Spirit, draw a card.'), [{ do: 'DESTROY', bpLe: 5000, thenDraw: 1 }]);
  assert.deepEqual(acts(S + 'Destroy an opposing exhausted Spirit. When this effect destroys any Spirit, draw a card.'), [{ do: 'DESTROY', exhaustedOnly: true, thenDraw: 1 }]);
  assert.deepEqual(acts(S + 'Send a core from an opposing Spirit to their Reserve. When this effect depletes any Spirit, draw a card.'),
    [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, drawPerDepleted: true }]);
  assert.deepEqual(acts(S + 'Send a core from any opposing Spirit to the Reserve. When this effect brought the number of cores on that Spirit to 0, draw a card.'),
    [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, drawPerDepleted: true }]);
  assert.match(String(acts(S + 'Return an opposing Spirit to the Hand. When this effect destroys any Spirit, draw a card.')), /^REVIEW/);
  assert.match(String(acts(S + 'Destroy every opposing 3000 BP or less Spirit. When this effect destroys any Spirit, draw a card.')), /^REVIEW/);
});

test('PK77-02 compiler: Void destinations with a choice or the attacker, early "gain a core" wording, new conditions', () => {
  assert.deepEqual(acts(S + 'Put a core from the Void to this Spirit, or your Reserve.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'self', orReserve: true }]);
  assert.deepEqual(acts(S + 'Put a core from the Void to your Spirit/Reserve.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit', orReserve: true }]);
  const e = eff('[LV1] (Your Attack Step) When your "Imaginary Beast" family Spirit attacks, put a core from the Void to that Spirit.');
  assert.deepEqual([e.trigger, e.actions], ['ALLY_ATTACKS', [{ do: 'VOID_TO_CARD', n: 1, to: 'attacker' }]]);
  assert.match(String(acts(S + 'Put a core from the Void to that Spirit.')), /^REVIEW/, 'no attacker outside an attack trigger');
  assert.deepEqual(acts('[LV1] (When Attacks) Gain 1 core on this spirit.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'self' }]);
  assert.deepEqual(acts('[LV1] (When Attacks) Gain 1 core in your reserve.'), [{ do: 'VOID_TO_RESERVE', n: 1 }]);
  assert.deepEqual(acts('[LV1] (When Destroyed) Gain 1 core on target nexus you control.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'anyNexus' }]);
  assert.deepEqual(acts('[LV1] (When Blocks) If you control a green nexus, gain 1 core on this spirit.'),
    [{ do: 'VOID_TO_CARD', n: 1, to: 'self', if: { nexusGe: { n: 1, colors: ['green'] } } }]);
  assert.deepEqual(acts(S + 'If you control fewer Spirits than the opponent, return an opposing Spirit to the Hand.'),
    [{ do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', if: { fewerSpirits: true } }]);
});

test('PK77-03 compiler: targeted core removal with filters / a floor, and "Target X, destroy it."', () => {
  assert.deepEqual(acts(S + 'Target an opposing Cost 5 or less Spirit. Send cores from it to the Reserve until one core remains. (The opponent chooses which cores to send)'),
    [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, untilOne: true, costLe: 5 }]);
  assert.deepEqual(acts(S + 'Target an opposing Cost 5 or less Spirit. Send two cores, besides , from it to the Reserve. Its number of cores can\'t be brought to less than one.'),
    [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2, keepOne: true, costLe: 5 }]);
  assert.deepEqual(acts(S + 'Target an opposing exhausted Spirit. Send a core, besides , from it to the Reserve.'), [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, exhaustedOnly: true }]);
  assert.deepEqual(acts(S + 'Target an opposing Spirit with three cores or less on it. Send cores from it to the Reserve until one core remains.'),
    [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, untilOne: true, coresLe: 3 }]);
  assert.deepEqual(acts(S + 'Target an opposing Spirit. Send a core, besides , from it to the Reserve. If it depletes, draw a card.'),
    [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, drawPerDepleted: true }]);
  assert.deepEqual(acts(S + 'Target an opposing 5000 BP or less Spirit, destroy it.'), [{ do: 'DESTROY', bpLe: 5000 }]);
  assert.match(String(acts(S + 'Target an opposing Spirit with Clash. Send a core from it to the Reserve.')), /^REVIEW/);
});

let g;
const FIX = [
  { id: 'T77-A', name: 'Small One', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 2000 }] },
  { id: 'T77-B', name: 'Big One', type: 'Spirit', color: 'red', cost: 6, symbols: 1, levels: [{ cores: 1, bp: 6000 }] },
  { id: 'T77-N', name: 'Green Gate', type: 'Nexus', color: 'green', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; q.void = 10; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const nx = (id, q = P) => { const i = BS.mkInst(id); i.cores = 0; q.nexus.push(i); return i; };
  const run = (src, actions, ctx = {}) => BS.runActions({ p: P, opp: O, src, ctx }, { actions });`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('PK77-04 engine: VOID_TO_CARD orReserve / attacker, conditions fewerSpirits / nexusGe', async () => {
  const r = await ev(`const src = sp('T77-A'); const V = BS.FX_ACTIONS.VOID_TO_CARD;
    const r0 = P.reserve.n; await run(src, [{ do: 'VOID_TO_CARD', n: 1, to: 'self', orReserve: true }]); const a = [src.cores, P.reserve.n - r0];
    P.spirits = []; const r1 = P.reserve.n; await run(src, [{ do: 'VOID_TO_CARD', n: 1, to: 'self', orReserve: true }]); const b = P.reserve.n - r1;
    const att = sp('T77-B'); await run(src, [{ do: 'VOID_TO_CARD', n: 2, to: 'attacker' }], { attacker: att }); const c = att.cores;
    const f0 = BS.fxIf(P, O, { fewerSpirits: true }, {}); sp('T77-A', O); sp('T77-A', O); const f1 = BS.fxIf(P, O, { fewerSpirits: true }, {});
    const n0 = BS.fxIf(P, O, { nexusGe: { n: 1, colors: ['green'] } }, {}); nx('T77-N'); const n1 = BS.fxIf(P, O, { nexusGe: { n: 1, colors: ['green'] } }, {});
    return [a, b, c, f0, f1, n0, n1, V.chk({ n: 1, to: 'attacker' }), V.chk({ n: 1, to: 'anyNexus', orReserve: true }), V.chk({ n: 1, to: 'attacker', orReserve: true }),
      BS.parseCard({ id: 'X', name: 'X', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'SUMMONED', lv: [1], actions: [{ do: 'DRAW', n: 1, if: { fewerSpirits: true, nexusGe: { colors: ['green'] } } }] }] }).errors || []];`);
  assert.deepEqual(r, [[2, 0], 1, 3, false, true, false, true, true, false, false, []]);
});

test('PK77-05 engine: OPP_CORES_TO_RESERVE filters, keepOne, untilOne, draw on depletion', async () => {
  const r = await ev(`const src = sp('T77-A'); const OC = BS.FX_ACTIONS.OPP_CORES_TO_RESERVE;
    const small = sp('T77-A', O, 4), big = sp('T77-B', O, 4);
    const cands = a => OC.cands({ p: P, opp: O, src, ctx: {} }, a).map(x => x.id).sort();
    const a = cands({ targets: 1, each: 1, costLe: 5 }); big.exhausted = true; const b = cands({ targets: 1, each: 1, exhaustedOnly: true });
    const c = cands({ targets: 1, each: 1, coresLe: 3 });
    await run(src, [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, untilOne: true, costLe: 5 }]); const d = small.cores;
    big.cores = 2; await run(src, [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2, keepOne: true, exhaustedOnly: true }]); const e = big.cores;
    O.spirits = [big]; big.cores = 1; P.hand = []; P.deck = [BS.mkInst('T77-A')];
    await run(src, [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1, costLe: 9, drawPerDepleted: true }]); const f = [O.spirits.length, P.hand.length];
    return [a, b, c, d, e, f, OC.chk({ targets: 2, each: 1, costLe: 5 }), OC.chk({ targets: 1, each: 1, untilOne: true }), OC.txt({ targets: 1, each: 1, untilOne: true, costLe: 5 })];`);
  assert.deepEqual(r, [['T77-A'], ['T77-B'], [], 1, 1, [0, 1], true, true, 'send cores from an opposing Cost 5 or less Spirit to the Reserve until one core remains']);      // v199: targets 2-3 are multi-target now, so the shape is valid
});
