// v0.56.0 Ultimate cards in the compiler: {{Sumcon|...}} / [Summon Condition: ...] -> summonIf (engine v0.46),
// [LV3]+ = the Ultimate level offset (lvBase 3, printed LV numbers), "this Ultimate" = the card itself,
// and the summon-condition keys the Sumcons need (lifeGe, ctrl: "you control N or more <colour/cost/family> Spirits/Ultimates").
// Ultimate Trigger (Fandom card reminder, Ultimate-Sea-Serpendar / Ultimate-Cu-Sith: "Send a card from the opposing decktop to the Trash.
// If that card's cost is lower than this Ultimate's, it's a hit."): action ULT_TRIGGER + condition utHit. Most Ultimate Trigger cards stay
// staged: the Fandom export drops their "[LVn] (timing)" line (Cu-Sith page: "Ultimate Trigger [LV4] (When Attacks)"); only inline ones compile.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const ULT = { id: 'T-U', name: 'Ultimate-T', type: 'Ultimate', color: 'red', cost: 5, levels: [{ cores: 1, bp: 6000 }, { cores: 3, bp: 10000 }] };
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({}, ULT, { text }, extra)))})\ntry: print(json.dumps(ce.compile_card(c)))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);
const sumcon = s => py(`try: print(json.dumps(ce.sumcon(${JSON.stringify(s)})))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('C56-01 Sumcon wordings map to summonIf', () => {
  assert.deepEqual(sumcon('You control one or more Red Spirits'), { ctrl: { n: 1, type: 'Spirit', colors: ['red'] } });
  assert.deepEqual(sumcon('You control two or more Green/Blue Spirits'), { ctrl: { n: 2, type: 'Spirit', colors: ['green', 'blue'] } });
  assert.deepEqual(sumcon('You control one or more Cost 1 or higher Spirits'), { ctrl: { n: 1, type: 'Spirit', costGe: 1 } });
  assert.deepEqual(sumcon('You control one or more Cost 3 or higher Purple Spirits'), { ctrl: { n: 1, type: 'Spirit', costGe: 3, colors: ['purple'] } });
  assert.deepEqual(sumcon('You control one or more Cost 3 or higher Spirit/Ultimate'), { ctrl: { n: 1, type: 'Both', costGe: 3 } });
  assert.deepEqual(sumcon('You control one or more Winged Beast Spirit/Ultimate'), { ctrl: { n: 1, type: 'Both', family: 'Winged Beast' } });
  assert.deepEqual(sumcon('You control one or more Ultimates'), { ctrl: { n: 1, type: 'Ultimate' } });
  assert.deepEqual(sumcon('You control one or more Red Spirits and one or more White Spirits'), { ctrl: [{ n: 1, type: 'Spirit', colors: ['red'] }, { n: 1, type: 'Spirit', colors: ['white'] }] });
  assert.deepEqual(sumcon('Your Life is at two or more'), { lifeGe: 2 });
  assert.deepEqual(sumcon('Your Life is at three or Less'), { lifeLe: 3 });
  assert.deepEqual(sumcon('You have one counter or more'), { counterGe: 1 });
  assert.deepEqual(sumcon('You must have 1 or more Blue spirits on your field.'), { ctrl: { n: 1, type: 'Spirit', colors: ['blue'] } });
  assert.deepEqual(sumcon('At Least 2 Lives'), { lifeGe: 2 });
  assert.equal(sumcon('None'), null);
  assert.match(sumcon('You control no Spirits & have 0 Spirit cards in your Trash').review, /summon condition/);
  assert.match(sumcon('You control one or more “The Extreme Partner, Zetter”, including being in Soul State/pre-advent condition').review, /summon condition/);
});
test('C56-02 an Ultimate compiles: summonIf, printed LV3+ numbers, "this Ultimate" acts on itself', () => {
  const c = compile('{{Sumcon|You control one or more Red Spirits}}\n\n[LV3][LV4] (When Summoned)\nDestroy an opposing Nexus.\n\n[LV4] (When Attacks)\nThis Ultimate gets +3000 BP.');
  assert.deepEqual(c.summonIf, { ctrl: { n: 1, type: 'Spirit', colors: ['red'] } });
  assert.deepEqual(c.effects, [{ trigger: 'SUMMONED', lv: [3, 4], actions: [{ do: 'DESTROY', nexus: true }] }, { trigger: 'ATTACKS', lv: [4], actions: [{ do: 'BP_PLUS', n: 3000 }] }]);
  assert.equal(c.fxComplete, true);
});
test('C56-07 an inline Ultimate Trigger paragraph compiles to ULT_TRIGGER + utHit actions', () => {
  const c = compile('{{Sumcon|You control one or more Red Spirits}}\n\n Ultimate Trigger [LV4] (When Attacks) When Ultimate Trigger hits, draw 2 cards from your deck. (Ultimate Trigger: Put 1 card from your opponents deck top into the Trash. If the cost of that card is lower than this Ultimate, it\'s a hit.)');
  assert.deepEqual(c.effects, [{ trigger: 'ATTACKS', lv: [4], actions: [{ do: 'ULT_TRIGGER' }, { do: 'DRAW', n: 2, if: { utHit: true } }] }]);
  assert.match(compile('{{Sumcon|You control one or more Red Spirits}}\n\nUltimate Trigger [LV4] (Start of Opposing Attack Step) When Ultimate Trigger hits, draw a card.').review, /Ultimate Trigger/);
});
test('C56-03 Ultimate level checks and what stays staged', () => {
  assert.match(compile('{{Sumcon|You control one or more Red Spirits}}\n\n[LV5] (When Summoned)\nDraw a card.').review, /LV5/);
  assert.match(compile('{{Sumcon|You control one or more Red Spirits}}\n\n[LV1] (When Summoned)\nDraw a card.').review, /LV1/);
  assert.match(compile('{{Sumcon|You control one or more Red Spirits}}\n\nUltimate Trigger\nWhen Ultimate Trigger hits, draw a card.\nutb').review, /Ultimate Trigger/);
  assert.match(compile('{{Sumcon|You control one or more Red Spirits}}\n\nDouble Ultimate Trigger\nFor each Ultimate Trigger hit, draw a card.').review, /Ultimate Trigger/);
  assert.match(compile('[LV3] (When Summoned)\nDraw a card.').review, /no summon condition/);
  assert.equal(compile('{{Sumcon|None}}\n\n[LV3] (When Summoned)\nDraw a card.').summonIf, undefined);
});

let g;
const FIX = [
  { id: 'T56-ULT', name: 'Test Ultimate', type: 'Ultimate', color: 'red', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 6000 }], summonIf: { ctrl: { n: 1, type: 'Spirit', colors: ['red'], costGe: 1 } } },
  { id: 'T56-TWO', name: 'Two Ultimate', type: 'Ultimate', color: 'white', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 6000 }], summonIf: { ctrl: [{ n: 1, type: 'Spirit', colors: ['red'] }, { n: 1, type: 'Both', family: 'Fixture' }] } },
  { id: 'T56-LIFE', name: 'Life Ultimate', type: 'Ultimate', color: 'white', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 6000 }], summonIf: { lifeGe: 2 } },
  { id: 'T56-RED0', name: 'Red Zero', type: 'Spirit', color: 'red', cost: 0, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T56-RED', name: 'Red One', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T56-UT', name: 'Trigger Ultimate', type: 'Ultimate', color: 'red', cost: 5, symbols: 1, levels: [{ cores: 1, bp: 6000 }], effects: [{ trigger: 'ATTACKS', actions: [{ do: 'ULT_TRIGGER' }, { do: 'COUNTER', n: 1, if: { utHit: true } }] }] },
  { id: 'T56-FAM', name: 'Family Ultimate', type: 'Ultimate', color: 'blue', cost: 3, symbols: 1, families: ['Fixture'], levels: [{ cores: 1, bp: 3000 }], summonIf: { lifeGe: 1 } },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.life = 5; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const ok = id => BS.summonOK(P, BS.CARDS[id]);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('C56-04 ctrl: colour, cost and Spirit type count; an opposing Spirit or a Cost 0 one does not', async () => {
  const r = await ev(`const a = ok('T56-ULT'); sp('T56-RED', O); const b = ok('T56-ULT'); sp('T56-RED0'); const c = ok('T56-ULT'); sp('T56-RED'); return [a, b, c, ok('T56-ULT')];`);
  assert.deepEqual(r, [false, false, false, true]);
});
test('C56-05 ctrl list: every entry must hold; "Both" counts an Ultimate of that family', async () => {
  const r = await ev(`sp('T56-RED'); const a = ok('T56-TWO'); sp('T56-FAM'); return [a, ok('T56-TWO')];`);
  assert.deepEqual(r, [false, true]);
});
test('C56-06 lifeGe summon condition; parseCard rejects a bad ctrl', async () => {
  const r = await ev(`P.life = 1; const a = ok('T56-LIFE'); P.life = 2; const b = ok('T56-LIFE');
    const bad = BS.parseCard({ id: 'T56-BAD', name: 'Bad', type: 'Ultimate', color: 'red', cost: 3, levels: [{ cores: 1, bp: 1000 }], summonIf: { ctrl: { n: 1, type: 'Nexus' } } });
    return [a, b, !!(bad.errors && bad.errors.length)];`);
  assert.deepEqual(r, [false, true, true]);
});
test('C56-08 Ultimate Trigger: the opposing decktop goes to the Trash; lower cost = hit, equal cost = no hit, empty deck = no hit', async () => {
  const r = await ev(`const u = sp('T56-UT'); const run = async top => { O.deck = top ? [BS.mkInst(top)] : []; O.trash = []; P.count = 0; await BS.fireFx(P, 'ATTACKS', u, {}); return [P.count, O.trash.length, O.deck.length]; };
    return [await run('T56-RED'), await run('T56-UT'), await run(null)];`);
  assert.deepEqual(r, [[1, 1, 0], [0, 1, 0], [0, 0, 0]]);
});
// --- more guards (v0.56.0) ---
test('C56-09 Sumcon: Cost N or more / above wordings and "Spirits/Ultimates"', () => {
  assert.deepEqual(sumcon('You control one or more Cost 1 or more Spirit'), { ctrl: { n: 1, type: 'Spirit', costGe: 1 } });
  assert.deepEqual(sumcon('You must have 1 or more cost 3 or above Spirit'), { ctrl: { n: 1, type: 'Spirit', costGe: 3 } });
  assert.deepEqual(sumcon('You control one or more Cost 3 or higher Spirits/Ultimates'), { ctrl: { n: 1, type: 'Both', costGe: 3 } });
  assert.deepEqual(sumcon('You control one or more Yellow Spirits/Ultimates'), { ctrl: { n: 1, type: 'Both', colors: ['yellow'] } });
});
test('C56-10 Sumcon: Ultimate family and three-or-more counts', () => {
  assert.deepEqual(sumcon('You control one or more Beast Head Ultimate'), { ctrl: { n: 1, type: 'Ultimate', family: 'Beast Head' } });
  assert.deepEqual(sumcon('You control three or more Red Spirits'), { ctrl: { n: 3, type: 'Spirit', colors: ['red'] } });
  assert.deepEqual(sumcon('Controlling at least one Beast Head Spirit/Ultimate'), { ctrl: { n: 1, type: 'Both', family: 'Beast Head' } });
});
test('C56-11 Sumcon: Life six or less / three or less', () => {
  assert.deepEqual(sumcon('Your Life is at six or less'), { lifeLe: 6 });
  assert.deepEqual(sumcon('Your Life is at three or less'), { lifeLe: 3 });
});
test('C56-12 Sumcon: Nexus, Burst and named-card conditions stay staged', () => {
  for (const s of ['You have a Burst set', 'You control one or more Purple Grandwalker Nexus', 'You control one or more Nexuses', 'You have a Red-only Mirage set'])
    assert.match(sumcon(s).review, /summon condition/, s);
});
test('C56-13 the summon condition block becomes readable card text', () => {
  const c = compile('{{Sumcon|You control one or more Red Spirits}}\n\n[LV3] (When Summoned)\nDraw a card.');
  assert.equal(c.text, '[Summon Condition: You control one or more Red Spirits]\n\n[LV3] (When Summoned)\nDraw a card.');
});
test('C56-14 the old [Summon Condition: ...] form compiles too', () => {
  const c = compile('[Summon Condition: You must have 1 or more Blue spirits on your field.]\n\n[LV3][LV4] (When Attacks)\nDraw a card.');
  assert.deepEqual([c.summonIf, c.effects[0].lv], [{ ctrl: { n: 1, type: 'Spirit', colors: ['blue'] } }, [3, 4]]);
});
test('C56-15 a Spirit is unchanged: [LV1] still works, [LV3] on a 2-level Spirit still reviews', () => {
  const sp = { type: 'Spirit' };
  assert.deepEqual(compile('[LV1] (When Summoned)\nDraw a card.', sp).effects[0].lv, [1]);
  assert.match(compile('[LV3] (When Summoned)\nDraw a card.', sp).review, /LV3/);
});
test('C56-16 an optional Ultimate Trigger body and "When Braved Ultimate Trigger" stay staged', () => {
  assert.match(compile('{{Sumcon|You control one or more Red Spirits}}\n\nUltimate Trigger [LV4] (When Attacks) When Ultimate Trigger hits, you can draw a card.').review, /Ultimate Trigger body/);
  assert.match(compile('{{Sumcon|You control one or more Red Spirits}}\n\nWhen Braved Ultimate Trigger\nWhen Ultimate Trigger hits, draw a card.').review, /Ultimate Trigger/);
});
test('C56-17 every staged Ultimate either compiles or names a reason (no crash)', () => {
  const r = py(`out = []\nfor c in ce.staged():\n  if c['type'] != 'Ultimate': continue\n  try: ce.compile_card(c); out.append('ok')\n  except ce.Review as e: out.append(str(e)[:20])\nprint(json.dumps(out))`);
  assert.ok(r.length > 200 && r.every(x => typeof x === 'string' && x.length));
});
// v0.60.3: the [LVn] (timing) line now comes from data/sources/fandom-ultimate-trigger.tsv, so the review moves on to the body sentence
test('C56-18 Ultimate-Dragsaurus (BS24-058) has its Ultimate Trigger line back; the review names the body sentence', () => {
  const r = py(`c = next(x for x in ce.staged() if x['id'] == 'BS24-058')\ntry: ce.compile_card(c); print(json.dumps('ok'))\nexcept ce.Review as e: print(json.dumps(str(e)))`);
  assert.doesNotMatch(r, /drops its \[LVn\]/); assert.match(r, /^sentence: For each one cost of the card sent to Trash/);
});
test('C56-19 parse: ULT_TRIGGER and utHit are valid, ULT_TRIGGER with parameters and a bad utHit are not', async () => {
  const r = await ev(`const a = BS.parseActionList([{ do: 'ULT_TRIGGER' }, { do: 'DRAW', n: 1, if: { utHit: true } }]); const b = BS.parseActionList([{ do: 'ULT_TRIGGER', n: 2 }]); const c = BS.parseActionList([{ do: 'DRAW', n: 1, if: { utHit: 1 } }]);
    return [!a.error, !!b.error, !!c.error];`);
  assert.deepEqual(r, [true, true, true]);
});
test('C56-20 the Ultimate Trigger card text line names the hit rule', async () => {
  assert.match(await ev(`return BS.FX_ACTIONS.ULT_TRIGGER.txt({});`), /lower cost than this card is a hit/);
});
test('C56-21 an Ultimate whose summon condition fails cannot be played from the Hand; it can once the condition holds', async () => {
  const r = await ev(`P.hand = []; P.reserve.n = 10; const u = BS.mkInst('T56-ULT'); P.hand.push(u); const a = BS.canPlayCard(P, u); sp('T56-RED'); return [a, BS.canPlayCard(P, u)];`);
  assert.deepEqual(r, [false, true]);
});
test('C56-22 a hit records the sent card cost in the effect context; a miss leaves utHit false', async () => {
  const r = await ev(`const u = sp('T56-UT'); const ctx = {}; const c = { p: P, opp: O, src: u, ctx }; O.deck = [BS.mkInst('T56-FAM')]; await BS.FX_ACTIONS.ULT_TRIGGER.run(c, {}); const a = [ctx.utHit, ctx.utCost];
    O.deck = [BS.mkInst('T56-UT')]; await BS.FX_ACTIONS.ULT_TRIGGER.run(c, {}); return a.concat([ctx.utHit, ctx.utCost]);`);
  assert.deepEqual(r, [true, 3, false, 5]);
});
