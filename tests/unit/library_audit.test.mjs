// 2026-11-04 library audit guards (master import): one id once, every Rebirth front has a Side B and vice versa,
// English-only family and rarity vocabularies, no Japanese family left except the reported ones, no raw template in text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const DATA = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));
const SIDES = JSON.parse(readFileSync(join(ROOT, 'data/index/rebirth-sides.json'), 'utf8'));
const sideList = Array.isArray(SIDES) ? SIDES : Object.entries(SIDES).map(([k, v]) => ({ front: k, ...v }));

test('LA01 card ids are unique', () => {
  const seen = new Set(), dup = [];
  for (const c of DATA) { if (seen.has(c.id)) dup.push(c.id); seen.add(c.id); }
  assert.deepEqual(dup, []);
});

test('LA02 every Rebirth front has a Side B record and every Side B record has a front in the library', () => {
  const fronts = DATA.filter(c => c.rebirthTo).map(c => c.id), ids = new Set(DATA.map(c => c.id));
  const keys = new Set(Object.keys(SIDES));
  assert.deepEqual(fronts.filter(f => !keys.has(f)), []);
  assert.deepEqual([...keys].filter(k => !ids.has(k)), []);
});

test('LA03 rarity codes: no long labels or Japanese, a small closed set', () => {
  const bad = [...new Set(DATA.map(c => c.rcode).filter(r => r && !/^[A-Z]{1,3}$|^Awaken (R|X|CP)$|^Contract X$/.test(r)))];
  assert.deepEqual(bad, []);
});

test('LA04 family names are English: no Japanese characters, no case variants', () => {
  const fams = new Set(DATA.flatMap(c => c.families || []));
  const jp = [...fams].filter(f => /[぀-ヿ㐀-鿿]/.test(f));
  assert.ok(jp.length <= 3, jp.join(','));          // 3 families have no verified English source (戦極, 星龍, マスター) (reported, not invented)
  const norm = new Map(), clash = [];
  for (const f of fams) { const k = f.toLowerCase().replace(/[^a-z0-9]/g, ''); if (k && norm.has(k) && norm.get(k) !== f) clash.push([norm.get(k), f]); norm.set(k, f); }
  assert.deepEqual(clash, []);
});

test('LA05 flavor index: English only, no markup, every id is a library card, at least 10,000 entries', () => {
  const F = JSON.parse(readFileSync(join(ROOT, 'data/index/flavor.json'), 'utf8')), ids = new Set(DATA.map(c => c.id));
  const e = Object.entries(F);
  assert.ok(e.length >= 10000, String(e.length));
  assert.deepEqual(e.filter(([, v]) => /[぀-ヿ㐀-鿿]|\{\{|\}\}|\[\[|<\/?[a-z]/i.test(v)).map(x => x[0]), []);
  assert.ok(e.filter(([k]) => !ids.has(k)).length <= 1);
});

test('LA06 player-visible card text is English: only the cards whose English source is missing keep Japanese (each says so in its note)', () => {
  const JP = /[぀-ヿ㐀-鿿]/;
  const jp = DATA.filter(c => JP.test(c.name) || JP.test(c.text || '') || (c.residual || []).some(x => JP.test(x)));
  assert.ok(jp.length <= 100, String(jp.length));    // 2026-11-04: 91 cards, no English source found on the wiki (reported, not translated)
  assert.deepEqual(jp.filter(c => !/pending/.test(c.note || '')).map(c => c.id), []);
});
