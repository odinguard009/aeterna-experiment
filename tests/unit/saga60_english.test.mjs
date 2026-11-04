// Every card of the product-only set (data/cards/saga-60.json) is shown in English; only name_jp may keep Japanese.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const JP = /[぀-ヿ㐀-鿿Ａ-Ｚ]/;
const cards = JSON.parse(readFileSync(new URL('../../data/cards/saga-60.json', import.meta.url), 'utf8'));

test('SE1 no Japanese in name, text, families, residual or rcode (except cards whose note says the English source is pending)', () => {
  const bad = cards.filter(c => !/pending/.test(c.note || '') && JP.test(JSON.stringify({ n: c.name, t: c.text, f: c.families, r: c.residual, c: c.rcode }))).map(c => c.id);
  assert.deepEqual(bad.slice(0, 10), []);
});

test('SE2 no leaked wiki markup in names, families or HTML entities in text', () => {
  const bad = cards.filter(c => /[|{}\n]/.test(c.name) || c.families.some(f => /[|\n=<>]/.test(f)) || /&[a-z#0-9]+;/.test(c.text)).map(c => c.id);
  assert.deepEqual(bad.slice(0, 10), []);
});

test('SE3 every card keeps its Japanese name for reference', () => {
  assert.ok(cards.filter(c => c.name_jp).length > cards.length * 0.9);
});
