#!/usr/bin/env node
// End-of-session gate (owner, 2026-10-16). Fails (exit 1) unless the session's deliverables are in place:
//   1. /mnt/user-data/outputs/aeterna-v<package version>.html exists and embeds that VERSION,
//   2. `npm run -s test:release` passes on that file,
//   3. docs/roadmap.html is not older than docs/roadmap-data.json,
//   4. branch backup/v<version> exists on origin (skip with --no-backup when no backup is due),
//   5. (v0.69.3, P0 B7; warning only) the GitHub Release v<version> carries aeterna-v<version>.html; if not, the newest
//      Release workflow run is printed so the final message can name the problem (skip with --no-release).
// Usage: node tools/session_end_check.mjs [--no-backup] [--no-release] [--out DIR]
//   6. (owner, 2026-10-20) prints MINDMAP due / not due: the mind map is updated and sent every 3rd release or when the plan changed.
// Then SendUserFile the game file (always) and docs/roadmap.html (when MINDMAP due) before the session closes.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : '/mnt/user-data/outputs';
const ver = JSON.parse(readFileSync('package.json', 'utf8')).version;
const file = `${outDir}/aeterna-v${ver}.html`;
const bad = [];
const ok = m => console.log('ok   ' + m), fail = m => { bad.push(m); console.log('FAIL ' + m); };

if (!existsSync(file)) fail(`game file missing: ${file} (cp index.html there)`);
else {
  const html = readFileSync(file, 'utf8');
  if (!html.includes(`const VERSION = '${ver}'`)) fail(`${file} does not embed VERSION ${ver} (stale copy?)`);
  else ok(`game file ${file} embeds ${ver}`);
  const r = spawnSync('npm', ['run', '-s', 'test:release'], { env: { ...process.env, RELEASE_FILE: file }, encoding: 'utf8' });
  if (r.status !== 0) fail('npm run -s test:release failed:\n' + ((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => /not ok|Error/.test(l)).slice(0, 8).join('\n'));
  else ok('test:release passed on the game file');
}
const mt = f => statSync(f).mtimeMs;
if (mt('docs/roadmap.html') + 1000 < mt('docs/roadmap-data.json')) fail('docs/roadmap.html is older than docs/roadmap-data.json (run node tools/build.mjs)');
else ok('mind map is up to date');
// Mind map cadence (owner, 2026-10-20): update roadmap-data.json and send docs/roadmap.html every 3rd release, or
// whenever the plan changed this session; otherwise the final message only names the mind map version.
console.log((spawnSync('node', ['tools/mindmap_due.mjs'], { encoding: 'utf8' }).stdout || 'MINDMAP unknown (tools/mindmap_due.mjs failed)').trim());
if (!args.includes('--no-backup')) {
  const r = spawnSync('git', ['ls-remote', '--heads', 'origin', `backup/v${ver}`], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout.trim()) fail(`branch backup/v${ver} not on origin (git push origin HEAD:refs/heads/backup/v${ver})`);
  else ok(`backup/v${ver} on origin`);
}
if (!args.includes('--no-release')) {
  const gh = a => spawnSync('gh', ['api', ...a], { encoding: 'utf8' });
  const r = gh([`repos/odinguard009/aeterna-experiment/releases/tags/v${ver}`, '--jq', '[.assets[].name] | join(",")']);
  if (r.status === 0 && r.stdout.includes(`aeterna-v${ver}.html`)) ok(`GitHub Release v${ver} has aeterna-v${ver}.html`);
  else {
    const w = gh(['repos/odinguard009/aeterna-experiment/actions/workflows/release.yml/runs?per_page=1', '--jq', '.workflow_runs[0] | "\(.status) \(.conclusion // "-") on \(.head_sha[0:7]) run \(.id)"']);
    console.log(`WARN GitHub Release v${ver} without aeterna-v${ver}.html yet (it runs after CI on main); newest Release run: ${(w.stdout || 'unknown (gh failed)').trim()}. Re-run this check after CI; still missing = name it in the final message`);
  }
}
console.log(bad.length ? `[session_end_check] ${bad.length} problem(s): fix, then send the game file (and the mind map when due) with SendUserFile` : `[session_end_check] ready: SendUserFile ${file} (and docs/roadmap.html when MINDMAP due)`);
process.exit(bad.length ? 1 : 0);
