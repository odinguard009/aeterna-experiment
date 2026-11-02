// v0.75.0 bundle (plan W, owner 2026-10-20: 3-4 packs per release from docs/reports/pack-plan.md "Measured order"):
//  1. "Put a core from the Void to <your Trash | this Spirit[, and refresh it] | one of your [A/B colour] Nexuses | each to every <X> you control>"
//     = VOID_TO_TRASH (new) / VOID_TO_CARD self, anyNexus, eachSpirit, eachNexus; match.color may list two colours (either);
//  2. reveal endings: singular / "the remaining", "either the decktop or the deckbottom" (REVEAL_PICK rest 'either'), one-card
//     "If that card is X, add it to the Hand. If not, return it to the decktop / discard it." (rest 'top' / 'trash');
//  3. "Destroy an opposing exhausted Spirit" (DESTROY exhaustedOnly with no bound), "..., and effects of the destroyed ... can't activate"
//     (noFx), "..., and when destroys, draw a card" (thenDraw);
//  4. a Flash Magic may say "during this battle" (BP_TARGET battle / SYMBOL_TARGET do nothing outside a battle).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);
const acts = text => { const r = compile(text); return r.review ? 'REVIEW ' + r.review : r.effects[0].actions; };
const S = '[LV1] (When Summoned) ';

