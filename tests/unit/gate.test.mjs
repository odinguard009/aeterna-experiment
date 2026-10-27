// The session gate evaluator with fixed inputs, no network (GATE_FIXTURE=1). Was gate_lanes.test.mjs (v0.63.1); the lane merge tooling left in v0.96.0.
// Lane-less markers are the flow in use; a marker with a lane word still blocks only that lane (the evaluator still reads it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { ROOT, BASH } from './lib/game.mjs';

const NOW = '2026-10-19T12:00:00Z';
const ago = (min) => new Date(Date.parse(NOW) - min * 60000).toISOString().replace('.000', '');
const rows = (list) => list.map(([min, body]) => `${ago(min)}\t${body}`).join('\n');
function gate(args, comments, commits = [], extraEnv = {}) {
  const r = spawnSync(BASH, [join(ROOT, 'tools/session_gate.sh'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, GATE_FIXTURE: '1', GATE_RANTAI_MAX: '600000', GATE_NOW: NOW, COMMENTS: rows(comments), COMMITS: rows(commits), STOP_FILE: '0', ...extraEnv },
  });
  return { out: r.stdout.trim(), code: r.status, err: r.stderr.trim() };
}
const ON = [600, 'ON'];
/* G21: the RANTAI-off post must fail as it would in CI, without touching gh and WITHOUT dropping python3 from PATH
   (the evaluator runs in python; a bare fake PATH broke it on Windows) — strip only gh from PATH. */
const NO_GH_PATH = (process.env.PATH || '').split(delimiter).filter(p => !/[/\\]gh(\.exe)?$/i.test(p) && !/GitHub\.cli/i.test(p)).join(delimiter);

test('G01 no session marker: free, check GO after the idle time', () => {
  assert.equal(gate(['busy'], [ON]).out, 'FREE');
  assert.equal(gate(['check', 'opus'], [ON]).out, 'GO');
});

test('G02 lane-less MANUAL blocks every lane; DONE releases it (old behaviour)', () => {
  const c = [ON, [30, 'MANUAL']];
  assert.equal(gate(['busy'], c).code, 3);
  assert.equal(gate(['busy', 'ui'], c).code, 3);
  assert.equal(gate(['busy', 'card'], c).code, 3);
  assert.match(gate(['check', 'opus'], c).out, /^STOP manual session running/);
  assert.equal(gate(['busy'], [...c, [25, 'DONE v0.63.1 next=Opus']]).out, 'FREE');
});

test('G03 a lane LOCK blocks its own lane and the whole repo, not the other lane', () => {
  const c = [ON, [40, 'LOCK ui']];
  const ui = gate(['busy', 'ui'], c);
  assert.equal(ui.code, 3); assert.match(ui.out, /^BUSY auto session \(ui lane\) running \(40 min\)/);
  assert.equal(gate(['busy', 'card'], c).out, 'FREE');
  assert.equal(gate(['busy'], c).code, 3, 'a lane-less session waits for every lane');
  assert.equal(gate(['check', 'opus', 'card'], c).out, 'GO');
  assert.match(gate(['check', 'opus', 'ui'], c).out, /^STOP auto session \(ui lane\)/);
});

test('G04 two lanes at once; UNLOCK <lane> ends only its lane', () => {
  const c = [ON, [90, 'MANUAL ui'], [80, 'LOCK card']];
  assert.equal(gate(['busy', 'ui'], c).code, 3);
  assert.equal(gate(['busy', 'card'], c).code, 3);
  const c2 = [...c, [60, 'UNLOCK ui']];
  assert.equal(gate(['busy', 'ui'], c2).out, 'FREE');
  assert.equal(gate(['busy', 'card'], c2).code, 3);
  assert.equal(gate(['busy', 'card'], [...c2, [50, 'UNLOCK card']]).out, 'FREE');
  assert.equal(gate(['busy', 'card'], [...c, [50, 'UNLOCK']]).out, 'FREE', 'a lane-less UNLOCK ends everything');
});

test('G05 stale lane marks expire like before (MANUAL 3 h, LOCK 5 h)', () => {
  assert.equal(gate(['busy', 'ui'], [ON, [200, 'MANUAL ui']]).out, 'FREE');
  assert.equal(gate(['busy', 'card'], [ON, [200, 'LOCK card']]).code, 3);
  assert.equal(gate(['busy', 'card'], [ON, [301, 'LOCK card']]).out, 'FREE');
});

