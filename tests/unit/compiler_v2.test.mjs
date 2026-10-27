// v0.61.0 effect compiler v2 (tools/compile_v2.py, plan docs/ai/compiler-v2-plan.md):
//   gate: every card v1 compiles comes out identical through v2 (v1 is tried first, sentence by sentence);
//   clause grammar: one selector noun phrase shared by destroy / exhaust / return / remove / BP minus / send cores;
//   "Target X. Destroy it." pairs, [LV1-2-3] heads, Rush reminder spellings; unsupported filters stay in review
//   with a "v2 <verb>: ..." reason (the engine-lever table in docs/reports/compile-v2-report.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_v2 as v2, compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
const SP = { id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }, { cores: 5, bp: 7000 }] };
const compile = (text, base = SP) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({}, base, { text })))})
v2.install()
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))
finally: v2.uninstall()`);
const acts = text => { const r = compile(text); return r.review ? r : r.effects[0].actions; };

test('C61-01 gate: v2 output equals v1 output for every card v1 compiles (playable records + staged pool)', () => {
  const r = py(`import glob
cards = json.load(open('build/all-cards.json', encoding='utf8')) + [c for f in sorted(glob.glob('data/import/saga-[0-9][0-9].json')) for c in json.load(open(f, encoding='utf8'))]
same = diff = 0; bad = []
for c in cards:
    try: a = ce.compile_card(c)
    except ce.Review: continue
    v2.install()
    try: b = v2.compile_card(c)
    except ce.Review as e: b = {'review': str(e)}
    finally: v2.uninstall()
    if a == b: same += 1
    else: diff += 1; bad.append(c['id'])
