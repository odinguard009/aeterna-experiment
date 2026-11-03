// Lane order (owner, 2026-10-21): phase F -> S1 Standard Magic (K) -> U/I queue -> K (Standard first).
// tools/lane_next.mjs decides the next lane from docs/ai/roadmap-open.md; CHANGELOG.md keeps the "- Lane:" bullet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { kHold, lanesOf, nextLane, uiQueue } from '../../tools/lane_next.mjs';

const log = (...lanes) => '# Changelog\n\nintro\n\n' + lanes.map((l, i) => `## v0.9.${lanes.length - i}\n${l ? `- Lane: ${l}\n` : ''}- notes\n`).join('\n');
const F = '- **F5 test waits = Q2:** x\n';
const S1 = '- **S1 Standard Magic (K):** x\n';
const Q = '- **U/I queue:** U5, U6, M6 server (owner order)\n';
const QE = '- **U/I queue:** (empty)\n';
const rm = (...parts) => '## L\n' + parts.join('');

test('LN01 the lane is read from the first Lane bullet; a release without one counts as U/I', () => {
  assert.deepEqual(lanesOf(log('K', 'U/I', null)), ['K', 'U/I', 'U/I']);
});

test('LN02 phase F open: always U/I, even with S1 and the queue listed', () => {
  assert.equal(nextLane(log('K', 'K'), rm(F, S1, Q)).lane, 'U/I');
});

test('LN03 after phase F: S1 (K) first, whatever the last lanes were', () => {
  assert.equal(nextLane(log('U/I', 'U/I'), rm(S1, Q)).lane, 'K');
  assert.equal(nextLane(log('K'), rm(S1, Q)).lane, 'K');
});

test('LN04 after S1: U/I while the queue names an item; parenthesised notes are ignored', () => {
  assert.deepEqual(uiQueue(rm(Q)), ['U5', 'U6', 'M6 server']);
  assert.equal(nextLane(log('K', 'K', 'K'), rm(Q)).lane, 'U/I');
  assert.match(nextLane(log(), rm(Q)).why, /U5 next, 3 left/);
});

test('LN05 queue empty or missing: K', () => {
  assert.deepEqual(uiQueue(rm(QE)), []);
  assert.equal(nextLane(log('U/I', 'U/I'), rm(QE)).lane, 'K');
  assert.equal(nextLane('# Changelog\n', rm()).lane, 'K');
});

test('LN06 the tool prints its one line when run as a script (was silent on Windows: file URL compare)', () => {
  const out = execFileSync(process.execPath, ['tools/lane_next.mjs'], { encoding: 'utf8' }).trim();
  assert.match(out, /^LANE (K|U\/I|HOLD) \(/);
});

test('LN07 owner hold on Lane K: K results become HOLD, U/I items are still taken', () => {
  const H = '- **Accepted, ON HOLD.** x\n';
  assert.equal(kHold(rm(H)), true);
  assert.equal(nextLane(log('K'), rm(QE, H)).lane, 'HOLD');
  assert.equal(nextLane(log('K'), rm(S1, H)).lane, 'HOLD');
  assert.equal(nextLane(log('K'), rm(Q, H)).lane, 'U/I');
  assert.equal(nextLane(log('K'), rm(QE)).lane, 'K');
});
