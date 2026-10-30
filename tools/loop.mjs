// One-call work loop: build -> lint -> brand guard -> effect format check -> tests, printing only what decides the next step.
// Usage: npm run -s loop          (fast: smoke tests + the test files changed on this branch; ~10-30 s)
//        npm run -s loop -- --full (every quick test, ~3 min; the pre-push hook runs this once per push)
// Process cleanup (owner, 2026-10-19, "too many tests"): the full quick set ran at session start, after every task and again in
// the pre-push hook (~3 min each). Now it runs once per push; the loop runs the smoke set plus what the session touched.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const FULL = process.argv.includes('--full');
// GUARDS (2026-10-30): the two files that failed most often in the ~20 min pre-push (FX coverage floor, flag lists), ~15 s here instead.
const SMOKE = ['build', 'data', 'pack', 'budget', 'engine', 'fx_generated_cases', 'strict_effects'].map((f) => `tests/unit/${f}.test.mjs`);
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
  return names.filter((f) => f.endsWith('.test.mjs') && !SLOW.test(f) && existsSync(f));
}

const testArgs = FULL ? ['tools/quick-tests.mjs'] : ['--test', ...new Set([...SMOKE, ...changedTests()])];
const steps = [
  ['build', ['tools/build.mjs']],
  ['lint', ['tools/lint.mjs']],
  ['brand guard', ['tools/brand_guard.mjs']],
  ['doc refs', ['tools/check_refs.mjs']],                       // v0.106.0: every backticked file reference in the living docs resolves (or is in the shrink-only baseline)
  ['fx validate', ['tools/fx_validate.mjs', '--static']],      // v0.81 F1: effect format schema + shipped cards (engine parse: test FS03)
  [FULL ? 'quick tests' : 'smoke + changed tests', testArgs],
];

for (const [name, args] of steps) {
  const r = run(args, name.includes('test') ? { BS_QUICK: '1' } : {});
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) {
    const fails = out.split('\n').filter((l) => /^not ok|^# (pass|fail)|Error|error:/.test(l));
    console.log(`[loop] ${name} FAILED\n${(fails.length ? fails.slice(0, 20).join('\n') : tail(out, 15))}`);
    process.exit(1);
  }
  if (name.includes('test')) {
    const pass = out.match(/^# pass (\d+)/m);
    const files = FULL ? '' : ` (${testArgs.length - 1} files; full set: npm run -s loop -- --full, also run by pre-push)`;
    console.log(`[loop] build ok, lint clean, ${name} ${pass ? pass[1] + ' passed' : 'ok'}${files}`);
  }
}
