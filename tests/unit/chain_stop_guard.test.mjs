// The chain Stop hook (.claude/hooks/chain_stop_guard.py) in a throw-away git repo; the gate is replaced by AETERNA_CHAIN_STATUS_CMD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const HOOK = join(ROOT, '.claude/hooks/chain_stop_guard.py');
function repo(marker) {
  const d = mkdtempSync(join(tmpdir(), 'stopguard-'));
  const g = (...a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
  g('init', '-q'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x');
  if (marker) writeFileSync(join(d, '.git/aeterna-chain'), 'x');
  return { d, g };
}
function stop(d, status, ev = {}, env = {}) {
  const r = spawnSync('python3', ['-I', HOOK], { cwd: d, input: JSON.stringify(ev), encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: d, AETERNA_CHAIN_STATUS_CMD: status, ...env } });
  return { code: r.status, err: r.stderr };
}
const ON = "echo 'Mode rantai: ON | x'", OFF = "echo 'Mode rantai: OFF | x'";

test('S1 no marker: stop allowed, still logged', () => {
  const { d } = repo(false);
  assert.equal(stop(d, ON).code, 0);
  assert.match(readFileSync(join(d, '.git/aeterna-stop-log.jsonl'), 'utf8'), /"verdict": "allow"/);
});
test('S2 marker + chain ON: blocked with a reason', () => {
  const { d } = repo(true);
  const r = stop(d, ON);
  assert.equal(r.code, 2); assert.match(r.err, /do not end the turn/);
});
test('S3 marker + chain OFF: allowed', () => assert.equal(stop(repo(true).d, OFF).code, 0));
test('S4 gate error fails closed', () => assert.equal(stop(repo(true).d, 'exit 1').code, 2));
test('S5 background tasks running: allowed', () => assert.equal(stop(repo(true).d, ON, { background_tasks: [{ id: 'b1' }] }).code, 0));
test('S6 stuck loop: allowed after the cap without a new commit, blocked again after a commit', () => {
  const { d, g } = repo(true); const env = { AETERNA_STOP_MAX_BLOCKS: '2' };
  assert.equal(stop(d, ON, {}, env).code, 2); assert.equal(stop(d, ON, {}, env).code, 2);
  assert.equal(stop(d, ON, {}, env).code, 0);
  g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'y');
  assert.equal(stop(d, ON, {}, env).code, 2);
});
test('S7 outside a git repo: allowed', () => assert.equal(stop(mkdtempSync(join(tmpdir(), 'nogit-')), ON).code, 0));
