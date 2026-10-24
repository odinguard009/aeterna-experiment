// Engine coverage ratchet (tools/coverage.mjs): the baseline, its flows and the generated
// report stay consistent. The measurement itself (V8 coverage over ten headless matches,
// ~20 s) runs in CI and on demand (`npm run coverage`), not in the quick loop; these checks
// are the cheap half, so a rename or a real drop cannot slip through unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';
import { srcParts } from '../../tools/src_parts.mjs';
import { FLOWS } from '../../tools/coverage.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const base = JSON.parse(read('tools/coverage-baseline.json'));
const parts = new Map(srcParts(ROOT).map((p) => [p.rel, p]));

test('CV01 every part in the coverage baseline still exists', () => {
  const gone = Object.keys(base.parts).filter((rel) => !parts.has(rel));
  assert.deepEqual(gone, [], `baseline names parts that no longer exist (rename or removal: update tools/coverage-baseline.json in the same commit): ${gone.join(', ')}`);
});

test('CV02 baseline numbers are whole floors and the note says it is a floor', () => {
  for (const [rel, n] of Object.entries(base.parts)) assert.ok(Number.isInteger(n) && n >= 0, `${rel}=${n}`);   // 0 = a part these flows never enter (a legitimate floor)
  assert.match(base.note, /only rise/);
});

test('CV03 the baseline was taken with the current flow set', () => {
  assert.equal(base.flows, FLOWS.length, 'tools/coverage-baseline.json is older than tools/coverage.mjs FLOWS (rerun npm run coverage -- --update)');
  for (const f of FLOWS) {
    assert.ok(Number.isInteger(f.seed) && f.deckA && f.deckB, `flow without a fixed seed or deck: ${JSON.stringify(f)}`);
    assert.ok(f.format === 'eternal' || f.format === 'standard', `flow without a known format: ${JSON.stringify(f)}`);
  }
});

test('CV04 the generated coverage report matches the baseline', () => {
  const p = 'docs/reports/engine-coverage.md';
  assert.ok(existsSync(join(ROOT, p)), `${p} is missing (node tools/coverage.mjs --update --report)`);
  const md = read(p);
  const want = Object.values(base.parts).reduce((a, b) => a + b, 0);
  const m = /(\d+)\/(\d+) names = \*\*(\d+)%\*\*/.exec(md);
  assert.ok(m, 'the report lost its total line');
  assert.equal(Number(m[1]), want, 'the report is stale (rerun node tools/coverage.mjs --update --report)');
  const named = Object.keys(base.parts).length;
  assert.equal(md.split('\n').filter((l) => l.startsWith('| `packages/') || l.startsWith('| `tools/')).length, named, 'the report lists a different set of parts than the baseline');
});
