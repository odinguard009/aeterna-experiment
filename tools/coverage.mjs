#!/usr/bin/env node
// Engine coverage: which top-level names of packages/protocol + packages/engine a fixed
// smoke flow set actually runs. This is the missing half of the test story (v0.106.0):
// the unit tests check behaviour and fx_generated_cases covers the action shapes, but
// nothing said WHICH engine names any run ever reaches, so "02f is untested" was an
// opinion, not a number.
//
// How: V8 block coverage (NODE_V8_COVERAGE) over the headless engine
// (packages/engine/headless.mjs compiles the joined script with the file name
// "aeterna-engine.js"). Function names come straight from the coverage records, so no
// source map and no browser are needed. The web parts are out of scope: they never load
// in the headless host (the Playwright suites are their gate).
//
//   node tools/coverage.mjs             table + totals, never fails
//   node tools/coverage.mjs --check     exit 1 when a part runs fewer names than the baseline (ratchet floor)
//   node tools/coverage.mjs --update    raise the baseline to this run (--force lowers it on purpose)
//   node tools/coverage.mjs --report    also (re)write docs/reports/engine-coverage.md
//
// Flows are seeded, so the numbers are deterministic; a new flow is added here and the
// baseline is raised in the same commit, never lowered.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { srcParts } from './src_parts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'tools', 'coverage-baseline.json');
const REPORT = join(ROOT, 'docs', 'reports', 'engine-coverage.md');
const SELF = fileURLToPath(import.meta.url);
const ARGS = process.argv.slice(2);
const has = (f) => ARGS.includes(f);

// The smoke flows: both formats, every colour family at least once, plus a human seat so
// the decision/intent port is reached. Seeds are fixed on purpose (deterministic floor).
const FLOWS = [
  { format: 'eternal', seed: 7, deckA: 'red', deckB: 'mitra' },
  { format: 'eternal', seed: 11, deckA: 'red', deckB: 'red' },
  { format: 'eternal', seed: 23, deckA: 'blue', deckB: 'green' },
  { format: 'eternal', seed: 31, deckA: 'purple', deckB: 'yellow' },
  { format: 'standard', seed: 7, deckA: 'std01', deckB: 'std03' },
  { format: 'standard', seed: 11, deckA: 'std02', deckB: 'std05' },
  { format: 'standard', seed: 23, deckA: 'std04', deckB: 'std06' },
  { format: 'standard', seed: 31, deckA: 'std07', deckB: 'std08' },
  { format: 'eternal', seed: 5, deckA: 'red', deckB: 'mitra', human: true },
  { format: 'standard', seed: 5, deckA: 'std01', deckB: 'std03', human: true }
];

