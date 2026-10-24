// v0.117.0: the offline-single-file invariant, checked in the quick loop again.
// Until v0.116.0 it lived only in the Python Regression (cleanup_review_tests D2 and seed_replay [5], both members of
// NO_FIXTURES), so the ONLINE mode landing in v0.108.0-v0.109.0 broke it without any local or CI signal: every tag
// Regression run from v0.108.0 to v0.116.0 came back red on exactly those two checks (D2 "source has no
// fetch/XHR/WebSocket/eval/Function constructor" and [5] "game logic no longer uses Math.random"). The invariant is still
// real - offline play must never touch the network and only the seed generator may use Math.random - it just has to name
// the one opt-in exception, the online modules, instead of forbidding the feature.
// The pattern counts CALL SITES, not the bare words: the How-to-play text names the "WebSocket" the online room uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, srcParts } from '../../tools/src_parts.mjs';

const NET = /\bfetch\s*\(|\bWebSocket\s*\(|XMLHttpRequest|\beval\s*\(|new\s+Function\s*\(|sendBeacon\s*\(|importScripts\s*\(/g;
const hits = s => (s.match(NET) || []).length;
const parts = srcParts(ROOT).map(p => ({ ...p, src: readFileSync(join(ROOT, p.rel), 'utf8') }));
// The only sources allowed to reach the network: the online match terminal and the lobby/account panel beside it. Both are
// reached only from the Play page's ONLINE mode (13i/13j), never from a local match, so a plain file:// game stays offline.
const ONLINE = ['13i-online.js', '13j-online-lobby.js'];
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

test('OB-01 the engine and protocol parts never touch the network or eval', () => {
  const bad = parts.filter(p => p.rel.startsWith('packages/') && hits(p.src)).map(p => p.name + ':' + hits(p.src));
  assert.deepEqual(bad, [], 'engine/protocol must stay network-free and eval-free');
});

test('OB-02 only the two opt-in online modules make network calls', () => {
  const bad = parts.filter(p => p.rel.startsWith('apps/') && !ONLINE.includes(p.name) && hits(p.src)).map(p => p.name + ':' + hits(p.src));
  assert.deepEqual(bad, [], 'no other UI part may fetch, open a socket or eval');
  for (const name of ONLINE) assert.ok(parts.find(p => p.name === name), `missing part ${name}`);
});

test('OB-03 every network call in the built page comes from those two modules', () => {
  const fromOnline = parts.filter(p => ONLINE.includes(p.name)).reduce((n, p) => n + hits(p.src), 0);
  assert.ok(fromOnline > 0, 'the online modules should be the ones carrying the calls');
  assert.equal(hits(html), fromOnline, 'the template, the card pack or another part added a network call');
});

test('OB-04 Math.random is the seed generator only (one call, in 00-config.js)', () => {
  assert.equal((html.match(/Math\.random\(/g) || []).length, 1, 'a second Math.random call breaks seeded replays');
  const owners = parts.filter(p => p.src.includes('Math.random(')).map(p => p.name);
  assert.deepEqual(owners, ['00-config.js'], 'the seed generator lives in 00-config.js');
});

test('OB-05 an online match starts only from the two online modules', () => {
  // onlineStart is the single entry (the lobby's quick match / private room); no engine or local-match path may call it.
  const callers = parts.filter(p => !ONLINE.includes(p.name) && /\bonlineStart\s*\(/.test(p.src)).map(p => p.name);
  assert.deepEqual(callers, [], 'only the online modules may start an online match');
});
