// Lane K packet tool: the summary and the next bundle come from data/cards + the residual tags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';

const run = (args) => spawnSync(process.execPath, ['tools/lane_k_packet.mjs', ...args], { encoding: 'utf8' });

test('K-PKT summary reports live card counts and the next tags', () => {
  const r = run(['--summary']);
  assert.equal(r.status, 0, r.stderr);
  const kv = Object.fromEntries(r.stdout.trim().split('\n').map((l) => l.split('=')));
  assert.equal(kv.total, '8709');
  assert.ok(Number(kv.complete) > 1000);
  assert.ok(Number(kv.blockA_partial) >= 0);
  assert.match(kv.next_tags, /[A-Z]/);
});

test('K-PKT packet names cards with their text and open tags', () => {
  const out = 'build/lane-k-packet.test.md';
  const r = run(['--cards', '3', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(out));
  const packet = readFileSync(out, 'utf8');
  const cards = packet.match(/^## \d+\. /gm) || [];
  assert.ok(cards.length >= 1 && cards.length <= 3, 'packet card count');
  assert.match(packet, /open tags:/);
  unlinkSync(out);
});
