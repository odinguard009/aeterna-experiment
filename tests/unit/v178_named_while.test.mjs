// v0.178.0: "While/If you control a "X"-named Spirit" and "Also, if ..." lead conditions compile to fxIf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_v2 as c\n${code}`], { cwd: ROOT, encoding: 'utf8' }));

test('V178-01 "X"-named Spirit condition = controlName; "While ..., also" gates the next sentence', () => {
  assert.deepEqual(py(`print(json.dumps(c.cond_of('you control any "Strike"-named Spirit')))`), { controlName: 'Strike' });
});
