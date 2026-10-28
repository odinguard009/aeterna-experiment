// v0.76.0 bundle (plan W, 3-4 packs per release from docs/reports/pack-plan.md "Measured order"; rules: docs/mechanics/destroy-filters-conditions.md):
//  1. destroy filters: "with BP equal or inferior to this Spirit's" (bpLeSelf), "with the same BP as this Spirit" (bpEqSelf),
//     "with two or more symbols" (symbolsGe), "with a cost equal or less than the number of <X> you control" (costLePer);
//  2. condition clauses: "If you control any exhausted <colour/family> Spirit, ..." (ctrl.exhausted), 'If you control any "Name", ...'
//     (controlName), each in front of a "Target ... . <Verb> it." pair; "target a Cost N or more "X" family Spirit card in your Trash";
//  3. "By discarding a [type/family] card from your Hand, draw N cards." (CR Effect Texts "By doing A, do B": optional, B only after A).
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
const S = '[LV1] (When Summoned) ';

test('PK76-01 compiler: destroy filters relative to this Spirit, symbols, and counts you control', () => {
  assert.deepEqual(acts(S + "Destroy an opposing Spirit/Ultimate with BP equal or inferior to this Spirit's."), [{ do: 'DESTROY', bpLeSelf: true }]);
  assert.deepEqual(acts(S + 'Destroy an opposing Spirit with the same BP as this Spirit.'), [{ do: 'DESTROY', bpEqSelf: true }]);
  assert.deepEqual(acts(S + 'Destroy an opposing Spirit with two or more symbols.'), [{ do: 'DESTROY', symbolsGe: 2 }]);
  assert.deepEqual(acts(S + 'Destroy an opposing Spirit with a cost equal or less than the total number of Nexuses you control.'), [{ do: 'DESTROY', costLePer: { type: 'Nexus' } }]);
  assert.deepEqual(acts(S + 'Destroy an opposing Spirit with a cost equal or inferior to the number of "Investigator" family Spirits you control.'),
    [{ do: 'DESTROY', costLePer: { type: 'Spirit', family: 'Investigator' } }]);
  assert.match(String(acts('[LV1] (When Destroyed) Target an opposing Spirit with the same BP as this Spirit. Destroy it.')), /^REVIEW/, 'no last-known BP after it left');
  for (const t of ['Destroy an opposing Spirit with a Cost equal to or less than the total number of Blue symbols on your field.'])
    assert.match(String(acts(S + t)), /^REVIEW/, t);
});

test('PK76-02 compiler: "If you control any exhausted X / any "Name", target ... . <Verb> it." and Trash targets with a cost', () => {
  assert.deepEqual(acts(S + 'If you control any exhausted Red Spirit, target an opposing 3000 BP or less Spirit. Destroy it.'),
    [{ do: 'DESTROY', bpLe: 3000, if: { ctrl: { n: 1, type: 'Spirit', colors: ['red'], exhausted: true } } }]);
  assert.deepEqual(acts(S + 'If you control any exhausted "Windfang" family Spirit, target an opposing 5000 BP or less Spirit. Destroy it.'),
    [{ do: 'DESTROY', bpLe: 5000, if: { ctrl: { n: 1, type: 'Spirit', family: 'Windfang', exhausted: true } } }]);
  assert.deepEqual(acts(S + 'If you control any "Kamen Rider Zolda", target an opposing Spirit. Return it to the Hand.').map(a => [a.do, a.if]),
    [['BOUNCE_OPP', { controlName: 'Kamen Rider Zolda' }]]);
  assert.deepEqual(acts(S + 'Target a Cost 6 or more "Windfang" family Spirit card in your Trash. Return it to the Hand.'),
    [{ do: 'RETURN_TRASH', match: { family: ['Windfang'], costGe: 6 } }]);
  assert.deepEqual(acts(S + 'If you control any Spirit with Current, you can target an opposing Spirit. Heavy exhaust it.'),      // v0.171: Current is a holder template the engine recognises
    [{ do: 'HEAVY_EXHAUST_OPP', n: 1, if: { ctrl: { n: 1, type: 'Spirit', keyword: 'Current' } } }]);
});

