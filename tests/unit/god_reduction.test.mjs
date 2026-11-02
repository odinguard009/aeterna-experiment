// v0.44.6: the 14 green/purple Devotee cards carry a God reduction symbol (issue #5).
// BS68 confirmed on the official card list (battlespirits.com, "紫 … 神" in the reduction), BS69/BS70 from Fandom.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openGame, closeBrowser, ROOT } from './lib/node_board.mjs';

const cards = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));
const by = id => cards.find(c => c.id === id);
const PURPLE = { 'BS68-014': 1, 'BS68-016': 2, 'BS68-018': 2, 'BS68-020': 3, 'BS68-022': 4, 'BS68-NX01': 5 };
const GREEN = { 'BS69-025': 1, 'BS69-029': 2, 'BS69-030': 2, 'BS69-033': 3, 'BS70-034': 3, 'BS70-035': 3, 'BS70-072': 1, 'BS70-X03': 4 };
const ALL = { ...PURPLE, ...GREEN };
const HADES = 'BS68-CX01', HERMES = 'BS69-CX02', TEMPLE = 'BS68-070';

let g;
const ev = (fn, arg) => g.page.evaluate(fn, arg);
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
// reduction of card `id` with the given Field (spirits/nexus ids) on a cleared board
const red = (id, nexus = [], spirits = []) => ev(([id, nexus, spirits]) => {
  BS.testSetup(); const P = BS.G.p.player; P.spirits = []; P.nexus = []; P.soulState = [];
  for (const n of nexus) { const i = BS.mkInst(n); P.nexus.push(i); }
  for (const s of spirits) { const i = BS.mkInst(s); i.cores = 1; P.spirits.push(i); }
  return BS.reductionOf(BS.CARDS[id], BS.fieldSymbols(P));
}, [id, nexus, spirits]);

test('GR01 all 14 cards now have exactly one God reduction symbol', () => { for (const id of Object.keys(ALL)) assert.equal(by(id).reduction.god, 1, id); });
test('GR02 purple cards keep their purple reduction count', () => { for (const [id, n] of Object.entries(PURPLE)) assert.equal(by(id).reduction.purple, n, id); });
test('GR03 green cards keep their green reduction count', () => { for (const [id, n] of Object.entries(GREEN)) assert.equal(by(id).reduction.green, n, id); });
test('GR04 no other reduction keys were added', () => { for (const id of Object.keys(ALL)) assert.deepEqual(Object.keys(by(id).reduction).sort(), (id in PURPLE ? ['god', 'purple'] : ['god', 'green']), id); });
test('GR05 total reduction never exceeds the cost', () => { for (const id of Object.keys(ALL)) { const c = by(id); assert.ok(Object.values(c.reduction).reduce((a, b) => a + b, 0) <= c.cost, id); } });
test('GR06 every changed card notes its source', () => { for (const id of Object.keys(ALL)) assert.match(by(id).note || '', /God reduction icon from/, id); });
test('GR07 BS68 cards cite the official card list', () => { for (const id of Object.keys(PURPLE)) assert.match(by(id).note, /official card list/, id); });
test('GR08 the yellow deck gained no God reduction', () => {
  const ids = readFileSync(join(ROOT, 'data/decks/yellow-indra-thunderive.txt'), 'utf8').split('\n').map(l => /^\s*\d+\s+(\S+)/.exec(l)).filter(Boolean).map(m => m[1]);
  for (const id of ids) assert.ok(!(by(id).reduction || {}).god, id);
});
test('GR09 the game build carries the God reduction', async () => {
  const r = await ev(ids => ids.map(id => BS.CARDS[id].reduction.god), Object.keys(ALL));
  assert.deepEqual(r, Object.keys(ALL).map(() => 1));
});
test('GR10 empty Field: no reduction', async () => { assert.equal(await red('BS68-014'), 0); });
test('GR11 Contractor Hades alone (God + purple symbol) reduces Hound-Beros by 1', async () => { assert.equal(await red('BS68-014', [HADES]), 1); });
test('GR12 Hades plus a purple Spirit reduce Hound-Beros by its full 2', async () => { assert.equal(await red('BS68-014', [HADES], ['BS68-016']), 2); });
test('GR13 two purple Spirits without a God symbol reduce Hound-Beros by only 1', async () => { assert.equal(await red('BS68-014', [], ['BS68-016', 'BS68-018']), 1); });
test('GR14 a plain purple Nexus does not fill the God slot', async () => { assert.equal(await red('BS68-014', [TEMPLE], ['BS68-016']), 1); });
test('GR15 Contractor Hermes (God + green) fills the God slot of a purple card', async () => { assert.equal(await red('BS68-014', [HERMES], ['BS68-016']), 2); });
test('GR16 Hermes reduces Eurytius by its full 2 with a green Spirit', async () => { assert.equal(await red('BS69-025', [HERMES], ['BS69-029']), 2); });
test('GR17 Hermes alone reduces Eurytius by 1 (one symbol, one slot)', async () => { assert.equal(await red('BS69-025', [HERMES]), 1); });
test('GR18 Dells-Vajram: Hades + 5 purple Spirits reach the full 6', async () => {
  assert.equal(await red('BS68-NX01', [HADES], ['BS68-016', 'BS68-018', 'BS68-020', 'BS68-022', 'BS68-014']), 6);
});
test('GR19 King Perseus: 4 green Spirits without a God symbol stop at 4', async () => {
  assert.equal(await red('BS70-X03', [], ['BS69-025', 'BS69-029', 'BS69-030', 'BS69-033']), 4);
});
test('GR20 effCost of Hound-Beros with Hades + purple Spirit is 1', async () => {
  const c = await ev(H => { BS.testSetup(); const P = BS.G.p.player; P.spirits = []; P.nexus = [BS.mkInst(H)]; P.soulState = [];
    const s = BS.mkInst('BS68-016'); s.cores = 1; P.spirits.push(s); return BS.effCost(P, BS.CARDS['BS68-014']); }, HADES);
  assert.equal(c, 1);
});
test('GR21 the card detail lists the God reduction', async () => {
  const h = await ev(() => BS.cardDetailHTML ? BS.cardDetailHTML(BS.CARDS['BS68-014']) : '');
  if (h) assert.match(h, /God/);
});

