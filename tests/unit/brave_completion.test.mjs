// v0.60.0 Brave completion:
//   - Brave combine data (condition + braved BP) comes from data/sources/fandom-brave-combine.tsv (Fandom page fields; the
//     export drops them), parsed by tools/import_fandom.py brave_of(); conditions the engine cannot check stay without data.
//   - "[When Braved]" / "When Braved" / "During (Spirit) Brave" paragraphs (JP 合体時) compile to effects with braved:true;
//     "(When Brave Attacks)" / "(When This Spirit Brave Attacks)" = (When Attacks) while combined.
//   - A Spirit combined with a Brave gains the Brave's braved effects (fxEntries, indexed from BR_IDX); a Brave alone in Spirit
//     form and an unbraved Spirit do not use braved effects (triggers and STATIC effects alike).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

// v0.60.2: B60-12/13 read data/sources, which the light clone leaves out (like I30)
const NO_SRC = !existsSync(join(ROOT, 'data/sources/fandom-brave-combine.tsv')) && 'data/sources not checked out (light clone)';
const py = (mod, code) => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import ${mod} as m\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const brave = (cond, bp) => py('import_fandom', `print(json.dumps(m.brave_of(${JSON.stringify(cond)}, ${JSON.stringify(bp)})))`);
const BR = { id: 'T-B', name: 'TB', type: 'Brave', color: 'red', cost: 3, levels: [{ cores: 1, bp: 2000 }], brave: { bp: 3000, costGe: 3 } };
const compile = (text, base = BR) => py('compile_effects', `c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({}, base, { text })))})\ntry: print(json.dumps(m.compile_card(c)))\nexcept m.Review as e: print(json.dumps({'review': str(e)}))`);

test('B60-01 brave_of parses the Fandom conditions the engine can check, and only those', () => {
  assert.deepEqual(brave('Cost 4 or more', '+3000'), { bp: 3000, costGe: 4 });
  assert.deepEqual(brave('A cost of 5 or more', '+5000'), { bp: 5000, costGe: 5 });
  assert.deepEqual(brave('Cost 4 or above', '+4000'), { bp: 4000, costGe: 4 });
  assert.deepEqual(brave('No printed effects', '2000'), { bp: 2000 });
  assert.deepEqual(brave('[[Supreme Hero]]/ [[Great General]]', '+5000'), { bp: 5000, family: ['Supreme Hero', 'Great General'] });
  assert.deepEqual(brave('[[Scarlet Flame]] & Cost 4 or more', '+3000'), { bp: 3000, family: ['Scarlet Flame'], costGe: 4 });
  for (const c of ['Cost 3 or more Spirit/Ultimate', 'Cost 4 or more<br>Grandwalker Nexus', '[Left/Right] Cost 4 or more', '[Right] Cost 3 or less<br>[Left] Cost 3 or less',
    'Green symbol holder', '{{tk|Charge}} holder', 'Cost 0/1/2', '[[Astral Guardian]]/Cost 8 or more', 'Two symbols or more', '"Raon"/{{tk|AFO}}-holder'])
    assert.equal(brave(c, '+3000'), null, c);
});
test('B60-02 the import gives Braves their combine data', () => {
  const r = py('compile_effects', `print(json.dumps({c['id']: c.get('brave') for c in m.staged() if c['id'] in ('BS10-061', 'BS10-062', 'BS15-057')}))`);
  assert.equal(r['BS10-061'], undefined);                        // promoted (DESTROY_TOTAL): staged() no longer lists it; "No printed effect" is covered by B60-01
  assert.deepEqual(r['BS10-062'], { bp: 3000, costGe: 3 });      // The GunDragon Phoenix-Cannon: Cost 3 or more, +3000
});
test('B60-03 braved paragraphs compile with braved:true; Brave Attacks = When Attacks', () => {
  const a = compile('[When Braved] (When This Spirit Brave Attacks) Draw a card.');
  assert.deepEqual(a.effects, [{ trigger: 'ATTACKS', actions: [{ do: 'DRAW', n: 1 }], braved: true }]);
  const b = compile('During Spirit Brave (When Attacks) Draw a card.');
  assert.equal(b.effects[0].braved, true);
  assert.match(compile('[When Braved] [LV1] (When Attacks) Draw a card.').review, /level on a Brave/);
  assert.match(compile('When Braved (When Destroyed) Draw a card.').review, /braved paragraph trigger DESTROYED/);
  const s = compile('When Braved [LV2] (When Brave Attacks) Draw a card.', { id: 'T-S', name: 'TS', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 2000 }, { cores: 3, bp: 4000 }] });
  assert.deepEqual(s.effects, [{ trigger: 'ATTACKS', lv: [2], actions: [{ do: 'DRAW', n: 1 }], braved: true }]);
  assert.match(compile('When Braved on Left (When Attacks) Draw a card.').review, /keyword|no trigger/);     // two-sided Braves are not built yet
});

