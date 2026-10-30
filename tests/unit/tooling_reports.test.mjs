// Card-session prep reports (suggestions #1 and #2, added with the residual-blockers + compiler-wiring tools):
// the machine-readable planning artifacts stay fresh. Not in the smoke loop set (the residual recompute is heavier);
// they run in the full set (pre-push) and CI, like the other generated-report ratchets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('data/glossary/residual-tags.json is up to date (run python3 tools/residual_tags.py)', () => {
  const out = execFileSync('python3', ['tools/residual_tags.py', '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
});

test('docs/reports/compiler-wiring.md is up to date (run node tools/compiler_wiring.mjs)', () => {
  const out = execFileSync('node', ['tools/compiler_wiring.mjs', '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
});

test('residual_tags --block A reports the open tags of the Standard partial cards', () => {
  const out = execFileSync('python3', ['tools/residual_tags.py', '--block', 'A'], { encoding: 'utf8' });
  assert.match(out, /block A: \d+ partial cards, \d+ with one open tag, greedy order of \d+ tags/);
});
