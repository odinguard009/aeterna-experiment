// v0.71.0 Burst forms (plan W pack "Burst forms"; Fandom Burst page + Comprehensive Rules / Categories of Effects
// "Burst Activation"; docs/mechanics/burst-forms.md): the Burst paragraph may stand anywhere in the text, export spelling
// variants of the four known conditions, two new conditions (OPP_ATTACK "After an opposing Spirit attacks",
// OPP_SUMMON_ADV_FX "(When Summoned/Advents)"), condition clauses in front of an action (burstSet, oppBurstSet, ctrl,
// controlName, counterGe) and the "while you have a Burst set" Hand cost (costAlt).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);
const magic = text => compile(text, { type: 'Magic', levels: undefined });

test('B71-01 compiler: the Burst paragraph after the Main/Flash text, condition spellings, the older "☼[ Burst: ... ]" form', () => {
  const a = magic('Flash\nDraw a card.\n\n{{Burst|After an opposing Spirit attacks}}\nDuring this turn, all your Spirits gain +3000 BP. Then, by paying the cost, activate this card\'s Flash effect.');
  assert.deepEqual(a.burst, { when: 'OPP_ATTACK', actions: [{ do: 'BP_PLUS', n: 3000, to: 'own' }], noUlt: true, thenFlash: true }, JSON.stringify(a));
  assert.deepEqual(a.magic, { timing: ['FLASH'], effect: 'DRAW', value: 1 });
  assert.equal(magic('{{Burst|After an opposing Spirit/Ultimate attacks}}\nDraw a card.\n\nFlash\nDraw a card.').burst.noUlt, undefined, 'Spirit/Ultimate = no noUlt');
  const w = t => magic('{{Burst|' + t + '}}\nDraw a card.\n\nMain\nDraw a card.').burst.when;
  assert.equal(w("After an oppposing Spirit/Brave's (When Summoned) effect resolves"), 'OPP_SUMMON_FX');
  assert.equal(w("After an opposing Spirit/Ultimate's (When Summoned/Advents) effect resolves"), 'OPP_SUMMON_ADV_FX');
  assert.equal(w('After your Spirit/Ultimate is destroyed by the opponent'), 'ALLY_DESTROYED');
  assert.equal(w('After the opposing Hand increases via opposing effects'), 'OPP_HAND_UP');
  assert.equal(w('After your Life is reeduced'), 'LIFE_DECREASE');
  assert.match(magic('{{Burst|After your Spirit is depleted by the opponent}}\nDraw a card.\n\nMain\nDraw a card.').review, /^Burst condition/, 'depletion by the opponent is not tracked: review');
  const o = magic('☼[ Burst: After Your Life is Decreased ]\n Draw a card. Then, by paying the cost, activate the Main effect of this card.\n\nMain - Draw a card.');
  assert.deepEqual([o.burst && o.burst.when, o.burst && o.burst.thenMain], ['LIFE_DECREASE', true], JSON.stringify(o));
});

test('B71-02 compiler: condition clauses become the action "if"; "instead" and other Burst sentences stay in review', () => {
  const a = compile('[LV1][LV2] (When Summoned)\nIf you have a Burst set, put a core from the Void to this Spirit.');
  assert.deepEqual(a.effects[0].actions, [{ do: 'VOID_TO_CARD', n: 1, to: 'self', if: { burstSet: true } }]);
  const b = compile('[LV1][LV2] (When Attacks)\nDraw a card. If you control any Purple Ultimate, also, draw a card.');
  assert.deepEqual(b.effects[0].actions[1], { do: 'DRAW', n: 1, if: { ctrl: { n: 1, type: 'Ultimate', colors: ['purple'] } } });
  assert.deepEqual(compile('[LV1] (When Destroyed)\nIf you control any "Purgatory Wings" family Spirit, draw a card.').effects[0].actions[0].if, { ctrl: { n: 1, type: 'Spirit', family: 'Purgatory Wings' } });
  assert.deepEqual(compile('[LV1] (When Summoned) When you have a Burst set, destroy an opposing 3000 BP or less Spirit.').effects[0].actions[0].if, { burstSet: true });
  assert.deepEqual(compile('[LV1] (When Summoned)\nIf you have three counters or more, draw two cards.').effects[0].actions[0].if, { counterGe: 3 });
  assert.deepEqual(compile("[LV1] (When Summoned)\nIf the opponent doesn't have a Burst set, draw a card.").effects[0].actions[0].if, { oppBurstSet: false });
  assert.match(compile('[LV1] (When Attacks)\nDraw a card. If the opponent has two or more Spirits, instead, draw two cards.').review, /^sentence/);
  assert.match(compile('[LV1] (When Attacks)\nDiscard an opposing Burst.').review, /^Burst sentence/);
});

