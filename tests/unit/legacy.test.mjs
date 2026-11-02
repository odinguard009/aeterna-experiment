// v0.69.0 Legacy (= Succession; Standard rule manual CR 12-2-1-3; Fandom "Legacy" + Q&A 31541-31543, 31620, 31866):
// when you summon / cast a card with Legacy you may banish EX-symbol cards of the reduction colour from your Trash, one per
// reduction symbol, BEFORE the Field symbols reduce the cost; max = the reduction symbols; none banished = Legacy not activated.
// House reading (owner rule "most stable option"): Legacy is applied automatically, with the fewest banished cards that give
// the lowest cost (a Field symbol that can pay a reduction symbol saves an EX card). Never with a fixed cost (costAlt).
// Card data: text head "(Legacy)" -> field legacy: true; the export's ex_symbols -> exSymbols (an EX symbol = one Trash card).
// rules: SJP:inherit@de8f4527
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'green', cost: 6, reduction: { green: 3 }, ex_symbols: 1, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('L69-01 compiler: the "(Legacy)" head sets legacy, keeps ex_symbols and leaves the rest of the text', () => {
  const v = compile('(Legacy)');
  assert.equal(v.legacy, true, JSON.stringify(v));
  assert.equal(v.ex_symbols, 1);
  assert.equal(v.fxComplete, true, 'a vanilla Legacy card is complete');
  const s = compile('(Legacy)\n[LV1][LV2] (When Summoned)\nDraw a card.');
  assert.equal(s.legacy, true, JSON.stringify(s));
  assert.equal(s.effects.length, 1);
  assert.equal(compile('[LV1] (When Summoned)\nDraw a card.').legacy, undefined);
  assert.equal(compile('[LV1] (When Summoned)\nDraw a card.', { ex_symbols: 0 }).ex_symbols, 0);
});
test('L69-02 compiler: Legacy on a Brave, or a sentence that only mentions Legacy, is not the head', () => {
  assert.match(compile('(Legacy)', { type: 'Brave' }).review || '', /Legacy/);
  const m = compile('If summoned using Legacy, you can target an opposing Spirit. Exhaust it.');
  assert.equal(m.legacy, undefined, JSON.stringify(m));
});

