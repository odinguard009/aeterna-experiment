// Quick Node test run: every tests/unit/*.test.mjs except the slow ones listed in SLOW.
// New test files are picked up automatically, so package.json never needs editing per version.
import { readdirSync, readFileSync, writeSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { ensureAllCards } from './all_cards.mjs';

ensureAllCards();                                         // build/all-cards.json (generated, not in git) must exist before the test files read it

const FULL = process.argv.includes('--full');           // v0.95.0: npm test (CI) = every file, no BS_QUICK, timing files alone too
const SLOW = new Set(FULL ? [] : ['props.test.mjs', 'match_fuzzer.test.mjs']);      // v0.59.6: the fuzz replays run in CI (npm test)
// v0.93.0: files with wall-clock limits (B09-B17: page ready, deck builder open, search) run alone after the parallel batch;
// under 3 parallel files B15 measured 355 ms against its 300 ms limit (alone ~100-200 ms). No check is dropped (item T.7).
const TIMING = new Set(['budget.test.mjs', 'deckbuilder_performance.test.mjs']);
// BS_SHARD="i/n" (CI matrix, 2026-11-02): files are dealt to n shards by recorded duration (tests/shard-times.json, longest first onto
// the lightest shard; refresh it with tools/shard_times.mjs from the junit artifacts of a CI run). A file without a time counts as the
// median. The wall-clock files run in shard 1 only.
const [shardI, shardN] = (process.env.BS_SHARD || '1/1').split('/').map(Number);
const all = readdirSync('tests/unit').filter((f) => f.endsWith('.test.mjs') && !SLOW.has(f) && !TIMING.has(f)).sort();
let times = {}; try { times = JSON.parse(readFileSync('tests/shard-times.json', 'utf8')); } catch (e) { /* no data yet: every file counts the same */ }
const known = all.map((f) => times[f]).filter((x) => x > 0).sort((x, y) => x - y), median = known.length ? known[known.length >> 1] : 1;
const load = Array(shardN).fill(0), mine = new Set();
for (const f of [...all].sort((x, y) => (times[y] || median) - (times[x] || median) || (x < y ? -1 : 1))) {
  const k = load.indexOf(Math.min(...load)); load[k] += times[f] || median;
  if (k === shardI - 1) mine.add(f);
}
const files = all.filter((f) => mine.has(f)).map((f) => `tests/unit/${f}`);
const timingFiles = shardI === 1 ? [...TIMING].sort() : [];

// Item T (owner, 2026-10-21): node --test runs (cores - 1) files at a time, i.e. one by one on the 2-core session machine; most
// files wait on a browser page, so 3 at a time took the set from 528 s to 320 s there with the same 1,338 passes. BS_TEST_CONC=1
// restores the serial run (use it if a test turns flaky under load).
const conc = Number(process.env.BS_TEST_CONC) || (FULL ? Math.max(1, availableParallelism() - 1) : Math.max(3, availableParallelism() - 1));
const env = FULL ? { ...process.env } : { ...process.env, BS_QUICK: '1' };   // v0.60.2: timing tests skip themselves
// v0.101.0: output is piped and re-printed, and every failing test is repeated at the very end (name + error lines), so the
// tail of a CI log names the failures (the full log of ~9,000 lines is too long to read through the tools).
// writeSync: process.exit() below would cut an asynchronous write to a pipe (CI) short
const out = (fd, text) => { const b = Buffer.from(text || ''); for (let o = 0; o < b.length;) { try { o += writeSync(fd, b, o); } catch (e) { if (e.code !== 'EAGAIN') throw e; } } };
const run = (args) => { const x = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }); out(1, x.stdout); out(2, x.stderr); return x; };
// BS_TIMES_OUT=<file>: also write a junit report there (per-test times, aggregated per file by tools/shard_times.mjs)
const rep = process.env.BS_TIMES_OUT ? (mkdirSync('build', { recursive: true }), ['--test-reporter=tap', '--test-reporter-destination=stdout', '--test-reporter=junit', `--test-reporter-destination=${process.env.BS_TIMES_OUT}`]) : [];
const r = run(['--test', ...rep, `--test-concurrency=${conc}`, ...files]);
const t = timingFiles.length ? run(['--test', '--test-concurrency=1', ...timingFiles.map((f) => `tests/unit/${f}`)]) : { stdout: '', status: 0 };
const failed = [];
for (const txt of [r.stdout || '', t.stdout || '']) {
  const L = txt.split('\n');
  L.forEach((l, i) => { if (/^\s*not ok \d+ - /.test(l) && !/# SKIP/.test(l)) failed.push([l.trim(), ...L.slice(i + 1, i + 16).filter((x) => /error|expected|actual|location|^\s+[+-] /.test(x)).map((x) => '    ' + x.trim().slice(0, 300))].join('\n')); });
}
if (failed.length) out(1, `\n[quick-tests] ${failed.length} failing test(s):\n` + failed.join('\n') + '\n');
process.exit((r.status ?? 1) || (t.status ?? 1));
