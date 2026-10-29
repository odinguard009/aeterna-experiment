// v0.69.0 "Reveal N cards from your decktop. Among them, add / deploy <card>. Return / Discard any remaining cards." (Standard wording, 26 block A cards).
// The engine actions REVEAL_PICK / REVEAL_DEPLOY existed for hand-written cards; v0.69 adds the compiler pattern (three sentences = one effect),
// the match key costLe ("Cost N or less") and the action flag diffName ("a card name different from this Spirit's").
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const fx = text => py(`c = json.loads(${JSON.stringify(JSON.stringify({ id: 'T-1', name: 'T', type: 'Spirit', color: 'green', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 2, bp: 5000 }], text: '[LV1][LV2] (When Summoned)\n' + text }))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);
const act = text => { const c = fx(text); return c.review ? c : { optional: !!c.effects[0].optional, a: c.effects[0].actions, n: c.effects.length, complete: c.fxComplete }; };

test('R69-01 compiler: add a family / type / colour card, rest to the bottom (any order) or discarded', () => {
  let r = act('You can reveal three cards from your decktop. Among them, add a "Ferobeast" family Nexus card to the Hand. Return any remaining cards to the deckbottom in any order.');
  assert.deepEqual(r, { optional: true, n: 1, complete: true, a: [{ do: 'REVEAL_PICK', n: 3, match: { family: ['Ferobeast'], type: 'Nexus' }, rest: 'bottom' }] });
  r = act('Reveal three cards from your decktop. Among them, add a "Windfang" family card to the Hand. Discard any remaining cards.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_PICK', n: 3, match: { family: ['Windfang'] }, rest: 'trash' }]); assert.equal(r.optional, false);
  r = act('You can reveal three cards from your decktop. Among them, add a Blue "Ambulantree" family Nexus card to the Hand. Return any remaining cards to the deckbottom in any order.');
  assert.deepEqual(r.a[0].match, { family: ['Ambulantree'], type: 'Nexus', color: 'blue' });
  r = act('Reveal three cards from your decktop. Among them, add a "Wailwraith"/"Hexcraft" family card to the Hand. Return any remaining cards to the deckbottom.');
  assert.deepEqual(r.a[0].match, { family: ['Wailwraith', 'Hexcraft'] });
  r = act('You can reveal three cards from your decktop. Among them, add a "Thunder Dragon" family Magic card to the Hand. Return any remaining cards to the deckbottom in any order.');
  assert.deepEqual(r.a[0].match, { family: ['Thunder Dragon'], type: 'Magic' });
});
test('R69-02 compiler: Cost N or less, "among them" after the card, a name different from this Spirit\'s', () => {
  let r = act('Reveal three cards from your decktop. Add a Cost 6 or less "GAIM" family card among them to the Hand. Return any remaining cards to the deckbottom in any order.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_PICK', n: 3, match: { family: ['GAIM'], costLe: 6 }, rest: 'bottom' }]);
  r = act('Reveal three cards from your decktop. Among them, add a "RYUKI" family Spirit card with a name different to this Spirit\'s to the Hand. Return any remaining cards to the deckbottom in any order.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_PICK', n: 3, match: { family: ['RYUKI'], type: 'Spirit' }, rest: 'bottom', diffName: true }]);
  r = act('You can reveal three cards from your decktop. Among them, add a "Venabeast"/"Sylvareign" family Spirit card with a card name different from this Spirit\'s to the Hand. Return any remaining cards to the deckbottom.');
  assert.deepEqual(r.a[0], { do: 'REVEAL_PICK', n: 3, match: { family: ['Venabeast', 'Sylvareign'], type: 'Spirit' }, rest: 'bottom', diffName: true });
});
test('R69-03 compiler: summon/deploy pays its cost, "without paying the cost" does not', () => {
  let r = act('You can reveal three cards from your decktop. Among them, you can summon/deploy a Cost 3 or less "Armored Fish" family card. Return any remaining cards to the deckbottom in any order.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_DEPLOY', n: 3, match: { family: ['Armored Fish'], costLe: 3 }, pay: true }]); assert.equal(r.optional, true);
  r = act('Reveal three cards from your decktop. Among them, deploy a "Ferobeast" family Nexus card, without paying the cost. Return any remaining cards to the deckbottom in any order.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_DEPLOY', n: 3, match: { family: ['Ferobeast'], type: 'Nexus' }, pay: false }]);
});
test('R184-01 compiler: "summon X among them" with "Discard the remaining cards" gives REVEAL_DEPLOY rest trash', () => {
  const r = act('Reveal four cards from your decktop. Summon a "Galaxian" family Spirit card among them, without paying the cost. Discard the remaining cards.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_DEPLOY', n: 4, match: { family: ['Galaxian'], type: 'Spirit' }, pay: false, rest: 'trash' }]);
});
test('R184-02 compiler: one revealed card, "if it is X, you can summon it" = REVEAL_DEPLOY n 1 with the rest clause (trash / decktop)', () => {
  let r = act('Reveal a card from your decktop. If that card is a Cost 3 or less Spirit card, you can summon it without paying the cost. If you don\'t summon it, or it\'s a different card, discard it.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_DEPLOY', n: 1, match: { type: 'Spirit', costLe: 3 }, pay: false, rest: 'trash' }]);
  r = act('You can reveal a card from your decktop. If that card is a Green Spirit card, you can summon it. If you\'re not summoning it, or it\'s some other card, return it to the decktop.');
  assert.deepEqual(r.a, [{ do: 'REVEAL_DEPLOY', n: 1, match: { type: 'Spirit', color: 'green' }, pay: true, rest: 'top' }]);
});
test('R69-05 compiler (v0.184): team, Cost N or more and with <Keyword> card phrases', () => {
  const m = t => act('Reveal three cards from your decktop. Among them, add ' + t + ' to the Hand. Return any remaining cards to the deckbottom in any order.').a[0].match;
  assert.deepEqual(m('a Red Stella Spirit card'), { type: 'Spirit', team: 'Red Stella' });
  assert.deepEqual(m('a Cost 3 or less Green Wave card'), { costLe: 3, team: 'Green Wave' });
  assert.deepEqual(m('a Cost 6 or more "GAIM" family card'), { family: ['GAIM'], costGe: 6 });
  assert.deepEqual(m('a Spirit card with Amplify'), { type: 'Spirit', keyword: 'Amplify' });
  assert.deepEqual(m('a Blue Spirit card with no printed effects'), { type: 'Spirit', color: 'blue', noText: true });      // v0.185
});
test('R69-04 compiler: forms the engine match cannot say stay in review (keyword holder, two kinds, every card, discard-a-card, the reveal is only the first sentence group)', () => {
  const bad = [
    'Reveal three cards from your decktop. Among them, add a Spirit card with Mirage to your Hand. Return any remaining cards to the deckbottom in any order.',
    'You can reveal three cards from your decktop. Among them, add a "Wollaguard" family Spirit card/Nexus card with a name different from this Spirit\'s to the Hand. Return any remaining cards to the deckbottom in any order.',
    'You can reveal three cards from your decktop. Among them, add every "Cyantree" family Nexus card to the Hand. Return any remaining cards to the deckbottom in any order.',
    'Reveal three cards from your decktop. Discard a Purple card among them. Return any remaining cards to the deckbottom.',
  ];
  for (const t of bad) assert.ok(act(t).review, t);
  const two = act('Reveal three cards from your decktop. Among them, add a "Windfang" family card to the Hand. Return any remaining cards to the deckbottom in any order. Draw a card.');
  assert.deepEqual(two.a.map(a => a.do), ['REVEAL_PICK', 'DRAW'], JSON.stringify(two));      // a sentence after the reveal is a second action, not part of it
});

let g;
const FIX = [
  { id: 'T69R-SRC', name: 'T69R-SRC', type: 'Spirit', color: 'green', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }], families: ['Venabeast'],
    effects: [{ trigger: 'SUMMONED', actions: [{ do: 'REVEAL_PICK', n: 3, match: { family: ['Venabeast'], type: 'Spirit', costLe: 4 }, rest: 'bottom', diffName: true }] }], fxComplete: true, text: '[LV1] (When Summoned) reveal.' },
  { id: 'T69R-DEP', name: 'T69R-DEP', type: 'Spirit', color: 'green', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }], families: ['Venabeast'],
    effects: [{ trigger: 'SUMMONED', actions: [{ do: 'REVEAL_DEPLOY', n: 3, match: { family: ['Venabeast'], costLe: 3 }, pay: true, diffName: true }] }], fxComplete: true, text: '[LV1] (When Summoned) reveal.' },
  { id: 'T69R-A', name: 'T69R-A', type: 'Spirit', color: 'green', cost: 4, symbols: 1, families: ['Venabeast'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'T69R-B', name: 'T69R-B', type: 'Spirit', color: 'green', cost: 6, symbols: 1, families: ['Venabeast'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'T69R-C', name: 'T69R-C', type: 'Spirit', color: 'green', cost: 2, symbols: 1, families: ['Venabeast'], levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T69R-X', name: 'T69R-X', type: 'Spirit', color: 'red', cost: 1, symbols: 1, families: ['Other'], levels: [{ cores: 1, bp: 1000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 5;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.burst = null; q.trash = []; q.removed = []; q.hand = []; q.revealed = []; }
  P.reserve.n = 10; P.reserve.soul = false;
  const mk = (id, zone) => { const i = BS.mkInst(id); P[zone].push(i); return i; };
  const deckOf = ids => { P.deck = ids.map(id => BS.mkInst(id)); };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('R69-05 engine: costLe is a match key; diffName skips a card with the source name; the rest returns to the bottom', async () => {
  const r = await ev(`deckOf(['T69R-SRC', 'T69R-B', 'T69R-A', 'T69R-X', 'T69R-C']);
    const src = mk('T69R-SRC', 'hand'); await BS.summonFree(P, src);
    return [P.hand.map(h => h.id), P.deck.map(d => d.id), BS.fxMatch ? 1 : 0];`);
  // top three: SRC (same name: skipped), B (cost 6 > 4: skipped), A (ok) -> A is added; SRC and B return to the bottom
  assert.deepEqual(r[0], ['T69R-A']);
  assert.deepEqual(r[1], ['T69R-X', 'T69R-C', 'T69R-SRC', 'T69R-B']);
});
test('R69-06 engine: nothing matches -> nothing is added, every revealed card returns to the bottom', async () => {
  const r = await ev(`deckOf(['T69R-SRC', 'T69R-B', 'T69R-X', 'T69R-A']);
    const src = mk('T69R-SRC', 'hand'); await BS.summonFree(P, src);
    return [P.hand.length, P.deck.map(d => d.id), P.revealed.length];`);
  assert.deepEqual(r, [0, ['T69R-A', 'T69R-SRC', 'T69R-B', 'T69R-X'], 0]);
});
test('R69-07 engine: REVEAL_DEPLOY with pay and costLe: a matching card of another name is summoned for its cost', async () => {
  const r = await ev(`deckOf(['T69R-DEP', 'T69R-B', 'T69R-C', 'T69R-X']);
    const src = mk('T69R-DEP', 'hand'); await BS.summonFree(P, src); const before = P.reserve.n;
    return [BS.fieldList(P).map(f => f.id).sort(), P.deck.map(d => d.id), before - P.reserve.n];`);
  assert.deepEqual(r[0], ['T69R-C', 'T69R-DEP']);
  assert.deepEqual(r[1], ['T69R-X', 'T69R-DEP', 'T69R-B']);
});
test('R69-08 parse: diffName must be true; costLe is accepted in a reveal match', async () => {
  const r = await g.page.evaluate(() => { const f = a => !!BS.parseActionList([a]).error;
    return [f({ do: 'REVEAL_PICK', n: 3, match: { family: ['A'], costLe: 4 }, rest: 'bottom' }), f({ do: 'REVEAL_PICK', n: 3, match: { family: ['A'] }, rest: 'bottom', diffName: 'x' }), f({ do: 'REVEAL_PICK', n: 3, match: { costLe: 4 }, rest: 'bottom', diffName: true })]; });
  assert.deepEqual(r, [false, true, false]);
});
