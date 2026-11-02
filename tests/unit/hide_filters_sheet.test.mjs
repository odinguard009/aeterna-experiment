// HF1: on a phone the Hide/Show filters button is hidden while the deck sheet is open (normal or maximized), so it never covers the sheet's minimize button.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('apps/web/mk-glue.css', 'utf8');
const js = readFileSync('apps/web/src/13a-deckbuilder.js', 'utf8');

test('HF1 the filters button is hidden under an open deck sheet unless the sheet is minimized', () => {
  assert.match(css, /html:not\(\.layout-pc\) \.mk #view-deckbuilder\.db-open-deck:not\(\[data-dsize="min"\]\) #db-tbar \.r1>#db-min\{display:none\}/);
});

test('HF2 dbSheet keeps the classes and the size attribute the rule reads', () => {
  assert.match(js, /vw\.classList\.toggle\('db-open-deck', which === 'deck'\)/);
  assert.match(js, /vw\.dataset\.dsize = next/);
});