test('PK75-01 compiler: Void cores to the Trash, this Spirit (+ refresh), Nexuses, "each to every", two colours', () => {
  assert.deepEqual(acts(S + 'Put a core from the Void to your Trash.'), [{ do: 'VOID_TO_TRASH', n: 1 }]);
  assert.deepEqual(acts(S + 'Put a core from the Void to this Spirit, and refresh it.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'self' }, { do: 'REFRESH' }]);
  assert.deepEqual(acts(S + 'Put a core from the Void to any of your Nexus.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'anyNexus' }]);
  assert.deepEqual(acts(S + 'Put a core from the Void to any Red/White Spirit you control.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit', match: { color: ['red', 'white'] } }]);
  assert.deepEqual(acts(S + 'Put a core from the Void each to every "Plant Spirit"/"Winged Beast" family Spirit you control.'),
    [{ do: 'VOID_TO_CARD', n: 1, to: 'eachSpirit', match: { family: ['Plant Spirit', 'Winged Beast'] } }]);
  assert.deepEqual(acts(S + 'Put a core from the Void each to every Blue Nexus you control.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'eachNexus', match: { color: 'blue' } }]);
  for (const t of ['each to every Spirit with Rush you control', 'to any Red-only Grandwalker Nexus you control', 'to your Nexus/Grandstone Nexus'])      // v0.77: 'to your Spirit/Reserve' compiles (orReserve, PK77-02)
    assert.match(String(acts(S + `Put a core from the Void ${t}.`)), /^REVIEW/, t);
});

test('PK75-02 compiler: reveal endings (singular, decktop or deckbottom, one-card "If not, ..." forms)', () => {
  const R = 'Reveal a card from your decktop. ';
  assert.deepEqual(acts(S + R + 'If that card is a "Terra Dragon" family Spirit card, add it to the Hand. If not, return it to the decktop.'),
    [{ do: 'REVEAL_PICK', n: 1, match: { family: ['Terra Dragon'], type: 'Spirit' }, rest: 'top' }]);
  assert.deepEqual(acts(S + R + 'If that card is a Red Spirit card, add it to your hand. Otherwise, return it to your decktop.'),
    [{ do: 'REVEAL_PICK', n: 1, match: { type: 'Spirit', color: 'red' }, rest: 'top' }]);
  assert.deepEqual(acts(S + R + "If that's a Magic card, add it to the Hand. Return any remaining card to the decktop or deckbottom."), [{ do: 'REVEAL_PICK', n: 1, match: { type: 'Magic' }, rest: 'either' }]);
  assert.deepEqual(acts(S + R + 'If that card is an "Imaginary Beast" family Spirit card, add it to the Hand. If not, discard it.'),
    [{ do: 'REVEAL_PICK', n: 1, match: { family: ['Imaginary Beast'], type: 'Spirit' }, rest: 'trash' }]);
  assert.deepEqual(acts(S + 'Reveal four cards from your decktop. Among them, add a Nexus card to your Hand. Discard the remaining cards.'), [{ do: 'REVEAL_PICK', n: 4, match: { type: 'Nexus' }, rest: 'trash' }]);
  assert.match(String(acts(S + 'Reveal two cards from your decktop. Among them, add a Nexus card to your Hand. Return any remaining cards to the decktop.')), /^REVIEW/, 'several cards back on top: order not modelled');
});

test('PK75-03 compiler: exhausted-only destruction, noFx / thenDraw tails; Flash Magic "during this battle"', () => {
  assert.deepEqual(acts(S + 'Destroy an opposing exhausted Spirit.'), [{ do: 'DESTROY', exhaustedOnly: true }]);
  assert.deepEqual(acts(S + "Destroy an opposing 5000 BP or less Spirit/Ultimates, and effects of the destroyed Spirit/Ultimate can't activate."), [{ do: 'DESTROY', bpLe: 5000, noFx: true }]);
  assert.deepEqual(acts(S + 'Destroy an opposing 3000 BP or less Spirit, and when destroys, draw a card.'), [{ do: 'DESTROY', bpLe: 3000, thenDraw: 1 }]);
  const m = compile('Flash / Target one of your Spirits. During this battle, give it +3000 BP.'.replace(' / ', '\n'), { type: 'Magic', levels: undefined });
  assert.deepEqual(m.magic && m.magic.actions, [{ do: 'BP_TARGET', n: 3000, to: 'pick', battle: true }], JSON.stringify(m));
  const main = compile('Main\nTarget one of your Spirits. During this battle, give it +3000 BP.', { type: 'Magic', levels: undefined });
  assert.ok(main.review, 'a Main-only Magic has no battle: stays in review');
});

let g;
const FIX = [
  { id: 'T75-PL', name: 'Plant One', type: 'Spirit', color: 'green', cost: 2, symbols: 1, families: ['Plant Spirit'], levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T75-WB', name: 'Bird One', type: 'Spirit', color: 'white', cost: 2, symbols: 1, families: ['Winged Beast'], levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T75-RD', name: 'Red One', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T75-NX', name: 'Blue Nexus', type: 'Nexus', color: 'blue', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
  { id: 'T75-NR', name: 'Red Nexus', type: 'Nexus', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
  { id: 'T75-MG', name: 'Some Magic', type: 'Magic', color: 'red', cost: 2, magic: { timing: ['MAIN'], effect: 'DRAW', value: 1 } },
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
  const run = (src, actions) => BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions });`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('PK75-04 engine: VOID_TO_TRASH, VOID_TO_CARD eachSpirit / anyNexus / eachNexus, two-colour match', async () => {
  const r = await ev(`const pl = sp('T75-PL'), wb = sp('T75-WB'), rd = sp('T75-RD'), bn = nx('T75-NX'), rn = nx('T75-NR');
    const t0 = P.trashCores.n, r0 = P.reserve.n; await run(rd, [{ do: 'VOID_TO_TRASH', n: 1 }]); const a = [P.trashCores.n - t0, P.reserve.n - r0];
    await run(rd, [{ do: 'VOID_TO_CARD', n: 1, to: 'eachSpirit', match: { family: ['Plant Spirit', 'Winged Beast'] } }]); const b = [pl.cores, wb.cores, rd.cores];
    await run(rd, [{ do: 'VOID_TO_CARD', n: 1, to: 'eachNexus', match: { color: 'blue' } }]); const c = [bn.cores, rn.cores];
    await run(rd, [{ do: 'VOID_TO_CARD', n: 2, to: 'anyNexus', match: { color: 'red' } }]); const d = [bn.cores, rn.cores];
    await run(rd, [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit', match: { color: ['green', 'white'] } }]); const e = pl.cores + wb.cores;
    P.trashCores.n = 0; return [a, b, c, d, e, BS.FX_ACTIONS.VOID_TO_CARD.chk({ n: 1, to: 'self', match: { color: 'red' } })];`);
  assert.deepEqual(r, [[1, 0], [2, 2, 1], [1, 0], [1, 2], 5, false]);
});

test('PK75-05 engine: REVEAL_PICK rest top / either (CPU: bottom), DESTROY exhaustedOnly with no bound', async () => {
  const r = await ev(`const src = sp('T75-RD'); P.deck = [BS.mkInst('T75-RD'), BS.mkInst('T75-PL'), BS.mkInst('T75-WB')]; P.hand = [];
    await run(src, [{ do: 'REVEAL_PICK', n: 1, match: { type: 'Magic' }, rest: 'top' }]); const a = [P.deck[0].id, P.deck.length, P.hand.length];
    await run(src, [{ do: 'REVEAL_PICK', n: 1, match: { type: 'Magic' }, rest: 'either' }]); const b = [P.deck[0].id, P.deck[P.deck.length - 1].id];
    P.deck.unshift(BS.mkInst('T75-MG')); await run(src, [{ do: 'REVEAL_PICK', n: 1, match: { type: 'Magic' }, rest: 'top' }]); const c = [P.hand.map(x => x.id), P.deck.length];
    const big = sp('T75-RD', O, 1), ex = sp('T75-PL', O, 1); big.exhausted = false; ex.exhausted = true; BS.CARDS['T75-PL'].levels[0].bp = 90000;
    const can = BS.FX_ACTIONS.DESTROY.chk({ exhaustedOnly: true });
    await run(src, [{ do: 'DESTROY', exhaustedOnly: true }]); BS.CARDS['T75-PL'].levels[0].bp = 1000;
    return [a, b, c, can, O.spirits.map(x => x.id), BS.FX_ACTIONS.DESTROY.txt({ exhaustedOnly: true, thenDraw: 1 })];`);
  assert.deepEqual(r, [['T75-RD', 3, 0], ['T75-PL', 'T75-RD'], [['T75-MG'], 3], true, ['T75-RD'], 'destroy 1 opposing exhausted Spirit/Ultimate, then draw 1']);
});

test('PK75-06 compiler + engine: "Destroy every / all opposing N BP or less Spirits" = DESTROY all (every candidate at once)', async () => {
  assert.deepEqual(acts(S + 'Destroy all opposing Spirits with 3000BP or less.'), [{ do: 'DESTROY', all: true, bpLe: 3000 }]);
  assert.deepEqual(acts(S + 'Destroy every opposing 2000 BP or less Spirit.'), [{ do: 'DESTROY', all: true, bpLe: 2000 }]);
  assert.deepEqual(acts(S + 'Destroy every opposing Spirit/Ultimate with one core on them.'), [{ do: 'DESTROY', all: true, coresLe: 1 }]);
  for (const t of ['Destroy all opposing Nexuses.', 'Destroy every opposing Spirit with "can\'t be blocked" effects.', 'Destroy all opposing Spirits.'])
    assert.match(String(acts(S + t)), /^REVIEW/, t);
  const r = await ev(`const src = sp('T75-RD'); const a = sp('T75-RD', O, 1), b = sp('T75-PL', O, 1), big = sp('T75-WB', O, 1); BS.CARDS['T75-WB'].levels[0].bp = 9000;
    await run(src, [{ do: 'DESTROY', all: true, bpLe: 3000 }]); BS.CARDS['T75-WB'].levels[0].bp = 1000;
    return [O.spirits.map(x => x.id), BS.FX_ACTIONS.DESTROY.chk({ all: true, nexus: true })];`);
  assert.deepEqual(r, [['T75-WB'], false]);
});
