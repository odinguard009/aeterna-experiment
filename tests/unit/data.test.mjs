// Card data, glossary and rule knowledge base integrity (no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const js = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const cards = js('build/all-cards.json');
const COLORS = new Set(['red', 'purple', 'green', 'white', 'yellow', 'blue']);
const TYPES = new Set(['Spirit', 'Nexus', 'Magic', 'Brave', 'Ultimate']);

test('D01 card ids are unique', () => {
  const ids = cards.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});
test('D02 every card has the required fields', () => {
  for (const c of cards) for (const k of ['id', 'name', 'type', 'color', 'cost', 'symbols', 'levels', 'families', 'text', 'image', 'block', 'saga', 'reduction'])
    assert.ok(k in c, `${c.id} misses ${k}`);
});
test('D03 card type and colour are known values', () => {
  for (const c of cards) { assert.ok(TYPES.has(c.type), `${c.id} type ${c.type}`); assert.ok(COLORS.has(c.color), `${c.id} color ${c.color}`); }
});
test('D04 cost and symbols are whole numbers >= 0', () => {
  for (const c of cards) { assert.ok(Number.isInteger(c.cost) && c.cost >= 0, c.id); assert.ok(Number.isInteger(c.symbols) && c.symbols >= 0, c.id); }
});
test('D05 reduction uses known colours (or the god / Ultimate symbol) and whole numbers >= 1', () => {
  for (const c of cards) for (const [k, n] of Object.entries(c.reduction)) { assert.ok(COLORS.has(k) || k === 'god' || k === 'ultimate', `${c.id} ${k}`); assert.ok(Number.isInteger(n) && n >= 1, `${c.id} ${k}=${n}`); }
});
test('D06 Spirit levels: core thresholds strictly ascending, BP never negative', () => {
  for (const c of cards.filter(x => x.type === 'Spirit')) {
    assert.ok(c.levels.length >= 1, c.id);
    for (let i = 0; i < c.levels.length; i++) {
      const L = c.levels[i];
      assert.ok(Number.isInteger(L.cores) && L.cores >= 0, `${c.id} LV${i + 1}`);
      if (i) assert.ok(L.cores > c.levels[i - 1].cores, `${c.id} LV${i + 1} cores not ascending`);
      if (L.bp != null) assert.ok(L.bp >= 0, `${c.id} LV${i + 1} bp`);
    }
  }
});
test('D07 Saga placement: BS75 -> Saga 16, BS76 -> Saga 17 (user rule)', () => {
  for (const c of cards) {
    if (c.id.startsWith('BS75')) assert.equal(Number(c.saga), 16, c.id);
    if (c.id.startsWith('BS76')) assert.equal(Number(c.saga), 17, c.id);
  }
});
test('D08 the Saga files together are exactly build/all-cards.json', () => {
  const files = readdirSync(join(ROOT, 'data/cards')).filter(f => /^saga-\d+\.json$/.test(f));
  const ids = files.flatMap(f => js('data/cards/' + f).map(c => { assert.equal(Number(c.saga), Number(f.match(/\d+/)[0]), `${c.id} in ${f}`); return c.id; }));
  assert.deepEqual(ids.slice().sort(), cards.map(c => c.id).sort());
});
test('D09 card numbers look like official numbers (set prefix + number)', () => {
  for (const c of cards) assert.match(c.id, /^(BS|SD|CB|BSC|LM|PB|P|X|26R[A-Z]+)\d+-[A-Z]*\d+$/, c.id);
});
test('D10 every glossary entry has a unique id and a compilable pattern', () => {
  const g = js('data/glossary/effects.json'), ids = new Set();
  for (const e of g) {
    assert.ok(e.id && !ids.has(e.id), `duplicate/missing id ${e.id}`); ids.add(e.id);
    assert.doesNotThrow(() => new RegExp(e.pattern), e.id);
  }
});
test('D10b glossary "rule" notes: no new entry without one; the known-gaps list only shrinks', () => {
  const g = js('data/glossary/effects.json'), known = new Set(js('tests/unit/known-gaps.json').glossaryWithoutRule);
  const missing = g.filter(e => !(typeof e.rule === 'string' && e.rule.trim().length > 5)).map(e => e.id);
  assert.deepEqual(missing.filter(id => !known.has(id)), [], 'new glossary entries need a rule note citing the manual');
  assert.deepEqual([...known].filter(id => !missing.includes(id)), [], 'these now have a rule note: remove them from tests/unit/known-gaps.json');
});
test('D10c every glossary rule note cites an official source or says Engine (mirrors Python v21 [20], caught only in Regression before v0.45)', () => {
  const bad = js('data/glossary/effects.json').filter(g => g.rule && !/Rule Manual|Comprehensive|Eternal|Standard|Engine/.test(g.rule)).map(g => g.id);
  assert.deepEqual(bad, []);
});
test('D11 card-tags.json is up to date with the glossary (run tools/tag_effects.py)', () => {
  const g = js('data/glossary/effects.json'), tags = js('data/glossary/card-tags.json');
  for (const c of cards) {
    const want = g.filter(e => new RegExp(e.pattern).test(c.text || '')).map(e => e.id);
    assert.deepEqual(tags[c.id] || [], want, c.id);
  }
});
test('D12 rule obligations check reports no problems', () => {
  const out = execFileSync('python3', [join(ROOT, 'tools/check_obligations.py')]).toString();
  assert.match(out, /problems 0/);
});
test('D14 rules audit runs and every hand-set verdict is valid and matches an item (tools/rules_audit.py, v0.55.1)', () => {
  const v = js('docs/rules-audit-verdicts.json');
  for (const i of v.items) assert.ok(['confirmed', 'house', 'conflict', 'open'].includes(i.verdict) && i.source, i.match);
  const out = execFileSync('python3', [join(ROOT, 'tools/rules_audit.py'), '--line']).toString();
  assert.match(out, /^rules audit \d{4}-\d\d-\d\d: \d+ items/);
});
test('D13 cards with "effects" data also carry the printed text they were wired from', () => {
  for (const c of cards.filter(x => x.effects)) assert.ok((c.text || '').length > 10, c.id);
});