let g;
const FIX = [
  { id: 'T60-BR', name: 'Fixture Brave', type: 'Brave', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 2000 }], brave: { bp: 3000, costGe: 3 },
    effects: [{ trigger: 'ATTACKS', braved: true, actions: [{ do: 'COUNTER', n: 1 }] }, { trigger: 'STATIC', flag: 'MUST_BLOCK', to: 'self', braved: true }, { trigger: 'ATTACKS', actions: [{ do: 'DRAW', n: 1 }] }] },
  { id: 'T60-SP', name: 'Fixture Spirit', type: 'Spirit', color: 'red', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 4000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.life = 5; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('B60-04 a braved Spirit uses the Brave\'s braved effects; the Brave\'s other effects stay with the Brave', async () => {
  const r = await ev(`const s = sp('T60-SP'), b = sp('T60-BR'); const hand0 = P.hand.length;
    const fits = BS.braveFits(b, s); BS.combineBrave(P, b, s);
    const kinds = BS.collectFx({ owner: P, trigger: 'ATTACKS', src: s, ctx: { attacker: s } }).map(i => i.idx);
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s });
    return [fits, BS.bpOf(s), kinds, P.count, P.hand.length - hand0, BS.flagActive(P, 'MUST_BLOCK', s)];`);
  assert.deepEqual(r, [true, 7000, [200], 1, 0, true]);
});
test('B60-05 a Brave alone in Spirit form does not use its braved effects', async () => {
  const r = await ev(`const b = sp('T60-BR'); const hand0 = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', b, { attacker: b });
    return [P.count, P.hand.length - hand0, BS.flagActive(P, 'MUST_BLOCK', b)];`);
  assert.deepEqual(r, [0, 1, false]);
});
test('B60-06 the condition is checked: a cost-2 Spirit cannot take a "Cost 3 or more" Brave', async () => {
  const r = await ev(`const s = sp('BS01-030'), b = sp('T60-BR'); return [BS.CARDS['BS01-030'].cost, BS.braveFits(b, s)];`);
  assert.equal(r[1], r[0] >= 3);
});
test('B60-07 separating the Brave turns the borrowed effects off again', async () => {
  const r = await ev(`const s = sp('T60-SP'), b = sp('T60-BR'); BS.combineBrave(P, b, s); P.reserve = 5;
    BS.separateBrave(P, s); await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); return [!!s.brave, P.count, BS.flagActive(P, 'MUST_BLOCK', s)];`);
  assert.deepEqual(r, [false, 0, false]);
});
test('B60-08 promoted Braves carry combine data and braved effects (real cards)', async () => {
  const r = await g.page.evaluate(() => ['BS10-068', 'BS14-072', 'BS22-061', 'BS32-059'].map(id => { const c = BS.CARDS[id]; return [c.brave && c.brave.bp, (c.effects || []).some(e => e.braved)]; }));
  assert.deepEqual(r, [[2000, true], [4000, true], [4000, true], [10000, false]]);
});
test('B60-09 real card BS14-072 Gurangatch on a Spirit: the braved Spirit destroys an opposing Cost 3 or less Spirit when it attacks', async () => {
  const r = await ev(`const s = sp('T60-SP'), b = sp('BS14-072'); BS.combineBrave(P, b, s); const t = sp('BS01-030', O);
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); return [BS.bpOf(s), O.spirits.includes(t)];`);
  assert.deepEqual(r, [8000, false]);
});
test('B60-10 brave_of: "Cost of N or more", family + cost, BP without a plus sign, +0 BP', () => {
  assert.deepEqual(brave('Cost of 5 or more', '+4000'), { bp: 4000, costGe: 5 });
  assert.deepEqual(brave('[[Blood Crystal]] & Cost 4 or more', '+5000'), { bp: 5000, family: ['Blood Crystal'], costGe: 4 });
  assert.deepEqual(brave('Cost 4 or more', '3000'), { bp: 3000, costGe: 4 });
  assert.deepEqual(brave('Cost 3 or more', '+0'), { bp: 0, costGe: 3 });
});
test('B60-11 brave_of rejects an unreadable BP and an ampersand of two families', () => {
  assert.equal(brave('Cost 4 or more', '?'), null);
  assert.equal(brave('[[Primal]] & [[Fighting Spirit]]', '+3000'), null);
  assert.equal(brave('Cost 4 or above/ Spirit With [[Windstorm]]', '+3000'), null);
});
test('B60-12 every row of the source table parses or is a known kind the engine cannot check', { skip: NO_SRC }, () => {
  const r = py('import_fandom', `import re\nbad=[]\nfor line in open(m.BRAVE_SRC, encoding='utf8'):\n  if line.startswith('#'): continue\n  t,c,b=line.rstrip('\\n').split('\\t')\n  if m.brave_of(c,b) is None and not re.search(r'<br|\\[(Left|Right)|Ultimate|Nexus|symbol|holder|less|\\{\\{|"|/|&|Two|Cost \\d+$|Cost \\d/', c, re.I): bad.append(c)\nprint(json.dumps(bad))`);
  assert.deepEqual(r, []);
});
test('B60-13 the source table has one row per Fandom page, 441 pages', { skip: NO_SRC }, () => {
  const r = py('import_fandom', `print(json.dumps(len(m.brave_table())))`);
  assert.equal(r, 441);
});
test('B60-14 import report lists Braves left without data', () => {
  const r = py('import_fandom', `print(json.dumps(json.load(open('data/import/report.json', encoding='utf-8'))['stats'].get('brave_unparsed', 0)))`);
  assert.ok(r > 100 && r < 200, String(r));
});
test('B60-15 braved paragraph forms: [When Braved], When Braved, During Brave, During Spirit Brave', () => {
  for (const h of ['[When Braved]', 'When Braved', 'During Brave', 'During Spirit Brave']) assert.equal(compile(h + ' (When Attacks) Draw a card.').effects[0].braved, true, h);
  assert.equal(compile('[When Braved] (When Brave Attack) Draw a card.').effects[0].trigger, 'ATTACKS');
});
test('B60-16 braved (When Blocks) and (When Battles) keep their triggers', () => {
  assert.deepEqual(compile('When Braved (When Blocks) Draw a card.').effects[0], { trigger: 'BLOCKS', actions: [{ do: 'DRAW', n: 1 }], braved: true });
  assert.equal(compile('When Braved (When Battles) When only the opposing Spirit is destroyed by comparing BP, refresh this Spirit.').effects[0].trigger, 'BATTLE_WIN');
});
test('B60-17 braved static effects keep braved:true (Hand unaffected)', () => {
  assert.deepEqual(compile('When Braved Your Hand is unaffected by opposing effects.').effects, [{ trigger: 'STATIC', flag: 'HAND_UNAFFECTED', to: 'self', braved: true }]);
});
test('B60-18 a braved (When Summoned) is not a braved effect: review', () => {
  assert.match(compile('When Braved (When Summoned) Draw a card.').review, /braved paragraph trigger SUMMONED/);
});
test('B60-19 compiled Braves keep their combine data (KEEP has brave)', () => {
  assert.deepEqual(compile('[When Braved] (When Attacks) Draw a card.').brave, { bp: 3000, costGe: 3 });
});
test('B60-20 a Brave without combine data still goes to review', () => {
  const b = Object.assign({}, BR); delete b.brave;
  assert.match(compile('[When Braved] (When Attacks) Draw a card.', b).review, /without combine data/);
});
test('B60-21 the engine keeps braved on STATIC flag and STATIC BP effects', async () => {
  const r = await g.page.evaluate(() => { const p = BS.parseEffects([{ trigger: 'STATIC', flag: 'MUST_BLOCK', to: 'self', braved: true }, { trigger: 'STATIC', bp: 1000, braved: true }]); return p.effects.map(e => e.braved === true); });
  assert.deepEqual(r, [true, true]);
});
test('B60-22 a braved STATIC BP effect counts only while combined', async () => {
  const r = await ev(`BS.CARDS['T60-BR'].effects.push({ trigger: 'STATIC', bp: 1000, braved: true });
    const s = sp('T60-SP'), b = sp('T60-BR'); const alone = BS.staticBp(b); BS.combineBrave(P, b, s); const on = BS.staticBp(s);
    BS.CARDS['T60-BR'].effects.pop(); return [alone, on];`);
  assert.deepEqual(r, [0, 1000]);
});
test('B60-23 real card BS10-068 Beam-Beetle: braved Spirit exhausts an opposing Spirit when it attacks', async () => {
  const r = await ev(`const s = sp('T60-SP'), b = sp('BS10-068'); const fit = BS.braveFits(b, s); BS.combineBrave(P, b, s); const t = sp('BS01-030', O);
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); return [fit, t.exhausted === true];`);
  assert.deepEqual(r, [true, true]);
});
test('B60-24 real card BS20-055 Tylok-Cephale: +4000 combine and +4000 when the braved Spirit attacks', async () => {
  const r = await ev(`const s = sp('T60-SP'), b = sp('BS20-055'); BS.combineBrave(P, b, s); const before = BS.bpOf(s);
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); return [before, BS.bpOf(s)];`);
  assert.deepEqual(r, [8000, 12000]);
});