test('B71-03 compiler: (step window) "While you have a set Burst" and the Burst Hand cost', () => {
  const s = compile('[LV2] (Your Attack Step) While you have a set Burst, this Spirit gains +4000 BP.');
  assert.deepEqual(s.effects, [{ trigger: 'STATIC', bp: 4000, to: 'self', lv: [2], if: { step: 'ATTACK', oppTurn: false, burstSet: true } }]);
  const t = 'While you have a Burst set, this Spirit card in Hand becomes Cost 7.\n\n[LV1][LV2] (When Attacks)\nDraw a card.';
  const c = compile(t);
  assert.deepEqual([c.costAlt, c.text, c.effects.length], [{ cost: 7, if: { burstSet: true } }, t, 1], JSON.stringify(c));
});

let g;
const FIX = [
  { id: 'T71-ATK', name: 'Burst Attacker', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T71-BA', name: 'Burst After Attack', type: 'Magic', color: 'red', cost: 3, burst: { when: 'OPP_ATTACK', actions: [{ do: 'COUNTER', n: 5 }] } },
  { id: 'T71-BV', name: 'Burst Summon Advent', type: 'Magic', color: 'red', cost: 3, burst: { when: 'OPP_SUMMON_ADV_FX', actions: [{ do: 'COUNTER', n: 2 }] } },
  { id: 'T71-BS', name: 'Burst Summon', type: 'Magic', color: 'red', cost: 3, burst: { when: 'OPP_SUMMON_FX', actions: [{ do: 'COUNTER', n: 2 }] } },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const bu = (id, q = P) => { const i = BS.mkInst(id); q.burst = i; return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('B71-04 engine: the OPP_ATTACK Burst activates after an opposing Spirit attacks; noUlt only with OPP_ATTACK', async () => {
  const r = await ev(`G.step = 5; const a = sp('T71-ATK'); bu('T71-BA', O); window.cpuChooseBlock = () => null;
    await BS.doBattle('player', a); return [O.count, O.burst, O.trash.map(t => t.id)];`);
  assert.deepEqual(r, [5, null, ['T71-BA']]);
  const p = await ev(`return [BS.parseBurst({ when: 'OPP_ATTACK', noUlt: true, actions: [{ do: 'DRAW', n: 1 }] }).burst.noUlt, BS.parseBurst({ when: 'LIFE_DECREASE', noUlt: true, actions: [{ do: 'DRAW', n: 1 }] }).error || ''];`);
  assert.equal(p[0], true);
  assert.match(p[1], /noUlt/);
});

test('B71-05 engine: conditions burstSet / oppBurstSet / ctrl; a (When Summoned/Advents) Burst also answers an Advent', async () => {
  const r = await ev(`const before = [BS.fxIf(P, O, { burstSet: true }), BS.fxIf(P, O, { burstSet: false }), BS.fxIf(O, P, { oppBurstSet: true })];
    bu('T71-BA'); const m = BS.mkInst('T71-BA'); m.mirage = true; O.burst = m;
    const after = [BS.fxIf(P, O, { burstSet: true }), BS.fxIf(O, P, { oppBurstSet: true }), BS.fxIf(O, P, { burstSet: true })];   // O's set card is a Mirage, not a Burst
    sp('T71-ATK'); const ctrl = [BS.fxIf(P, O, { ctrl: { n: 1, type: 'Spirit', colors: ['red'] } }), BS.fxIf(P, O, { ctrl: { n: 1, type: 'Ultimate' } })];
    const parse = [BS.parseActionList([{ do: 'DRAW', n: 1, if: { ctrl: { n: 1, type: 'Ultimate' }, burstSet: true } }]).error || 'ok', BS.parseActionList([{ do: 'DRAW', n: 1, if: { ctrl: { type: 'Nexus' } } }]).error ? 'err' : 'ok'];
    bu('T71-BV', O); const adv = await BS.maybeBurst(O, 'OPP_ADVENT_FX', {}); bu('T71-BS', O); const plain = await BS.maybeBurst(O, 'OPP_ADVENT_FX', {});
    const plain2 = await BS.maybeBurst(O, 'OPP_SUMMON_FX', {});
    return [before, after, ctrl, parse, adv, plain, plain2, O.count];`);
  assert.deepEqual(r, [[false, true, false], [true, true, false], [true, false], ['ok', 'err'], true, false, true, 4]);
});