test('PK76-03 compiler: "By discarding a <X> card from your Hand, draw N" = optional DISCARD_HAND then DRAW if done', () => {
  const e = eff(S + 'By discarding a card from your Hand, draw a card.');
  assert.deepEqual(e.actions, [{ do: 'DISCARD_HAND', n: 1 }, { do: 'DRAW', n: 1, if: { prev: true } }]);
  assert.equal(e.optional, true, JSON.stringify(e));
  assert.deepEqual(acts(S + 'By discarding a Spirit card from your Hand, draw a card from your deck.'), [{ do: 'DISCARD_HAND', n: 1, match: { type: 'Spirit' } }, { do: 'DRAW', n: 1, if: { prev: true } }]);
  assert.deepEqual(acts(S + 'By discarding a "Dark Snake" family card from your Hand, draw two cards.'), [{ do: 'DISCARD_HAND', n: 1, match: { family: ['Dark Snake'] } }, { do: 'DRAW', n: 2, if: { prev: true } }]);
  assert.match(String(acts(S + 'By discarding a card from your Hand, also, destroy an opposing 10000 BP or more Spirit.')), /^REVIEW/);
});

let g;
const FIX = [
  { id: 'T76-A', name: 'Small One', type: 'Spirit', color: 'red', cost: 2, symbols: 1, families: ['Investigator'], levels: [{ cores: 1, bp: 2000 }] },
  { id: 'T76-B', name: 'Twin Sym', type: 'Spirit', color: 'red', cost: 5, symbols: 2, families: ['Windfang'], levels: [{ cores: 1, bp: 6000 }] },
  { id: 'T76-C', name: 'Mid One', type: 'Spirit', color: 'blue', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 4000 }] },
  { id: 'T76-N', name: 'A Nexus', type: 'Nexus', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const nx = (id, q = P) => { const i = BS.mkInst(id); i.cores = 0; q.nexus.push(i); return i; };
  const ids = q => q.spirits.map(x => x.id);
  const cands = (src, a) => BS.FX_ACTIONS.DESTROY.cands({ p: P, opp: O, src, ctx: {} }, a).map(x => x.id).sort();
  const run = (src, actions) => BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions });`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('PK76-04 engine: DESTROY bpLeSelf / bpEqSelf / symbolsGe / costLePer candidates, chk and text', async () => {
  const r = await ev(`const src = sp('T76-C'); sp('T76-A', O); sp('T76-B', O); sp('T76-C', O);
    const a = cands(src, { bpLeSelf: true }), b = cands(src, { bpEqSelf: true }), c = cands(src, { symbolsGe: 2 });
    const d0 = cands(src, { costLePer: { type: 'Nexus' } }); nx('T76-N'); nx('T76-N'); const d2 = cands(src, { costLePer: { type: 'Nexus' } });
    const e = cands(src, { costLePer: { type: 'Spirit', family: 'Investigator' } }); sp('T76-A'); sp('T76-A'); const e1 = cands(src, { costLePer: { type: 'Spirit', family: 'Investigator' } });
    const D = BS.FX_ACTIONS.DESTROY;
    await run(src, [{ do: 'DESTROY', symbolsGe: 2 }]);
    return [a, b, c, d0, d2, e, e1, D.chk({ bpLeSelf: true }), D.chk({ symbolsGe: 0 }), D.chk({ costLePer: { type: 'Hand' } }), ids(O), D.txt({ costLePer: { type: 'Nexus' } })];`);
  assert.deepEqual(r, [['T76-A', 'T76-C'], ['T76-C'], ['T76-B'], [], ['T76-A'], [], ['T76-A'], true, false, false, ['T76-A', 'T76-C'],
    'destroy 1 opposing Spirit/Ultimate with a cost equal or less than the number of matching Nexuses you control']);
});

test('PK76-05 engine: fxIf ctrl.exhausted, DISCARD_HAND + DRAW if prev (no discard = no draw)', async () => {
  const r = await ev(`const src = sp('T76-A'); const q = { ctrl: { n: 1, type: 'Spirit', colors: ['red'], exhausted: true } };
    const a = BS.fxIf(P, O, q, {}); src.exhausted = true; const b = BS.fxIf(P, O, q, {});
    P.hand = []; P.deck = [BS.mkInst('T76-C'), BS.mkInst('T76-C')]; const acts = [{ do: 'DISCARD_HAND', n: 1, match: { type: 'Spirit' } }, { do: 'DRAW', n: 1, if: { prev: true } }];
    await run(src, acts); const c = [P.hand.length, P.deck.length];
    P.hand = [BS.mkInst('T76-B')]; await run(src, acts); const d = [P.hand.map(x => x.id), P.trash.map(x => x.id), P.deck.length];
    return [a, b, c, d];`);
  assert.deepEqual(r, [false, true, [0, 2], [['T76-C'], ['T76-B'], 1]]);
});
