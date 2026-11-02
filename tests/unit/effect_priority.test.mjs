// v0.58.0 rules audit R3 item 2 + session E: effect priority and "unaffected".
// Sources: JP 17.0 revision notice item 9 (priority "cannot" > "must" > "do" = "can"); Eternal manual FAQ About Effects Q3
// ("cannot" > "must" > "may"; immunity order "cannot be prevented" > "unaffected" > "cannot activate");
// printed keyword text (Fandom export): Armor = "unaffected by opposing <colour> Spirit/Nexus/Magic effects",
// Heavy Armor = "... Spirit/Brave/Nexus/Magic effects", Ultra Armor = "... Spirit/Ultimate/Nexus/Magic effects".
// rules: ETR:faq.effects-q3@a8b10c85
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const card = (text, extra = {}) => JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra));
const compile = (text, extra) => py(`c = json.loads(${JSON.stringify(card(text, extra))})\ntry: print(json.dumps(ce.compile_card(c)))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);
const HA = ['Spirit', 'Brave', 'Nexus', 'Magic'], UA = ['Spirit', 'Ultimate', 'Nexus', 'Magic'], AR = ['Spirit', 'Nexus', 'Magic'];
const MAGIC = { type: 'Magic', levels: [] };

test('A58-01 Heavy Armor / Ultra Armor templates compile to a STATIC UNAFFECTED effect with the colours and card types', () => {
  assert.deepEqual(compile('[LV1][LV2] {{ha|Purple/Green}} This Spirit is unaffected by opposing Purple/Green Spirit/Brave/Nexus/Magic effects.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', lv: [1, 2], from: { colors: ['purple', 'green'], types: HA } }]);
  assert.deepEqual(compile('[LV2] {{ua|White}} This Spirit is unaffected by opposing White Spirit/Ultimate/Nexus/Magic effects.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', lv: [2], from: { colors: ['white'], types: UA } }]);
  assert.deepEqual(compile('{{uha|Blue}} This Spirit is unaffected by opposing Blue effects.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', from: { colors: ['blue'] } }]);
});
test('A58-02 Armor template and written keyword lines ("Armor : Red - ... of the stated color", "Heavy Armor: White - ...")', () => {
  assert.deepEqual(compile('[LV1][LV2] {{Armor|Red}}\nThis Spirit is unaffected by opposing Spirit/Nexus/Magic effects of the specified color.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', lv: [1, 2], from: { colors: ['red'], types: AR } }]);
  assert.deepEqual(compile('[LV1] Armor : Red/Purple - This Spirit is unaffected by opposing Spirit/Nexus/Magic effects of the stated colors.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', lv: [1], from: { colors: ['red', 'purple'], types: AR } }]);
  assert.deepEqual(compile('[LV1] Heavy Armor: White - This Spirit is unaffected by opposing White Spirit/Brave/Nexus/Magic effects.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', lv: [1], from: { colors: ['white'], types: HA } }]);
  assert.match(compile('[LV1] {{ha|White}} This Spirit is unaffected by opposing Red Spirit/Brave/Nexus/Magic effects.').review, /Armor colours/);
});
test('A58-03 plain "unaffected by opposing ... effects" for this Spirit and for your family Spirits', () => {
  assert.deepEqual(compile('[LV1][LV2] This Spirit is unaffected by opposing Nexus effects.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', lv: [1, 2], from: { types: ['Nexus'] } }]);
  assert.deepEqual(compile('[LV2] This Spirit is unaffected by opposing effects.').effects, [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', lv: [2] }]);
  assert.deepEqual(compile('[LV1][LV2] All your "Dragon" family Spirits are unaffected by opposing Spirit/Magic effects.').effects,
    [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'own', lv: [1, 2], match: { family: ['Dragon'] }, from: { types: ['Spirit', 'Magic'] } }]);
  assert.match(compile('[LV1] This exhausted Spirit is unaffected by opposing Spirit/Brave effects.').review, /no trigger|keyword/);
});
test('A58-04b "Your Hand is unaffected by opposing effects" = STATIC HAND_UNAFFECTED on this card', () => {
  assert.deepEqual(compile('[LV2] Your Hand is unaffected by opposing effects.').effects, [{ trigger: 'STATIC', flag: 'HAND_UNAFFECTED', to: 'self', lv: [2] }]);
});
test('A58-04 "this card in Hand/Trash is unaffected" become card flags (Spirit and Magic)', () => {
  const m = compile('Flash Draw a card.\n\nThis card in Hand is unaffected by opposing effects.', MAGIC);
  assert.equal(m.handUnaffected, true); assert.deepEqual([m.magic.effect, m.magic.value], ['DRAW', 1]);
  assert.equal(compile('Main Draw a card.\n\nThis Magic card in Trash is unaffected by any effect.', MAGIC).trashUnaffected, true);
  assert.equal(compile('Main Draw a card.\n\nThis card in Trash is unaffected by all effects.', MAGIC).trashUnaffected, true);
  assert.equal(compile('[LV1] (When Summoned) Draw a card.\n\nThis card in Trash is unaffected by any effects.').trashUnaffected, true);
});

let g;
const S = (id, color, extra = {}) => Object.assign({ id, name: id, type: 'Spirit', color, cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }] }, extra);
const FIX = [
  S('T58-HA', 'white', { effects: [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', from: { colors: ['purple'], types: HA } }] }),
  S('T58-AR', 'white', { effects: [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self', from: { colors: ['purple'], types: AR } }] }),
  S('T58-ALL', 'white', { effects: [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'self' }] }),
  S('T58-FAM', 'white', { families: ['Guard'], effects: [{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'own', match: { family: ['Guard'] }, from: { types: ['Spirit'] } }] }),
  S('T58-PLAIN', 'red'),
  S('T58-PDES', 'purple', { effects: [{ trigger: 'SUMMONED', actions: [{ do: 'DESTROY', bpLe: 10000 }] }] }),
  S('T58-RDES', 'red', { effects: [{ trigger: 'SUMMONED', actions: [{ do: 'DESTROY', bpLe: 10000 }] }] }),
  S('T58-PFORCE', 'purple', { effects: [{ trigger: 'SUMMONED', actions: [{ do: 'DESTROY', coresLe: 3, ignoreImmune: true }] }] }),
  { id: 'T58-PBRV', name: 'T58-PBRV', type: 'Brave', color: 'purple', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'SUMMONED', actions: [{ do: 'DESTROY', bpLe: 10000 }] }] },
  S('T58-MUST', 'purple', { levels: [{ cores: 1, bp: 9000 }], effects: [{ trigger: 'STATIC', flag: 'MUST_BLOCK', to: 'self' }] }),
  { id: 'T58-PMAG', name: 'T58-PMAG', type: 'Magic', color: 'purple', cost: 1, symbols: 0, magic: { timing: ['MAIN'], effect: 'ACTIONS', actions: [{ do: 'DESTROY', bpLe: 10000 }] } },
  S('T58-HAND', 'blue', { levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], effects: [{ trigger: 'STATIC', flag: 'HAND_UNAFFECTED', to: 'self', lv: [2] }] }),
  S('T58-DISC', 'purple', { effects: [{ trigger: 'SUMMONED', actions: [{ do: 'REMOVE_OPP_HAND', n: 1 }] }] }),
  { id: 'T58-TRASH', name: 'T58-TRASH', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], trashUnaffected: true },
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
  const block = b => { window.cpuChooseBlock = () => b; };
  const C = (q, src) => ({ p: q, opp: q === P ? O : P, src, ctx: {} });`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('A58-05 parse: STATIC UNAFFECTED with "from" colours/types; bad values are rejected', async () => {
  const r = await ev(`const ok = BS.parseEffects([{ trigger: 'STATIC', flag: 'UNAFFECTED', to: 'own', match: { family: ['X'] }, from: { colors: ['red'], types: ['Magic'] } }]);
    const bad = [BS.parseEffects([{ trigger: 'STATIC', flag: 'UNAFFECTED', from: { colors: ['pink'] } }]).error, BS.parseEffects([{ trigger: 'STATIC', flag: 'UNAFFECTED', from: { types: ['Token'] } }]).error];
    return [ok.error || null, ok.effects[0].from, bad.map(b => !!b)];`);
  assert.deepEqual(r, [null, { colors: ['red'], types: ['Magic'] }, [true, true]]);
});
test('A58-06 Heavy Armor: Purple blocks opposing Purple effects only; the opponent of the armored card is the one restricted', async () => {
  const r = await ev(`const ha = sp('T58-HA', O), pl = sp('T58-PLAIN', O);
    const pd = BS.mkInst('T58-PDES'), rd = BS.mkInst('T58-RDES');
    const purple = BS.FX_ACTIONS.DESTROY.cands(C(P, pd), { do: 'DESTROY', bpLe: 10000 }).map(x => x.id);
    const red = BS.FX_ACTIONS.DESTROY.cands(C(P, rd), { do: 'DESTROY', bpLe: 10000 }).map(x => x.id);
    const own = BS.fxImmune(O, ha, C(O, BS.mkInst('T58-PDES')));
    pd.cores = 1; P.spirits.push(pd); await BS.fireFx(P, 'SUMMONED', pd, {});
    return [purple, red, own, O.spirits.map(x => x.id)];`);
  assert.deepEqual(r, [['T58-PLAIN'], ['T58-HA', 'T58-PLAIN'], false, ['T58-HA']]);
});
test('A58-07 card types: Armor (Spirit/Nexus/Magic) does not cover a Brave effect, Heavy Armor does; "unaffected by opposing effects" covers all', async () => {
  const r = await ev(`const ha = sp('T58-HA', O), ar = sp('T58-AR', O), all = sp('T58-ALL', O);
    const brv = BS.mkInst('T58-PBRV'), mag = BS.mkInst('T58-PMAG');
    return [[ha, ar, all].map(t => BS.fxImmune(O, t, C(P, brv))), [ha, ar, all].map(t => BS.fxImmune(O, t, C(P, mag)))];`);
  assert.deepEqual(r, [[true, false, true], [true, true, true]]);
});
test('A58-08 family-wide "your Guard Spirits are unaffected by opposing Spirit effects" protects every matching Spirit, not Magic', async () => {
  const r = await ev(`const f = sp('T58-FAM', O), pl = sp('T58-PLAIN', O); const s = BS.mkInst('T58-RDES'), m = BS.mkInst('T58-PMAG');
    return [BS.fxImmune(O, f, C(P, s)), BS.fxImmune(O, pl, C(P, s)), BS.fxImmune(O, f, C(P, m))];`);
  assert.deepEqual(r, [true, false, false]);
});
test('A58-09 Magic: an armored Spirit is no target of an opposing Purple Magic (ACTIONS) cast', async () => {
  const r = await ev(`const ha = sp('T58-HA', O); P.reserve.n = 5; const m = BS.mkInst('T58-PMAG'); P.hand.push(m);
    const usable = BS.magicUsable(P, m, 'main'); sp('T58-PLAIN', O);
    await BS.castMagic(P, { inst: m, plan: null, ctx: 'main' }); return [usable, O.spirits.map(x => x.id)];`);
  assert.deepEqual(r, [false, ['T58-HA']]);
});
// rules: ETR:faq.effects-q4@dd096f71
test('A58-10 priority "cannot be prevented" > "unaffected": ignoreImmune reaches the armored Spirit (FAQ Q3)', async () => {
  const r = await ev(`sp('T58-HA', O); const f = BS.mkInst('T58-PFORCE'); f.cores = 1; P.spirits.push(f); await BS.fireFx(P, 'SUMMONED', f, {}); return O.spirits.length;`);
  assert.equal(r, 0);
});
test('A58-11 priority "cannot" > "must" (JP 17.0 item 9): a must-block attacker is not blocked by a Spirit that can\'t block or is unaffected', async () => {
  const r = await ev(`const a = sp('T58-MUST'); const b = sp('T58-PLAIN', O); b.noAB = true; block(null); await BS.doBattle('player', a);
    const lifeA = O.life; b.noAB = false; O.spirits = []; a.exhausted = false;
    const h = sp('T58-HA', O); block(null); await BS.doBattle('player', a); const lifeB = O.life, hEx = h.exhausted;
    O.spirits = []; a.exhausted = false; const p = sp('T58-PLAIN', O); block(null); await BS.doBattle('player', a);
    return [lifeA, lifeB, hEx, p.exhausted || !O.spirits.includes(p)];`);
  const [lifeA, lifeB, hEx, forced] = r;
  assert.equal(lifeB, lifeA - 1, 'unaffected Spirit is not forced: the attack hits Life');
  assert.equal(hEx, false); assert.equal(forced, true, 'a normal Spirit still must block');
});
test('A58-12 "this card in Trash is unaffected by any effects": Trash returns skip it; symbol-zero skips an unaffected Spirit', async () => {
  const r = await ev(`const t = BS.mkInst('T58-TRASH'), n = BS.mkInst('T58-PLAIN'); P.trash.push(t, n);
    const L = BS.FX_ACTIONS.RETURN_TRASH.cands(C(P, BS.mkInst('T58-PLAIN')), { do: 'RETURN_TRASH', n: 1 }).map(x => x.id);
    const all = sp('T58-ALL', O), pl = sp('T58-PLAIN', O); await BS.FX_ACTIONS.SYMBOLS_ZERO_OPP.run(C(P, BS.mkInst('T58-PMAG')), { do: 'SYMBOLS_ZERO_OPP' });
    const late = sp('T58-ALL', O);
    return [L, BS.attackSymbols(all), BS.attackSymbols(pl), BS.attackSymbols(late)];`);
  assert.deepEqual(r, [['T58-PLAIN'], 1, 0, 1]);
});
test('A58-13 "Your Hand is unaffected by opposing effects": opposing Hand effects skip the whole Hand while the card is at that level', async () => {
  const r = await ev(`const h = sp('T58-HAND', O, 3); O.hand = [BS.mkInst('T58-PLAIN'), BS.mkInst('T58-PLAIN')];
    const c = C(P, BS.mkInst('T58-DISC')), A = BS.FX_ACTIONS.REMOVE_OPP_HAND;
    const locked = A.can(c, { do: 'REMOVE_OPP_HAND', n: 1 }); h.cores = 1; const lv1 = A.can(c, { do: 'REMOVE_OPP_HAND', n: 1 });
    return [locked, lv1];`);
  assert.deepEqual(r, [false, true]);
});
test('A58-14 scenario heavy-armor-red-purple-unaffected: real cards BS17-035 vs BS20-005 and BS20-074', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/heavy-armor-red-purple-unaffected.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    BS.loadScenario(s); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    await BS.fireFx(P, 'SUMMONED', P.spirits[0], {});
    const left = O.spirits.map(x => x.id), m = P.hand.find(x => x.id === 'BS20-074');
    return [left, BS.magicTargets(P, m, 'flash').length];
  }, spec);
  assert.deepEqual(r, [['BS17-035'], 0]);
});