print(json.dumps({'same': same, 'diff': diff, 'bad': bad[:10]}))`);
  assert.equal(r.diff, 0, 'v2 changed v1 output for ' + r.bad.join(', '));
  assert.ok(r.same >= 450, 'v1 recompiles the playable records: ' + r.same);      // 459 of 618 on 2026-10-18 (the rest are hand-authored)
});

test('C61-02 selector grammar maps onto existing actions', () => {
  assert.deepEqual(acts('[LV1] (When Summoned) Destroy an opposing Spirit/Ultimate with 5000 BP or less.'), [{ do: 'DESTROY', bpLe: 5000 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Destroy one opposing Cost 3 or less Spirit/Ultimate.'), [{ do: 'DESTROY', costLe: 3 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Destroy an opposing Spirit with the lowest cost.'), [{ do: 'DESTROY', costRank: 'lowest' }]);
  assert.deepEqual(acts('[LV1] (When Attacks) Return an opposing Cost 4 or less Spirit to the Hand.'), [{ do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', costLe: 4 }]);
  assert.deepEqual(acts('[LV1] (When Attacks) Return an opposing exhausted Spirit/Ultimate to the deckbottom.'), [{ do: 'BOUNCE_OPP', to: 'deckBottom', kind: 'spirit', exhaustedOnly: true }]);
  assert.deepEqual(acts('[LV1] (When Attacks) Exhaust up to two opposing Spirits.'), [{ do: 'EXHAUST_OPP', n: 2 }]);
  assert.deepEqual(acts('[LV1] (When Attacks) Heavily exhaust an opposing Spirit/Ultimate.'), [{ do: 'HEAVY_EXHAUST_OPP', n: 1 }]);
  assert.deepEqual(acts('[LV1] (When Destroyed) Send two cores from an opposing Spirit to their Reserve.'), [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 2 }]);
  assert.deepEqual(acts('[LV1] (When Attacks) During this turn, give an opposing Spirit -3000 BP.'), [{ do: 'BP_MINUS', n: 3000 }]);
});

test('C61-03 target pairs, [LV1-2-3] heads and Rush spellings', () => {
  assert.deepEqual(acts('[LV1] (When Summoned) Target an opposing 4000 BP or less Spirit. Destroy it.'), [{ do: 'DESTROY', bpLe: 4000 }]);
  const r = compile('[LV1-2-3] (When Summoned) Destroy an opposing Cost 2 or less Spirit.');
  assert.deepEqual(r.effects[0].lv, [1, 2, 3]);
  const k = compile('[LV1][LV2] (When Summoned)\nDraw a card.\n{{Rush|White}}\n(While you have White symbols, the following effects activate next.)\n: Return an opposing Cost 4 or less Spirit to the Hand.');
  assert.deepEqual(k.effects[0].actions, [{ do: 'DRAW', n: 1 }, { do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', costLe: 4, if: { hasSymbol: 'white' } }]);
});

test('C61-04 filters the engine lacks stay in review with a lever reason', () => {
  assert.equal(acts('[LV1] (When Summoned) Destroy an opposing refreshed Cost 3 or less Spirit.').review, 'v2 destroy: filter refreshed');      // v0.68: exhausted is supported (exhaustedOnly)
  assert.equal(acts('[LV1] (When Summoned) Destroy two opposing Cost 3 or less Spirits.').review, 'v2 destroy: count 2');
  assert.equal(acts('[LV1] (When Summoned) Exhaust two opposing Spirits.').review, 'v2 exhaust: exactly 2 (engine: up to)');
  assert.equal(acts('[LV1] (When Summoned) Destroy an opposing Spirit.').review, 'v2 destroy: no bound');
  assert.match(acts('[LV1] (When Summoned) Reveal three cards from your decktop.').review, /^(sentence|v2 reveal)/);
});

test('C61-05 the v2 promotion (v0.61.0) is in the card data', () => {
  const r = py(`print(json.dumps({c['id']: c.get('note', '') for c in json.load(open('build/all-cards.json', encoding='utf-8')) if 'compile_v2' in c.get('note', '')}))`);
  for (const id of ['BS22-066', 'BS23-012', 'BS25-039', 'BS26-024', 'BS27-024', 'BS34-011', 'BS36-014', 'BS36-030', 'BS48-090', 'BS59-022']) assert.ok(id in r, id);
});

test('C163-01 own-side "Target X you control. Put a core from the Void to it." and the BP per-count spellings (v0.163.0)', () => {
  assert.deepEqual(acts('[LV1] (When Summoned) Target a "Mineroid" family Spirit you control. Put a core from the Void to it.'),
    [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit', match: { family: ['Mineroid'] } }]);
  assert.deepEqual(acts('[LV2] (When Blocks) Target an "Mineroid" family Nexus you control. Put a core from the Void to it.'),
    [{ do: 'VOID_TO_CARD', n: 1, to: 'anyNexus', match: { family: ['Mineroid'] } }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Target a Spirit with Rumble you control. Put a core from the Void to it.'),
    [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit', match: { keyword: 'Rumble' } }]);
  assert.deepEqual(acts('[LV1] (When Summoned) For each Nexus you control, during this turn, this Spirit gains +1000 BP.'),
    [{ do: 'BP_PLUS', n: 1000, per: { type: 'Nexus' } }]);
  assert.equal(acts('[LV1] (When Summoned) Target another Spirit you control. Put a core from the Void to it.').review !== undefined, true);      // "another" stays in review
});

test('C164-01 one-of-your Void targets, Spirits with a keyword, free summon from Hand/Trash, (Can\'t Stack) head (v0.164.0)', () => {
  assert.deepEqual(acts('[LV1] (When Summoned) Target one of your "Cyantree" family Nexuses. Put a core from the Void to it.'),
    [{ do: 'VOID_TO_CARD', n: 1, to: 'anyNexus', match: { family: ['Cyantree'] } }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Target a Spirit you control. Put a core from the Void to it.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit' }]);
  assert.deepEqual(acts('[LV1] (When Destroyed) Target one of your Spirits with Shamanism. During this turn, give it +3000 BP.'),
    [{ do: 'BP_TARGET', n: 3000, to: 'pick', match: { keyword: 'Shamanism' } }]);
  const s = compile('[LV1] (When Summoned) You can summon a Cost 8 or less "Ogre Wizard" family Spirit card from your Trash, without paying the cost.');
  assert.deepEqual(s.effects[0], { trigger: 'SUMMONED', lv: [1], optional: true, actions: [{ do: 'SUMMON_HAND', match: { family: ['Ogre Wizard'] }, from: 'trash', costLe: 8 }] });
  assert.equal(compile('[LV1] (Can\'t Stack) (When Summoned) Draw a card.').effects[0].noStack, true);
});

test('C165-01 show-and-return-to-deckbottom pairs, "If returned", destroy-if-0-BP order, decktop discard (v0.165.0)', () => {
  assert.deepEqual(acts('[LV1] (When Summoned) Show up to two White "Mineroid" family cards from your Hand to the opponent. Return them to the deckbottom in any order. For each card returned, draw a card.'),
    [{ do: 'SHOW_RETURN', max: 2, match: { family: ['Mineroid'], color: 'white' }, drawEach: true }]);
  const r = compile('[LV1] (When Summoned) You can show a "ZEZTZ" family card from the Hand to the opponent and return it to the deckbottom. If returned, target an opposing exhausted Spirit with two cores or less on it. Destroy it.');
  assert.deepEqual(r.effects[0].actions, [{ do: 'SHOW_RETURN', max: 1, match: { family: ['ZEZTZ'] } }, { do: 'DESTROY', coresLe: 2, exhaustedOnly: true, if: { prev: true } }]);
  assert.equal(r.effects[0].optional, true);
  assert.deepEqual(acts('[LV1] (When Summoned) Target an opposing Spirit. During this turn, give it -2000 BP. Then, destroy it if it has 0 BP.'), acts('[LV1] (When Summoned) Target an opposing Spirit. During this turn, give it -2000 BP. Then, if it has 0 BP, destroy it.'));
  assert.deepEqual(acts('[LV1] (When Summoned) Discard two cards from your decktop.'), [{ do: 'MILL', n: 2 }]);
});

test('C166-01 "(During Attack) If <condition>, this Spirit gains +N BP" and "If your Hand is five or less" (handLe) (v0.166.0)', () => {
  const r = compile('[LV1] (During Attack)\nIf you control any Spirit with Shamanism, this Spirit gains +2000 BP.');
  assert.deepEqual(r.effects[0], { trigger: 'STATIC', bp: 2000, to: 'self', if: { ctrl: { n: 1, type: 'Spirit', keyword: 'Shamanism' } }, attackingOnly: true, lv: [1] });
  assert.deepEqual(acts('[LV1] (When Attacks) If your Hand is five or less, draw a card.'), [{ do: 'DRAW', n: 1, if: { handLe: 5 } }]);
});

test('C167-01 ctrl bpGe / noText / name conditions, "target two instead", "Spirits with <Keyword>" statics, per.keyword, (During Attack) At the end of battle (v0.167.0)', () => {
  assert.deepEqual(acts('[LV1] (When Attacks) Target an opposing 3000 BP or less Spirit. Destroy it. If you control any Spirit with 10000 BP or more, change the targeting BP to 5000 or less instead.'), [
    { do: 'DESTROY', bpLe: 3000, if: { not: { ctrl: { n: 1, type: 'Spirit', bpGe: 10000 } } } },
    { do: 'DESTROY', bpLe: 5000, if: { ctrl: { n: 1, type: 'Spirit', bpGe: 10000 } } }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Target an opposing Cost 3 or less Spirit. Destroy it. If you control any Blue Spirit with no printed effects, the targeting cost becomes 5 or less instead.')[1],
    { do: 'DESTROY', costLe: 5, if: { ctrl: { n: 1, type: 'Spirit', noText: true, colors: ['blue'] } } });
  const two = acts('[LV1] (When Summoned) Target an opposing 5000 BP or less Spirit. Destroy it. If you control any exhausted "Kamen Rider Gaim", target two instead.');
  assert.equal(two.length, 3);      // one run without the condition, two with it
  assert.deepEqual(two[1].if, { ctrl: { n: 1, type: 'Spirit', name: 'Kamen Rider Gaim', exhausted: true } });
  assert.deepEqual(compile('[LV1] (Your Attack Step) All your Spirits with Shamanism gain +1000 BP.').effects[0].match, { keyword: 'Shamanism' });
  assert.deepEqual(compile('[LV1] (During Attack) For each Spirit with Legacy you control, this Spirit gains +2000 BP.').effects[0].per, { type: 'Spirit', keyword: 'Legacy' });
  assert.deepEqual(acts('[LV2] (During Attack) At the end of battle, if your Hand is five or less, draw a card.'), [{ do: 'END_BATTLE', then: [{ do: 'DRAW', n: 1, if: { handLe: 5 } }] }]);
});

test('C168-01 symbolsOnGe, Cost A/B and non-attacking selectors, blocking-this-Spirit, fightingOnly static, Trash returns by colour / cost / keyword, Cost 6/8 refresh, another X family (v0.168.0)', () => {
  assert.deepEqual(compile('[LV2] (During Block) If you have three or more White symbols, this Spirit gains +5000 BP.').effects,
    [{ trigger: 'STATIC', bp: 5000, to: 'self', if: { symbolsOnGe: { color: 'white', n: 3 } }, blockingOnly: true, lv: [2] }]);
  assert.deepEqual(acts('[LV1] (When Destroyed) Target an opposing Cost 1/2 exhausted Spirit. Destroy it.'), [{ do: 'DESTROY', costIn: [1, 2], exhaustedOnly: true }]);
  assert.deepEqual(acts('[LV1] (When Blocks) Target an opposing non-attacking 2000 BP or less Spirit. Return it to the deckbottom.'), [{ do: 'BOUNCE_OPP', to: 'deckBottom', kind: 'spirit', bpLe: 2000, notAttacking: true }]);
  assert.deepEqual(acts('[LV2] (When Destroyed) Target an opposing Cost 6 or less Spirit that is blocking this Spirit. Destroy it.'), [{ do: 'DESTROY', costLe: 6, blockingSelf: true }]);
  assert.deepEqual(compile("[LV1][LV2] (Either Attack Step) (Can't Stack)\nAll your attacking/blocking Spirits with Level Up gain +2000 BP.").effects,
    [{ trigger: 'STATIC', bp: 2000, to: 'own', fightingOnly: true, if: { attackStep: true }, match: { keyword: 'Level Up' }, noStack: true, lv: [1, 2] }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Target a Cost 5 or less Red Spirit card in your Trash. Return it to the Hand.'), [{ do: 'RETURN_TRASH', match: { costLe: 5, color: 'red' } }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Target a Spirit card with Clash in your Trash. Return it to the Hand.'), [{ do: 'RETURN_TRASH', match: { keyword: 'Clash' } }]);
  assert.deepEqual(acts('[LV1] (When Summoned) You can target one of your Cost 6/8 Spirits with the "Topaz" family. Refresh it.'), [{ do: 'REFRESH_SPIRIT', match: { family: ['Topaz'], costIn: [6, 8] } }]);
  assert.deepEqual(acts('[LV2] (When Attacks) If you control any "GAIM" family Spirit, besides this Spirit, draw a card.'), [{ do: 'DRAW', n: 1, if: { ctrl: { n: 1, type: 'Spirit', family: 'GAIM', other: true } } }]);
});
