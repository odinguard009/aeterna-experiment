// v0.88.0 S1 Standard Magic (roadmap item L): the Standard (block A) Magic cards that had no runnable paragraph.
// New format pieces (schema v2): conditions lifeReduced / allHave, match familyAll, action DESTROY_OWN,
// EXHAUST_OPP.coresLe, CANT_ATTACK_BLOCK.turn / costLe. Real cards are cast on quiet boards with test Spirits.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const sp = (id, cost, extra = {}) => Object.assign({ id, name: id, type: 'Spirit', color: 'red', cost, symbols: 1, levels: [{ cores: 1, bp: cost * 1000 }] }, extra);
const FIX = [
  sp('T88-C3', 3), sp('T88-C5', 5), sp('T88-C4', 4),
  sp('T88-GAIM', 3, { families: ['GAIM'] }), sp('T88-GENM', 4, { name: 'Kamen Rider Genm', families: ['EX-AID'] }),
  sp('T88-STELLA', 2, { text: '[Team: Red Stella]\n\n[LV1] (When Summoned) Draw a card.' }), sp('T88-STELLA2', 2, { text: '[Teams: Shiny Hearts/Red Stella]' }),
  sp('T88-TOP4', 4, { families: ['Topaz'], color: 'yellow' }), sp('T88-TOP6', 6, { families: ['Topaz'], color: 'yellow' }), sp('T88-TOP5', 5, { families: ['Topaz'], color: 'yellow' }),
  sp('T88-RYUKI', 4, { families: ['RYUKI', 'Kamen'] }), sp('T88-RYUKI1', 4, { families: ['RYUKI'] }),
  { id: 'T88-NEX', name: 'T88-NEX', type: 'Nexus', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
// mine / theirs: [id, cores, exhausted]; returns the expression's value after casting `card` (Flash) when it is usable
const cast = (card, mine, theirs, setup = '', out = '') => g.page.evaluate(async ([card, mine, theirs, setup, out]) => {
  BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = O.key; G.step = 5;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.trash = []; q.hand = []; }
  P.reserve.n = 10; P.reserve.soul = true;
  const put = (q, [id, cores, ex]) => { const i = BS.mkInst(id); i.cores = cores == null ? 1 : cores; i.exhausted = !!ex; (BS.CARDS[id].type === 'Nexus' ? q.nexus : q.spirits).push(i); return i; };
  mine.forEach(x => put(P, x)); theirs.forEach(x => put(O, x));
  eval(setup);
  const m = BS.mkInst(card); P.hand.push(m); const ok = BS.magicUsable(P, m, 'flash');
  if (ok) await BS.castMagic(P, { inst: m, ctx: 'flash' });
  return [ok, await eval(out || "O.spirits.map(s => s.id)")];
}, [card, mine, theirs, setup, out]);

test('S88-01 scenario s1-sharp-thorn-life-reduced: Sharp Thorn reaches Cost 7 only after the Life was reduced this turn', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/s1-sharp-thorn-life-reduced.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    const e = BS.loadScenario(s); if (e && e.error) return e.error;
    BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const m = P.hand[0], before = BS.magicUsable(P, m, 'flash');
    BS.lifeTake(P, 1, 'reserve');                       // a Life core leaves the Life this turn
    const after = BS.magicUsable(P, m, 'flash'); await BS.castMagic(P, { inst: m, ctx: 'flash' });
    return [before, after, O.spirits.length, P.life];
  }, spec);
  assert.deepEqual(r, [false, true, 0, 4]);
});
test('S88-02 lifeReduced: no reduction keeps the Cost 4 bound, and the mark is per turn', async () => {
  assert.deepEqual(await cast('26RBS03-097', [], [['T88-C5'], ['T88-C3']]), [true, ['T88-C5']]);
  assert.deepEqual(await cast('26RBS03-097', [], [['T88-C5']], 'P.lifeRedTurn = G.turnNo - 1;'), [false, ['T88-C5']]);
  // Merciless Blow: Cost 5 or less, then (Life reduced) a Cost 3 or less one as well
  assert.deepEqual(await cast('26RBS01-126', [], [['T88-C5'], ['T88-C3']], 'BS.lifeTake(P, 1, "reserve");'), [true, []]);
  assert.deepEqual(await cast('26RBS01-126', [], [['T88-C5'], ['T88-C3']]), [true, ['T88-C3']]);
});
test('S88-03 allHave family: Burai Kick needs every Spirit/Nexus of yours to be GAIM, and at least one', async () => {
  assert.deepEqual(await cast('26RCB01-062', [['T88-GAIM']], [['T88-C3']]), [true, []]);
  assert.deepEqual(await cast('26RCB01-062', [['T88-GAIM'], ['T88-C4']], [['T88-C3']]), [false, ['T88-C3']]);
  assert.deepEqual(await cast('26RCB01-062', [['T88-GAIM'], ['T88-NEX', 0]], [['T88-C3']]), [false, ['T88-C3']]);
  assert.deepEqual(await cast('26RCB01-062', [], [['T88-C3']]), [false, ['T88-C3']]);
});
test('S88-04 allHave team: the [Team: X] / [Teams: X/Y] head line counts', async () => {
  assert.deepEqual(await cast('26RDB01-056', [['T88-STELLA'], ['T88-STELLA2']], [['T88-C3']]), [true, []]);
  assert.deepEqual(await cast('26RDB01-056', [['T88-STELLA'], ['T88-GAIM']], [['T88-C3']]), [false, ['T88-C3']]);
});
test('S88-05 allHave costIn + spiritsOnly: Flash Run refreshes a Cost 6/8 Topaz Spirit only when all your Spirits are Topaz of even cost', async () => {
  const out = "P.spirits.map(s => s.exhausted)";
  assert.deepEqual(await cast('26RBS03-096', [['T88-TOP4', 1, true], ['T88-TOP6', 1, true], ['T88-NEX', 0]], [], '', out), [true, [true, false]]);
  assert.deepEqual(await cast('26RBS03-096', [['T88-TOP5', 1], ['T88-TOP6', 1, true]], [], '', out), [false, [false, true]]);
});
test('S88-06 DESTROY_OWN + prev: Critical Dead destroys your Cost 4+ Genm, and only then an opposing Cost 5 or less Spirit', async () => {
  assert.deepEqual(await cast('26RCB01-070', [['T88-GENM'], ['T88-C4']], [['T88-C5']], '', "[O.spirits.length, P.spirits.map(s => s.id)]"), [true, [0, ['T88-C4']]]);
  assert.deepEqual(await cast('26RCB01-070', [['T88-C4']], [['T88-C5']]), [false, ['T88-C5']]);
  // Suicide Attack: your Cost 6+ Purple Spirit, then an opposing exhausted Spirit (the refreshed one stays)
  const r = await g.page.evaluate(() => BS.importCards(JSON.stringify([{ id: 'T88-P6', name: 'T88-P6', type: 'Spirit', color: 'purple', cost: 6, symbols: 1, levels: [{ cores: 1, bp: 6000 }] }])));
  assert.equal(r.ok, 1);
  assert.deepEqual(await cast('26RBS01-114', [['T88-P6']], [['T88-C3', 1, true], ['T88-C4']]), [true, ['T88-C4']]);
});
test('S88-07 EXHAUST_OPP coresLe: Binding Kelp exhausts a Spirit with one core or less only', async () => {
  assert.deepEqual(await cast('26RBS03-090', [], [['T88-C3', 2], ['T88-C4', 1]], '', "O.spirits.map(s => s.exhausted)"), [true, [false, true]]);
  assert.deepEqual(await cast('26RBS03-090', [], [['T88-C3', 2]], '', "O.spirits.map(s => s.exhausted)"), [false, [false]]);
});
test('S88-08 CANT_ATTACK_BLOCK turn + costLe: Bolt Grid holds a Cost 4 or less Spirit until the End Step', async () => {
  const r = await cast('26RBS01-122', [], [['T88-C5'], ['T88-C4']], '', "(async () => { const a = O.spirits.map(s => !!s.noAB); await BS.endStep(O.key); return [a, O.spirits.map(s => !!s.noAB)]; })()");
  assert.deepEqual(r, [true, [[false, true], [false, false]]]);
});
test('S88-09 match familyAll: Final Vent refreshes a "RYUKI" & "Kamen" Spirit, not a RYUKI-only one', async () => {
  const out = "P.spirits.map(s => s.exhausted)";
  assert.deepEqual(await cast('26RCB01-069', [['T88-RYUKI1', 1, true], ['T88-RYUKI', 1, true]], [], '', out), [true, [true, false]]);
  assert.deepEqual(await cast('26RCB01-069', [['T88-RYUKI1', 1, true]], [], '', out), [false, [true]]);
});
test('S88-10 every S1 card is in the library; partial ones say what does not run', async () => {
  const r = await g.page.evaluate(() => Object.values(BS.CARDS).filter(k => k.block === 'A' && k.type === 'Magic').map(k => [k.id, k.fxComplete, (k.residual || []).length]));
  const ids = new Set(r.map(x => x[0]));
  for (const id of ['26RBS01-112', '26RBS01-122', '26RBS03-096', '26RCB01-070', '26RDB01-062', '26RSD05-014', '26RSD10-012']) assert.ok(ids.has(id), id);
  const S1 = new Set(['26RBS03-087', '26RDB01-059', '26RSD02-013', '26RSD05-012', '26RSD06-013', '26RSD08-012']);
  for (const [id, done, res] of r.filter(x => S1.has(x[0]))) assert.ok(!done && res > 0, id);
  assert.equal(r.filter(x => S1.has(x[0])).length, S1.size);
});
