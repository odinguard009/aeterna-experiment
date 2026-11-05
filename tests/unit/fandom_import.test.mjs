// v0.36 card data intake: tools/import_fandom.py output (data/import/saga-NN.json) and its report.
// Staging data only: the game never loads it, so these are plain data tests (no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const js = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const files = readdirSync(join(ROOT, 'data/import')).filter(f => /^saga-\d+\.json$/.test(f)).sort();
const bySaga = Object.fromEntries(files.map(f => [Number(f.match(/\d+/)[0]), js('data/import/' + f)]));
const all = Object.values(bySaga).flat();
const report = js('data/import/report.json');
const curated = new Set(readdirSync(join(ROOT, 'data/cards')).filter(f => /^saga-\d+\.json$/.test(f)).flatMap(f => js('data/cards/' + f).map(c => c.id)));
const a1 = new Set(readdirSync(join(ROOT, 'data/cards')).filter(f => /^saga-\d+\.json$/.test(f)).flatMap(f => js('data/cards/' + f)).filter(c => (c.residual || []).length && /Partial card \(v0\.79\.0/.test(c.note || '')).map(c => c.id));      // v0.79.0 (A1)
const COLORS = new Set(['red', 'purple', 'green', 'white', 'yellow', 'blue']);
const TYPES = new Set(['Spirit', 'Nexus', 'Magic', 'Brave', 'Ultimate']);
const SAGA_END = [[9, 1], [13, 2], [18, 3], [23, 4], [30, 5], [34, 6], [39, 7], [43, 8], [47, 9], [51, 10], [55, 11], [59, 12], [63, 13], [67, 14], [71, 15], [75, 16], [77, 17]];
const sagaOf = n => SAGA_END.find(([end]) => n <= end)[1];
const isStd = c => /^26R/.test(c.set);              // v0.62.0: Standard block A lives in saga-50.json (block "A")
const eternal = all.filter(c => !isStd(c));
const noImage = new Set(report.image_problems.map(p => p.id));

test('I01 one staging file per Saga 1-17, plus 50 for Standard block A', () => {
  assert.deepEqual(Object.keys(bySaga).map(Number), [...Array.from({ length: 17 }, (_, i) => i + 1), 50]);
});
test('I02 card numbers are unique across all files', () => {
  assert.equal(new Set(all.map(c => c.id)).size, all.length);
});
test('I03 every card sits in the file of its Saga', () => {
  for (const [s, cards] of Object.entries(bySaga)) for (const c of cards) assert.equal(c.saga, Number(s), c.id);
});
test('I04 Saga follows the set number (BS75 -> 16, BS76/77 -> 17, 26R* -> 50)', () => {
  for (const c of all) assert.equal(c.saga, isStd(c) ? 50 : sagaOf(Number(c.set.slice(2))), c.id);
});
test('I05 required fields are present on every card', () => {
  for (const c of all) for (const k of ['id', 'name', 'type', 'color', 'colors', 'cost', 'reduction', 'symbols', 'levels', 'families', 'text', 'rarity', 'flags', 'image', 'block', 'saga', 'status'])
    assert.ok(k in c, `${c.id} misses ${k}`);
});
test('I06 type is one of the five engine types', () => {
  for (const c of all) assert.ok(TYPES.has(c.type), `${c.id} ${c.type}`);
});
test('I07 colour is a known lowercase colour and listed in colors', () => {
  for (const c of all) { assert.ok(COLORS.has(c.color), `${c.id} ${c.color}`); assert.equal(c.colors[0], c.color, c.id); }
});
test('I08 cost is a whole number >= 0 (4 rows without cost are reported by the wiki)', () => {
  const bad = all.filter(c => !(Number.isInteger(c.cost) && c.cost >= 0));
  assert.ok(bad.length <= 4, bad.map(c => c.id).join());
});
test('I09 symbols are whole numbers >= 0', () => {
  for (const c of all) assert.ok(Number.isInteger(c.symbols) && c.symbols >= 0, c.id);
});
test('I10 reduction uses known colours and whole numbers >= 1', () => {
  for (const c of all) for (const [k, n] of Object.entries(c.reduction)) { assert.ok(COLORS.has(k) || k === 'ultimate' || k === 'god', `${c.id} ${k}`); assert.ok(Number.isInteger(n) && n >= 1, c.id); }
});
test('I11 level core thresholds ascend (wiki errors are listed in the report) and BP is never negative', () => {
  const listed = new Set(report.level_problems.map(p => p.id));
  assert.ok(listed.size <= 5);
  for (const c of all) c.levels.forEach((L, i) => {
    assert.ok(Number.isInteger(L.cores) && L.cores >= 0, `${c.id} LV${i + 1}`);
    if (i && !listed.has(c.id)) assert.ok(L.cores > c.levels[i - 1].cores, `${c.id} LV${i + 1} not ascending (wiki error? not in the report)`);
    if (L.bp != null) assert.ok(L.bp >= 0, `${c.id} bp`);
  });
});
test('I12 card numbers look like official numbers (BS12-034, BS02-X01, promo CP13-01)', () => {
  for (const c of all) assert.match(c.id, /^[0-9A-Z]+\d+-[0-9A-Z]+$/, c.id);
});
test('I13 block equals the set number of the booster set (Standard: "A")', () => {
  for (const c of all) assert.equal(c.block, isStd(c) ? 'A' : c.set.slice(2), c.id);
});
test('I14 every card has an image unless the report lists it', () => {
  for (const c of all) assert.ok(c.image || noImage.has(c.id), `${c.id} ${c.name} has no image and is not in the report`);
});
test('I15 every report entry without image really has no image field', () => {
  for (const c of all) if (noImage.has(c.id)) assert.ok(!c.image || report.image_problems.find(p => p.id === c.id).problem.startsWith('ambiguous in set'), c.id);
});
test('I16 image file names have a known extension', () => {
  for (const c of all) if (c.image) assert.match(c.image, /\.(png|jpe?g|gif|webp)$/i, c.id);
});
test('I17 most Eternal cards are matched to an image (>= 93%, at most 460 staged cards without one)', () => {
  // v0.59: an absolute bound too, because promoting cards (which have images) lowers the staged ratio although nothing got worse
  // v0.62.0: Standard block A is not in the image index yet (its cards are listed in the report like any card without image)
  const withImg = eternal.filter(c => c.image).length;
  assert.ok(withImg / eternal.length >= 0.93 && eternal.length - withImg <= 460, `${withImg}/${eternal.length}`);
});
test('I18 cards of data/cards (hand-verified) are not duplicated in staging', () => {
  for (const c of all) assert.ok(!curated.has(c.id) || a1.has(c.id), c.id);      // v0.79.0 (A1): partial cards keep their staging record
  assert.equal(report.skipped_curated.length, report.stats.skipped_curated);
  for (const id of report.skipped_curated) assert.ok(curated.has(id), id);
});
test('I19 staging cards carry status imported and are not verified yet', () => {
  for (const c of all) { assert.equal(c.status, 'imported', c.id); assert.equal(c.stats_verified, false, c.id); assert.equal(c.fxComplete, false, c.id); }
});
test('I20 duplicate card numbers were merged: rarities are a sorted list without repeats', () => {
  for (const c of all) { assert.ok(Array.isArray(c.rarity), c.id); assert.deepEqual(c.rarity, [...new Set(c.rarity)].sort(), c.id); }
  assert.ok(report.merged.length > 0);
});
test('I21 merged numbers kept one card each', () => {
  const ids = new Set(all.map(c => c.id));
  for (const id of report.merged) assert.ok(ids.has(id), id);
});
test('I22 number conflicts (same number, different cards) are reported with the card kept', () => {
  const by = Object.fromEntries(all.map(c => [c.id, c]));
  // a conflict whose card was completed and pruned from staging is history (BS73-AX03, v0.219.0)
  for (const k of report.number_conflicts.filter(k => by[k.id])) { assert.ok(k.names.length > 1, k.id); assert.equal(by[k.id].name, k.kept, k.id); assert.ok(k.names.includes(k.kept), k.id); }
});
test('I23 Token rows are left out (tokens live in data/cards/tokens.json)', () => {
  assert.equal(report.tokens.length, 3);              // v0.62.0: + one Standard block A Token Spirit row
  const ids = new Set(all.map(c => c.id));
  for (const id of report.tokens) assert.ok(!ids.has(id), id);
});
test('I24 Contract/Burst variants keep the base type and a flag', () => {
  const flagged = all.filter(c => c.flags.length);
  assert.ok(flagged.length >= 60);
  for (const c of flagged) assert.ok(TYPES.has(c.type), c.id);
  assert.ok(all.some(c => c.flags.includes('contract')) && all.some(c => c.flags.includes('burst')));
});
test('I25 the typo type "Spirt" was corrected', () => {
  const pack = js('build/all-cards.json');      // v0.52.0: promoted cards leave staging, so look in both
  for (const id of ['BS13-009', 'BS14-009']) assert.equal((all.find(c => c.id === id) || pack.find(c => c.id === id)).type, 'Spirit');
});
test('I26b wiki "gold" is mapped to the ultimate reduction symbol (v0.41.5); the wiki "god" icon is still dropped and reported', () => {
  assert.equal(all.find(c => c.id === 'CP14-X14R').reduction.ultimate, 1);
  assert.ok(!report.odd_reduction.some(o => o.id === 'CP14-X14R'));
  assert.ok(report.odd_reduction.some(o => o.id === 'BS44-005' && o.dropped.includes('god')));
});
test('I26 stats in the report add up to the files', () => {
  assert.equal(report.stats.cards, all.length);
  for (const [s, n] of Object.entries(report.stats.per_saga)) assert.equal(bySaga[s].length, n, 'saga ' + s);
  assert.equal(report.stats.without_image, all.filter(c => !c.image).length);
});
test('I27 report image problems point to real staged cards with a stated reason', () => {
  const ids = new Set(all.map(c => c.id));
  for (const p of report.image_problems) { assert.ok(ids.has(p.id), p.id); assert.match(p.problem, /^(no image|ambiguous)/, p.id); }
});
test('I28 Saga 1-11 images are named by card name (the file name starts with the card name or its near match)', () => {
  const sample = bySaga[1].filter(c => c.image).slice(0, 200);
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = sample.filter(c => norm(c.image).includes(norm(c.name).slice(0, 6))).length;
  assert.ok(hit / sample.length > 0.8, `${hit}/${sample.length}`);
});
test('I29 text is a string, never null', () => {
  for (const c of all) assert.equal(typeof c.text, 'string', c.id);
});
// data/sources is left out of the light sparse clone (see CLAUDE.md); the full CI checkout has it, so this still runs there.
const HAS_SOURCES = existsSync(join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json'));
test('I30 the importer is repeatable: --check gives the same totals as the committed report', { skip: HAS_SOURCES ? false : 'data/sources not checked out (light clone)' }, () => {
  const out = execFileSync('python3', [join(ROOT, 'tools/import_fandom.py'), '--check'], { encoding: 'utf8' });
  const stats = JSON.parse(out.trim().split('\n')[0]);
  assert.deepEqual(stats, report.stats);
});
test('I31 staging data is not part of the game pack', () => {
  const pack = js('build/all-cards.json');
  assert.ok(pack.every(c => !('status' in c) && !('stats_verified' in c) && !('source' in c)));     // v0.52.0: promotion copies only the kept fields (the pack grows with promotions)
  assert.ok(existsSync(join(ROOT, 'data/import/report.json')));
});