// Declarations V8 coverage can answer for: functions and classes. Plain data consts
// (VERSION, STEPS, CARDS, G, FX_ACTIONS) never appear in a coverage record, so counting
// them would report a permanent, meaningless "miss"; the entries inside FX_ACTIONS are
// covered by tests/unit/fx_generated_cases.test.mjs instead.
const DECL = /^(?:async\s+)?(?:function\s+([\w$]+)|class\s+([\w$]+)|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\s*\(|function\s+[\w$]+|\(|[\w$]+\s*=>))/gm;

/** name -> source part (headless host: protocol + engine only). */
function nameOwners() {
  const owner = new Map(), dupes = new Set();
  for (const p of srcParts(ROOT)) {
    if (p.rel.startsWith('apps/')) continue;
    const src = readFileSync(join(ROOT, p.rel), 'utf8');
    for (const m of src.matchAll(DECL)) {
      const n = m[1] || m[2] || m[3];
      if (owner.has(n)) dupes.add(n); else owner.set(n, p.rel);
    }
  }
  for (const n of dupes) owner.delete(n);                          // ambiguous names count for no part
  return { owner, dupes };
}

/** Child side: play the flows (Node writes the V8 coverage file on exit). */
async function collect() {
  const { playHeadless } = await import('../packages/engine/headless.mjs');
  let played = 0;
  for (const f of FLOWS) {
    const r = await playHeadless({ seed: f.seed, deckA: f.deckA, deckB: f.deckB, format: f.format, human: !!f.human, timeoutMs: 20000 });
    if (!r.over || (r.errors && r.errors.length)) {
      console.error(`[coverage] flow failed: ${f.format} ${f.deckA} vs ${f.deckB} seed ${f.seed}: ${r.over ? r.errors.join('; ') : 'did not finish'}`);
      process.exitCode = 1;
    } else played++;
  }
  if (!process.env.NODE_V8_COVERAGE) console.error('[coverage] NODE_V8_COVERAGE is not set; run through the parent command');
  else console.error(`[coverage] played ${played}/${FLOWS.length} smoke flows`);
}

/** Parent side: union of the engine functions the flows entered. */
function measure() {
  const dir = mkdtempSync(join(tmpdir(), 'aeterna-cov-'));
  try {
    const run = spawnSync(process.execPath, [SELF, '--collect'], { cwd: ROOT, env: { ...process.env, NODE_V8_COVERAGE: dir }, encoding: 'utf8' });
    if (run.status !== 0) { process.stderr.write(run.stdout || ''); process.stderr.write(run.stderr || ''); throw new Error('coverage collection failed'); }
    const executed = new Set();
    for (const f of readdirSync(dir)) {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      for (const s of j.result || []) {
        if (!String(s.url || '').includes('aeterna-engine')) continue;
        for (const fn of s.functions || []) {
          if (!fn.functionName) continue;
          if (fn.ranges && fn.ranges.length && fn.ranges[0].count > 0) executed.add(fn.functionName);   // entered at least once
        }
      }
    }
    if (!executed.size) throw new Error('no engine coverage recorded (script name changed?)');
    return executed;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** name -> source part, from the same regex tools/code_map.mjs uses (line-start declarations). */
function perPart(executed) {
  const { owner } = nameOwners();
  const parts = new Map();
  for (const [name, rel] of owner) {
    const p = parts.get(rel) || { total: 0, hit: 0, miss: [] };
    p.total++;
    if (executed.has(name)) p.hit++; else p.miss.push(name);
    parts.set(rel, p);
  }
  return parts;
}

function table(parts) {
  const rows = [...parts].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const w = Math.max(...rows.map(([r]) => r.length));
  let H = 0, T = 0;
  const out = [];
  for (const [rel, p] of rows) {
    H += p.hit; T += p.total;
    out.push(`${String(Math.round(100 * p.hit / p.total)).padStart(3)}%  ${String(p.hit + '/' + p.total).padStart(7)}  ${rel.padEnd(w)}${p.miss.length ? '  miss: ' + p.miss.slice(0, 8).join(', ') + (p.miss.length > 8 ? ', +' + (p.miss.length - 8) : '') : ''}`);
  }
  out.push(`TOTAL ${H}/${T} = ${Math.round(100 * H / T)}% of engine + protocol top-level names`);
  return { text: out.join('\n'), hit: H, total: T };
}

function main() {
  const executed = measure();
  const parts = perPart(executed);
  const { text, hit, total } = table(parts);
  console.log(text);

  if (has('--report')) {
    mkdirSync(dirname(REPORT), { recursive: true });
    const rows = [...parts].sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([rel, p]) => `| \`${rel}\` | ${p.hit} | ${p.total} | ${Math.round(100 * p.hit / p.total)}% | ${p.miss.length ? p.miss.join(', ') : '-'} |`);
    writeFileSync(REPORT, `# Engine coverage (generated by tools/coverage.mjs --report; do not edit)

Top-level names of \`packages/protocol\` + \`packages/engine\` that the smoke flows in \`tools/coverage.mjs\` reach, measured with V8 block coverage over the headless engine. The web parts are out of scope (they never load headless; the Playwright suites are their gate).

${FLOWS.length} flows, ${hit}/${total} names = **${Math.round(100 * hit / total)}%**. The ratchet floor lives in \`tools/coverage-baseline.json\` and may only rise.

| Part | Named | Reached | Share | Never reached |
|---|---|---|---|---|
${rows.join('\n')}
`, { encoding: 'utf8', newline: '' });
    console.log(`\n[docs/reports/engine-coverage.md written: ${rows.length} parts]`);
  }

  const mine = Object.fromEntries([...parts].map(([rel, p]) => [rel, p.hit]));
  const have = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { parts: {} };
  if (has('--update')) {
    const next = { ...have.parts };
    const lowered = [];
    for (const [rel, n] of Object.entries(mine)) {
      if (next[rel] == null || n > next[rel]) next[rel] = n;
      else if (n < next[rel]) {
        if (has('--force')) { lowered.push(`${rel} ${next[rel]} -> ${n}`); next[rel] = n; }
        else console.log(`[keep] ${rel}: baseline ${next[rel]} stays above this run's ${n} (pass --force to lower on purpose)`);
      }
    }
    writeFileSync(BASELINE, JSON.stringify({
      note: 'Engine coverage ratchet (tools/coverage.mjs --check). Per part: how many top-level names the smoke flows reach. This number may only rise; lower it only with --force and a reason in the commit.',
      flows: FLOWS.length,
      parts: Object.fromEntries(Object.entries(next).sort((a, b) => a[0] < b[0] ? -1 : 1))
    }, null, 1) + '\n', { encoding: 'utf8', newline: '' });
    console.log(`[tools/coverage-baseline.json updated: ${Object.keys(next).length} parts${lowered.length ? '; lowered with --force: ' + lowered.join(', ') : ''}]`);
    return;
  }
  if (!has('--check')) return;
  const bad = [];
  for (const [rel, base] of Object.entries(have.parts || {})) {
    const now = mine[rel];
    if (now == null) bad.push(`${rel}: part is gone (rename/removal needs a baseline update in the same commit)`);
    else if (now < base) bad.push(`${rel}: ${now} names reached, baseline ${base}`);
  }
  if (bad.length) {
    console.log('\n[coverage] ratchet FAILED:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log('\n[coverage] ratchet ok (no part below its baseline)');
}

if (has('--collect')) await collect();
else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

export { FLOWS };