test('G06 daily cap counts LOCKs of both lanes; unknown lane is refused', () => {
  const c = [[1000, 'ON'], ...[700, 650, 600, 550, 500, 450].map((m) => [m, m % 100 ? 'LOCK ui' : 'LOCK card']), [400, 'UNLOCK']];
  assert.match(gate(['check', 'opus'], c, [[420, 'v0.63.1: x']], { GATE_MAX_AUTO_24H: '6' }).out, /^STOP daily cap: 6/);
  assert.equal(gate(['check', 'opus'], c, [[420, 'v0.63.1: x']]).out, 'GO', 'no cap by default (owner, 2026-10-20)');
  const bad = gate(['busy', 'web'], [ON]);
  assert.equal(bad.code, 2); assert.match(bad.err, /unknown lane 'web'/);
});

test('G07 status names every running lane; manual in one lane is not stopped by a manual in the other', () => {
  const c = [ON, [20, 'MANUAL card']];
  assert.match(gate(['status'], c).out, /manual session \(card lane\) running \(20 min\)/);
  assert.equal(gate(['busy', 'ui'], c).out, 'FREE');
});

// 2026-10-19 (owner): token-saving switch "hemat"; newest HEMAT ON/OFF comment wins, none = ON; other comments are ignored.
test('G20 hemat switch: default ON, newest HEMAT comment wins, ON/OFF auto comments do not count', () => {
  assert.equal(gate(['hemat'], [ON]).out, 'Mode hemat: ON');
  assert.equal(gate(['hemat', 'status'], [ON, [50, 'HEMAT OFF'], [40, 'OFF']]).out, 'Mode hemat: OFF');
  assert.equal(gate(['hemat', 'status'], [[60, 'HEMAT OFF'], [30, 'hemat on'], [10, 'DONE v0.69.0']]).out, 'Mode hemat: ON');
  assert.equal(gate(['hemat', 'maybe'], [ON]).code, 2);
});

// 2026-10-20 (owner): chain mode "rantai"; default OFF; a chain = the newest DONE plus the DONEs it continues ("rantai" tag);
// GO while the chain is under the budget; one session over the budget turns the switch OFF (fixture budget 600000 via GATE_RANTAI_MAX; the real default is unlimited since 2026-10-26).
test('G21 rantai: default OFF, chain sum, budget reached, single session over the budget', () => {
  const RON = [300, 'RANTAI ON'];
  assert.equal(gate(['rantai'], [ON]).out, 'Mode rantai: OFF | rantai terakhir: 0 / 600.000 token (0 sesi)');
  assert.match(gate(['rantai', 'next'], [ON, [10, 'DONE v0.81.1 next=Opus tokens=100000']]).out, /^STOP Mode rantai: OFF/);
  const c = [RON, [200, 'DONE v0.81.1 next=Opus tokens=250000'], [100, 'DONE v0.81.2 next=Opus tokens=200000 rantai']];
  assert.equal(gate(['rantai', 'next'], c).out, 'GO Mode rantai: ON | rantai terakhir: 450.000 / 600.000 token (2 sesi)');
  assert.match(gate(['rantai', 'next'], [...c, [50, 'DONE v0.81.3 next=Opus tokens=160000 rantai']]).out, /^STOP chain budget reached .*610\.000 .*\(3 sesi\)/);
  // a DONE without the tag starts a new chain
  assert.match(gate(['rantai', 'next'], [...c, [50, 'DONE v0.81.3 next=Opus tokens=160000']]).out, /^GO .*160\.000 .*\(1 sesi\)/);
  assert.match(gate(['rantai', 'next'], [RON, [50, 'DONE v0.81.3 next=Opus']]).out, /^STOP no tokens=/);
  assert.match(gate(['rantai', 'status'], [RON, [100, 'RANTAI OFF auto: x'], [50, 'rantai on']]).out, /^Mode rantai: ON .* 0 \/ /);
  assert.equal(gate(['rantai', 'maybe'], [ON]).code, 2);
  // over the budget: posts "RANTAI OFF auto" (needs gh), so only the evaluator verdict is checked through a failing post
  const r = gate(['rantai', 'next'], [RON, [50, 'DONE v0.81.3 next=Opus tokens=650000']], [], { PATH: NO_GH_PATH });
  assert.match(r.out, /STOP session v0\.81\.3 used 650000 tokens \(> 600000\) \(Mode rantai: OFF\)/);
});