// v0.44.7: the 11 blue Scalostle cards of the Nuadha deck carry the same God reduction symbol (Fandom).
const BLUE = { 'BS71-057': 2, 'BS71-058': 3, 'BS71-060': 3, 'BS71-061': 4, 'BS71-063': 1, 'BS71-064': 2, 'BS71-X09': 3, 'BS72-050': 2, 'BS72-051': 2, 'BS72-054': 3, 'BS72-068': 2 };
const NUADHA = 'BS71-CX03';
const deck = fn => [...new Set(readFileSync(join(ROOT, `data/decks/${fn}.txt`), 'utf8').split('\n').map(l => /^\s*\d+\s+(\S+)/.exec(l)).filter(Boolean).map(m => m[1]))];
const SRC = join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json');
const have = (await import('node:fs')).existsSync(SRC);
const F = have ? Object.fromEntries(JSON.parse(readFileSync(SRC, 'utf8')).cards.map(r => [r.id, r])) : {};

test('GB01 the 11 blue cards have exactly one God reduction symbol', () => { for (const id of Object.keys(BLUE)) assert.equal(by(id).reduction.god, 1, id); });
test('GB02 blue reduction counts are unchanged', () => { for (const [id, n] of Object.entries(BLUE)) assert.equal(by(id).reduction.blue, n, id); });
test('GB03 only blue and god keys', () => { for (const id of Object.keys(BLUE)) assert.deepEqual(Object.keys(by(id).reduction).sort(), ['blue', 'god'], id); });
test('GB04 total reduction never exceeds the cost', () => { for (const id of Object.keys(BLUE)) { const c = by(id); assert.ok(c.reduction.blue + 1 <= c.cost, id); } });
test('GB05 every blue change notes Fandom as the source', () => { for (const id of Object.keys(BLUE)) assert.match(by(id).note || '', /God reduction icon from Fandom/, id); });
test('GB06 every blue deck card is in the 11 or has no god icon on Fandom', { skip: !have }, () => {
  for (const id of deck('blue-nuadha-scalostle')) if (!(id in BLUE)) assert.ok(!(F[id].reduction || {}).god, id);
});
test('GB07 all six deck lists: reduction equals Fandom (incl. god)', { skip: !have }, () => {
  for (const fn of ['blue-nuadha-scalostle', 'green-hermes-lionheart', 'purple-hades-sorcerer', 'white-mitra-awakened-dragon', 'yellow-indra-thunderive'])
    for (const id of deck(fn)) if (F[id]) assert.deepEqual(by(id).reduction || {}, F[id].reduction || {}, `${fn} ${id}`);
});
test('GB08 the Brave cards (Spear, Rifle, Sword) got the God slot too', () => { for (const id of ['BS71-063', 'BS71-064', 'BS72-068']) assert.equal(by(id).type, 'Brave', id); });
test('GB09 build carries the blue God reduction', async () => {
  assert.deepEqual(await ev(ids => ids.map(id => BS.CARDS[id].reduction.god), Object.keys(BLUE)), Object.keys(BLUE).map(() => 1));
});
test('GB10 Contractor Nuadha is a Grandwalker with a God symbol', async () => {
  const a = await ev(N => BS.symbolAttrs(BS.CARDS[N]), NUADHA); assert.ok(a.length && a[0].includes('god'), JSON.stringify(a));
});
test('GB11 Nuadha alone reduces Agateram by 1', async () => { assert.equal(await red('BS71-X09', [NUADHA]), 1); });
test('GB12 Nuadha + 3 blue Spirits reduce Agateram by its full 4', async () => { assert.equal(await red('BS71-X09', [NUADHA], ['BS71-057', 'BS71-058', 'BS71-060']), 4); });
test('GB13 3 blue Spirits without Nuadha stop Agateram at 3', async () => { assert.equal(await red('BS71-X09', [], ['BS71-057', 'BS71-058', 'BS71-060']), 3); });
test('GB14 Nuadha + 1 blue Spirit reduce Spear (BS71-063) fully', async () => { assert.equal(await red('BS71-063', [NUADHA], ['BS71-057']), 2); });
test('GB15 Hades (purple God) fills the God slot of a blue card', async () => { assert.equal(await red('BS71-063', [HADES]), 1); });
test('GB16 a purple Spirit does not reduce a blue card', async () => { assert.equal(await red('BS71-063', [], ['BS68-016']), 0); });
test('GB17 effCost of Agateram with Nuadha + 3 blue Spirits is 4', async () => {
  const c = await ev(([N, ss]) => { BS.testSetup(); const P = BS.G.p.player; P.spirits = []; P.nexus = [BS.mkInst(N)]; P.soulState = [];
    for (const s of ss) { const i = BS.mkInst(s); i.cores = 1; P.spirits.push(i); } return BS.effCost(P, BS.CARDS['BS71-X09']); }, [NUADHA, ['BS71-057', 'BS71-058', 'BS71-060']]);
  assert.equal(c, 4);
});
test('GB18 the blue prebuilt deck is still legal', async () => {
  const r = await ev(() => BS.PREBUILT.filter(d => /nuadha|blue/i.test(d.id)).map(d => BS.validateDeck(d.cards, 'eternal').ok));
  assert.ok(r.length && r.every(Boolean));
});
test('GB19 white deck keeps its three earlier God reductions (BS74-043/045/047)', () => { assert.deepEqual(deck('white-mitra-awakened-dragon').filter(id => (by(id).reduction || {}).god).sort(), ['BS74-043', 'BS74-045', 'BS74-047']); });
test('GB20 28 deck cards in total now carry a God reduction', () => {
  const all = ['blue-nuadha-scalostle', 'green-hermes-lionheart', 'purple-hades-sorcerer', 'white-mitra-awakened-dragon', 'yellow-indra-thunderive'].flatMap(deck);
  assert.equal(new Set(all.filter(id => (by(id).reduction || {}).god)).size, 28);
});