let g;
const FIX = [
  { id: 'T69-LEG', name: 'T69-LEG', type: 'Spirit', color: 'green', cost: 6, symbols: 1, reduction: { green: 3 }, legacy: true, ex_symbols: 1, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }] },
  { id: 'T69-PLAIN', name: 'T69-PLAIN', type: 'Spirit', color: 'green', cost: 6, symbols: 1, reduction: { green: 3 }, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }] },
  { id: 'T69-EXG', name: 'T69-EXG', type: 'Spirit', color: 'green', cost: 3, symbols: 1, ex_symbols: 1, levels: [{ cores: 1, bp: 2000 }] },
  { id: 'T69-EXR', name: 'T69-EXR', type: 'Spirit', color: 'red', cost: 3, symbols: 1, ex_symbols: 1, levels: [{ cores: 1, bp: 2000 }] },
  { id: 'T69-NOEX', name: 'T69-NOEX', type: 'Spirit', color: 'green', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 2000 }] },
  { id: 'T69-MAG', name: 'T69-MAG', type: 'Magic', color: 'green', cost: 5, symbols: 0, reduction: { green: 2 }, legacy: true, ex_symbols: 1, magic: { timing: ['MAIN'], effect: 'DRAW', value: 1 } },
  { id: 'T69-ALT', name: 'T69-ALT', type: 'Spirit', color: 'green', cost: 6, symbols: 1, reduction: { green: 3 }, legacy: true, levels: [{ cores: 1, bp: 3000 }],
    costAlt: { cost: 5 } },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 5;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.burst = null; q.trash = []; q.removed = []; q.hand = []; }
  P.reserve.n = 12; P.reserve.soul = false;
  const mk = (id, zone) => { const i = BS.mkInst(id); P[zone].push(i); return i; };
  const fieldGreen = () => { const i = BS.mkInst('T69-NOEX'); i.cores = 1; P.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('L69-03 parse: legacy / ex_symbols are kept on Spirit, Magic and Nexus cards and rejected elsewhere', async () => {
  const r = await g.page.evaluate(() => [BS.CARDS['T69-LEG'].legacy, BS.CARDS['T69-LEG'].exSymbols, BS.CARDS['T69-PLAIN'].legacy || false, BS.CARDS['T69-PLAIN'].exSymbols || 0, BS.CARDS['T69-MAG'].legacy,
    BS.parseCard({ id: 'T69-BAD', name: 'B', type: 'Brave', color: 'green', cost: 3, legacy: true }).errors ? 'err' : 'ok',
    BS.parseCard({ id: 'T69-BAD2', name: 'B', type: 'Spirit', color: 'green', cost: 3, levels: [{ cores: 1, bp: 1000 }], legacy: 'yes' }).errors ? 'err' : 'ok',
    BS.parseCard({ id: 'T69-BAD3', name: 'B', type: 'Spirit', color: 'green', cost: 3, levels: [{ cores: 1, bp: 1000 }], ex_symbols: 9 }).errors ? 'err' : 'ok']);
  assert.deepEqual(r, [true, 1, false, 0, true, 'err', 'err', 'err']);
});
test('L69-04 cost: one banished EX card per reduction symbol of its colour; other colours, non-EX cards and non-Legacy cards do not count', async () => {
  const r = await ev(`const out = [];
    const c = id => BS.effCost(P, BS.CARDS[id]);
    out.push(c('T69-LEG'));                                   // empty Trash: 6
    mk('T69-NOEX', 'trash'); mk('T69-EXR', 'trash'); out.push(c('T69-LEG'));   // no green EX card: 6
    mk('T69-EXG', 'trash'); out.push(c('T69-LEG'));           // one green EX: 5
    mk('T69-EXG', 'trash'); mk('T69-EXG', 'trash'); mk('T69-EXG', 'trash'); out.push(c('T69-LEG'));   // four green EX, max = 3 reduction symbols: 3
    out.push(c('T69-PLAIN'));                                 // no Legacy: 6
    return out;`);
  assert.deepEqual(r, [6, 6, 5, 3, 6]);
});
test('L69-05 cost: Legacy goes first but a Field symbol saves an EX card (fewest banished for the lowest cost); the Field never lowers it below Legacy alone', async () => {
  const r = await ev(`const out = [];
    for (let k = 0; k < 3; k++) mk('T69-EXG', 'trash');
    fieldGreen(); fieldGreen();                               // two Field green symbols
    const card = BS.CARDS['T69-LEG'];
    out.push(BS.effCost(P, card));                            // 3 reduction symbols: 2 by the Field + 1 by Legacy = 6 - 3 = 3
    out.push(BS.legacyPlan(P, card).n);                       // one EX card is enough
    P.trash.length = 0; out.push(BS.effCost(P, card), BS.legacyPlan(P, card) === null);   // Field alone: 4
    return out;`);
  assert.deepEqual(r, [3, 1, 4, true]);
});
test('L69-06 summon: the chosen EX cards go from the Trash to the Banished zone, the cost is paid, the card remembers how many (legacyN)', async () => {
  const r = await ev(`const e1 = mk('T69-EXG', 'trash'), e2 = mk('T69-EXG', 'trash'), keep = mk('T69-NOEX', 'trash');
    const inst = mk('T69-LEG', 'hand'); const before = P.reserve.n;
    await BS.summonPaid(P, inst);
    return [BS.fieldList(P).includes(inst), inst.legacyN, P.removed.length, P.removed.includes(e1) && P.removed.includes(e2), P.trash.length, P.trash.includes(keep), before - P.reserve.n - inst.cores];`);
  assert.deepEqual(r, [true, 2, 2, true, 1, true, 4]);
});
test('L69-07 summon without enough EX cards: Legacy is not activated (legacyN 0), nothing is banished', async () => {
  const r = await ev(`mk('T69-NOEX', 'trash'); const inst = mk('T69-LEG', 'hand');
    await BS.summonPaid(P, inst); return [BS.fieldList(P).includes(inst), inst.legacyN || 0, P.removed.length, P.trash.length];`);
  assert.deepEqual(r, [true, 0, 0, 1]);
});
test('L69-08 Magic with Legacy: castMagic banishes the EX cards and the card goes to the Trash', async () => {
  const r = await ev(`const e1 = mk('T69-EXG', 'trash'), e2 = mk('T69-EXG', 'trash'); const inst = mk('T69-MAG', 'hand'); P.deck = [BS.mkInst('T69-NOEX')];
    const cost = BS.effCost(P, BS.CARDS['T69-MAG']); const before = P.reserve.n;
    await BS.castMagic(P, { inst, target: null, plan: null });
    return [cost, before - P.reserve.n, P.removed.length, P.trash.includes(inst), P.trash.includes(e1)];`);
  assert.deepEqual(r, [3, 3, 2, true, false]);
});
test('L69-09 a fixed cost (costAlt) never uses Legacy', async () => {
  const r = await ev(`mk('T69-EXG', 'trash'); const card = BS.CARDS['T69-ALT'];
    return [BS.effCost(P, card), BS.legacyPlan(P, card) === null];`);
  assert.deepEqual(r, [5, true]);
});
test('L69-10 scenario legacy-lione-macina-banish: real cards (26RBS01-045 with three green EX cards in the Trash)', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/legacy-lione-macina-banish.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    BS.loadScenario(s); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player; const inst = P.hand[0];
    const out = [BS.CARDS['26RBS01-045'].legacy, BS.CARDS['26RBS02-025'].exSymbols, BS.effCost(P, BS.CARDS['26RBS01-045']), !!BS.CARDS['26RBS01-045'].implemented];
    const before = P.reserve.n; await BS.summonPaid(P, inst);
    out.push(BS.fieldList(P).includes(inst), inst.legacyN, P.removed.map(x => x.id).sort().join(','), P.trash.map(x => x.id).join(','), before - P.reserve.n - inst.cores);
    return out;
  }, spec);
  assert.deepEqual(r, [true, 1, 5, true, true, 3, '26RBS01-033,26RBS02-025,26RBS02-027', '26RBS01-001', 5]);
});