test('G-T1 item T: budget= on LOCK/MANUAL and done lets the gate post tokens= (no mental arithmetic)', () => {
  const P = { GATE_PRINT: '1' };
  const c = [ON, [60, 'LOCK budget=15000000']];
  assert.equal(gate(['busy'], c).code, 3, 'a LOCK with budget= still blocks');
  assert.equal(gate(['busy', 'ui'], [ON, [60, 'LOCK ui budget=9']]).code, 3, 'the lane word stays the lane');
  assert.equal(gate(['busy', 'card'], [ON, [60, 'LOCK ui budget=9']]).out, 'FREE');
  assert.match(gate(['lock', 'budget=123'], [ON], [], P).out, /^POST LOCK budget=123$/m);
  assert.match(gate(['manual', 'ui', 'budget=9'], [ON], [], P).out, /^POST MANUAL ui budget=9$/m);
  assert.match(gate(['lock'], [ON], [], P).out, /^POST LOCK$/m, 'no budget: the old marker');
  assert.match(gate(['done', 'v0.90.0', 'next=Opus', 'budget=14750000', 'rantai'], c, [], P).out, /^POST DONE v0\.90\.0 next=Opus rantai tokens=250000$/m);
  assert.match(gate(['done', 'v0.90.0', 'next=Opus', 'tokens=5', 'budget=1'], c, [], P).out, /^POST DONE v0\.90\.0 next=Opus tokens=5$/m, 'explicit tokens= wins');
  const old = gate(['done', 'v0.90.0', 'next=Opus', 'budget=1'], [ON, [60, 'LOCK']], [], P);
  assert.match(old.out, /^POST DONE v0\.90\.0 next=Opus$/m); assert.match(old.err, /^WARN no usable budget=/);
  assert.match(gate(['done', 'v0.90.0', 'next=Opus', 'budget=15000001'], c, [], P).err, /^WARN/, 'a counter that went up gives no tokens=');
  assert.match(gate(['rantai', 'next'], [[300, 'RANTAI ON'], [60, 'LOCK budget=15000000'], [10, 'DONE v0.90.0 next=Opus rantai tokens=250000']]).out, /^GO .*250\.000/);
});

test('G-T3 owner 2026-10-21: sub=N (subagent tokens) is added to tokens= and kept on the DONE line', () => {
  const P = { GATE_PRINT: '1' };
  assert.match(gate(['done', 'v0.93.0', 'next=Opus', 'start=15000000', 'sub=80000', 'budget=14900000', 'rantai'], [ON, [60, 'LOCK']], [], P).out, /^POST DONE v0\.93\.0 next=Opus rantai tokens=180000 sub=80000$/m);
  assert.match(gate(['done', 'v0.93.0', 'next=Opus', 'start=15000000', 'budget=14900000'], [ON, [60, 'LOCK']], [], P).out, /tokens=100000$/m, 'no sub= = as before');
});
test('G-T2 item T: start= on the done line is used when the marker has no budget= (scheduled prompt runs a plain lock)', () => {
  const P = { GATE_PRINT: '1' };
  assert.match(gate(['done', 'v0.90.0', 'next=Opus', 'start=15000000', 'budget=14900000'], [ON, [60, 'LOCK']], [], P).out, /^POST DONE v0\.90\.0 next=Opus tokens=100000$/m);
  assert.match(gate(['done', 'v0.90.0', 'next=Opus', 'start=15000000', 'budget=14900000', 'rantai'], [ON, [60, 'LOCK budget=1']], [], P).out, /tokens=100000$/m, 'start= on the line wins over the marker');
});

/* G30 (audit 2026-10-27): issue #1 of a public repo takes comments from anyone, so the switch and the session markers may only be read
   from the owner's account and the "Auto mode" workflow (github-actions[bot]). */
const GATE_SRC = readFileSync(join(ROOT, 'tools/session_gate.sh'), 'utf8');
test('G30 every read of the issue comments goes through the trusted-author filter', () => {
  const reads = GATE_SRC.split('\n').filter(l => /issues\/\$L\/comments\?/.test(l) && !/^post\(\)/.test(l));
  assert.ok(reads.length >= 4, 'expected the comment reads in session_gate.sh, found ' + reads.length);
  for (const l of reads) assert.match(l, /"\$TRUSTED_JQ"/, 'unfiltered comment read: ' + l.trim().slice(0, 90));
});
test('G31 the filter keeps the owner and the Actions bot and drops a stranger\'s ON / RANTAI ON', () => {
  const m = /^TRUSTED_JQ='(.*)'$/m.exec(GATE_SRC);
  assert.ok(m, 'TRUSTED_JQ not found');
  const sample = [['odinguard009', 'OFF'], ['github-actions[bot]', 'RANTAI OFF (Actions)'], ['stranger', 'ON'], ['stranger2', 'RANTAI ON'], ['odinguard009-fake', 'DONE v9.9.9']]
    .map(([login, body]) => ({ user: { login }, body, created_at: '2026-10-27T00:00:00Z' }));
  const r = spawnSync('jq', ['-r', m[1] + ' | .body'], { input: JSON.stringify(sample), encoding: 'utf8' });
  if (r.error) return;                                    // jq is not installed on this machine (the gate itself runs through gh --jq)
  assert.deepEqual(r.stdout.trim().split('\n'), ['OFF', 'RANTAI OFF (Actions)']);
});
