// One-call work loop: build -> lint -> brand guard -> effect format check -> tests, printing only what decides the next step.
// Usage: npm run -s loop          (fast: smoke tests + the test files changed on this branch; ~10-30 s)
//        npm run -s loop -- --full (every quick test, ~3 min; the pre-push hook runs this once per push)
// Process cleanup (owner, 2026-10-19, "too many tests"): the full quick set ran at session start, after every task and again in the pre-push hook (~3 min each). Now it runs once per push; the loop runs the smoke set plus what the session touched.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const FULL = process.argv.includes('--full');
// GUARDS (2026-10-30): the two files that failed most often in the ~20 min pre-push (FX coverage floor, flag lists), ~15 s here instead.
const SMOKE = ['build', 'data', 'pack', 'budget', 'engine', 'fx_generated_cases', 'strict_effects'].map((f) => `tests/unit/${f}.test.mjs`);
// v0.199.1 (2026-10-31): budget.test.mjs has wall-clock limits (B09-B12); beside fx_generated_cases it measured 3.2-3.7 s for the 3 s page-ready budget, so the loop failed on Windows. Run it alone, as tools/quick-tests.mjs already does (TIMING).
const TIMING = new Set(['tests/unit/budget.test.mjs']);
const SMOKE_FAST = SMOKE.filter((f) => !TIMING.has(f));
const SLOW = /(^|\/)(props|fuzz596)\.test\.mjs$/;   // CI only (npm test)

const run = (args, env) => spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, ...env } });
const git = (args) => (spawnSync('git', args, { encoding: 'utf8' }).stdout || '').split('\n').filter(Boolean);
const tail = (s, n) => s.trim().split('\n').slice(-n).join('\n');

function changedTests() {
  // Base HEAD (2026-10-30): files edited since the last commit. Earlier commits of a bundle already ran their loop; the old base
  // origin/main re-ran every test file touched since the last release (the 94-test K file, ~6 min) on every loop.
  const base = 'HEAD';
  const names = [...git(['diff', '--name-only', base, '--', 'tests/unit']),
    ...git(['ls-files', '--others', '--exclude-standard', 'tests/unit'])];
  // Tests that name a card whose data or code changed (2026-10-30: T06 asserted 26RBS03-X07 was still partial, the loop never ran it, main went red).
  const ids = new Set();
  for (const l of git(['diff', '-U0', base, '--', 'data/cards', 'packages/engine/src'])) {
    if (/^[+-]/.test(l)) for (const m of l.matchAll(/\b[0-9A-Z]{2,8}-[A-Z]{0,2}\d{2,3}\b/g)) ids.add(m[0]);
  }
  const named = [...ids].slice(0, 60).flatMap((id) => git(['grep', '-l', '-F', id, '--', 'tests/unit']));
  return [...new Set([...names, ...named.slice(0, 40)])].filter((f) => f.endsWith('.test.mjs') && !SLOW.test(f) && existsSync(f));
}

const changed = changedTests().filter((f) => !TIMING.has(f));
const testRuns = FULL
  ? [['quick tests', ['tools/quick-tests.mjs']]]
  : [['smoke + changed tests', ['--test', ...new Set([...SMOKE_FAST, ...changed])]],
    ['timing tests', ['--test', '--test-concurrency=1', ...SMOKE.filter((f) => TIMING.has(f))]]];
const steps = [
  ['build', ['tools/build.mjs']],
  ['lint', ['tools/lint.mjs']],
  ['brand guard', ['tools/brand_guard.mjs']],
  ['doc refs', ['tools/check_refs.mjs']],                       // v0.106.0: every backticked file reference in the living docs resolves (or is in the shrink-only baseline)
  ['fx validate', ['tools/fx_validate.mjs', '--static']],      // v0.81 F1: effect format schema + shipped cards (engine parse: test FS03)
];

const failure = (name, out) => {
  const fails = out.split('\n').filter((l) => /^not ok|^# (pass|fail)|Error|error:/.test(l));
  return `[loop] ${name} FAILED\n${(fails.length ? fails.slice(0, 20).join('\n') : tail(out, 15))}`;
};

for (const [name, args] of steps) {
  const r = run(args, {});
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) { console.log(failure(name, out)); process.exit(1); }
}
const passed = [];
for (const [name, args] of testRuns) {
  const r = run(args, { BS_QUICK: '1' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) { console.log(failure(name, out)); process.exit(1); }
  const pass = out.match(/^(?:#|ℹ) pass (\d+)/m);   // Node 22: "# pass", Node 24: "ℹ pass"
  passed.push(`${name} ${pass ? pass[1] + ' passed' : 'ok'}`);
}
if (FULL) console.log(`[loop] build ok, lint clean, ${passed.join(', ')}`);
else console.log(`[loop] build ok, lint clean, ${passed.join(', ')} (${new Set([...SMOKE_FAST, ...changed]).size} files; full set: npm run -s loop -- --full, also run by pre-push)`);
