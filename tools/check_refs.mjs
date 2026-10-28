#!/usr/bin/env node
// Check the file references the living docs make in backticks ("`docs/ai/code-map.md`").
// Why: a doc that points at a file which no longer exists costs a session twice - the
// reader looks for it and never learns about the file that replaced it. The 2026-10-24
// audit found three docs/README.md entries for the ai/lanes/* notes deleted in v0.96.0 and
// seven real docs missing from the index; an ad-hoc grep found 175 "broken" references but
// most of them were bare basenames (`00-config.js`) that the docs resolve by part name.
//
// Scope: markdown only, and only the living docs - CHANGELOG*/roadmap-archive/deleted-branches
// are history and keep pointing at files as they were. A reference resolves if it exists at
// the repo root, next to the doc, under docs/, or as a basename inside a known source folder.
//
//   node tools/check_refs.mjs            check (exit 1 on a reference not in the baseline)
//   node tools/check_refs.mjs --json      the same, machine readable
//   node tools/check_refs.mjs --update    record today's broken references as tolerated
//
// The baseline (tools/check_refs-baseline.json) may only shrink: fixing a reference means
// deleting its line there, never adding one.
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { srcParts } from './src_parts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'tools', 'check_refs-baseline.json');
const ARGS = process.argv.slice(2);
const has = (f) => ARGS.includes(f);

const HISTORY = new Set(['CHANGELOG.md', 'CHANGELOG-archive.md', 'docs/ai/roadmap-archive.md', 'docs/ai/deleted-branches.md']);
// Folders a bare basename may resolve into (the docs write `06-rules.js`, meaning packages/engine/src/06-rules.js).
const HOMES = ['packages/protocol/src', 'packages/engine/src', 'apps/web/src', 'apps/server/src', 'apps/web', 'tools', 'tests/unit', 'tests/unit/lib',
  'tests/suites', 'tests/legacy', 'tests/scenarios', 'data/cards', 'data/glossary', 'data/decks', 'data/kb', 'docs', 'docs/ai', 'docs/reports',
  'docs/rules', 'docs/mechanics', 'docs/design', 'docs/audits', '.github/workflows', '.githooks', 'packages/engine'];
const EXT = /\.(?:md|json|mjs|js|ts|py|sh|yml|yaml|html|css|txt)$/;
// Paths that exist only at run time, so "missing" is their normal state: the release artifact the
// Regression suites read, and the auto-mode stop marker a session commits while it waits.
const RUNTIME = /^(?:tests\/last-run\.json|docs\/ai\/chain-stop\.md)$/;
// The docs name "the next file of this kind" with a placeholder (`saga-NN.json`, `vNN_tests.py`).
const PLACEHOLDER = /(?:NN|XX|YY|ZZ|X\.Y\.Z)/;
// The release artifact the README links to is named after the version, so it is never a repo file;
// matching it as a pattern keeps the baseline from churning on every release.
const ARTIFACT = /^aeterna(?:-v\d+\.\d+\.\d+)?\.html$/;

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'build' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
};

/** Living markdown files that are tracked in git, repo-relative posix paths. Untracked notes
 *  (a session's scratch work) and the history files are out of scope. */
function livingDocs() {
  const tracked = spawnSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  if (!tracked.length) return [...['README.md', 'AGENTS.md', 'CLAUDE.md'].filter((f) => existsSync(join(ROOT, f))), ...walk(join(ROOT, 'docs')).map((p) => relative(ROOT, p).split('\\').join('/'))]
    .filter((f) => !HISTORY.has(f)).sort();
  return tracked.filter((f) => !HISTORY.has(f) && !f.startsWith('docs/ai/settings/')).sort();   // settings copy: verbatim ~/.claude files, refs are not repo paths
}

const isFile = (p) => { try { return statSync(join(ROOT, p)).isFile(); } catch { return false; } };

/** Does this reference point at a real file? */
function resolves(ref, doc) {
  const cands = [ref, posix.join(posix.dirname(doc), ref), posix.join('docs', ref)];
  if (!ref.includes('/')) for (const h of HOMES) cands.push(posix.join(h, ref));
  return cands.some(isFile);
}

/** [ {doc, line, ref} ] for every backticked path-looking reference that does not resolve. */
function broken() {
  const out = [];
  for (const doc of livingDocs()) {
    const text = readFileSync(join(ROOT, doc), 'utf8').split('\n');
    text.forEach((ln, i) => {
      for (const m of ln.matchAll(/`([^`\n]+)`/g)) {
        const ref = m[1].trim().replace(/[:#].*$/, '');                      // drop :12 / #section anchors
        if (!EXT.test(ref) || /\s/.test(ref) || ref.includes('*') || ref.includes('<') || ref.includes('>')) continue;
        if (/[[\]?]/.test(ref)) continue;                                    // a naming pattern (`NN[a-z]?-name.js`), not a path
        if (PLACEHOLDER.test(ref)) continue;                                 // a pattern for the next file of a kind
        if (RUNTIME.test(ref)) continue;                                     // exists only while a run or a release is going
        if (ARTIFACT.test(ref)) continue;                                    // the release artifact, named after the version
        if (/^(?:https?:|mailto:|\/|\.\.\/\.\.|\.)/.test(ref)) continue;      // URL, absolute, or a bare extension (`.md`)
        if (ref.startsWith('./') || ref.startsWith('build/')) continue;      // run-time script path / a generated, never-committed file
        if (resolves(ref, doc)) continue;
        out.push({ doc, line: i + 1, ref });
      }
    });
  }
  const seen = new Set();
  return out.filter((b) => { const k = `${b.doc}\u0000${b.ref}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const rows = broken();
const keys = rows.map((b) => `${b.doc} ${b.ref}`).sort();
if (has('--json')) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
if (has('--update')) {
  writeFileSync(BASELINE, JSON.stringify({
    note: 'Tolerated broken doc references (tools/check_refs.mjs --check). This list may only SHRINK: fix a reference by fixing the doc, never by adding a line here.',
    count: keys.length,
    refs: keys
  }, null, 1) + '\n', { encoding: 'utf8', newline: '' });
  console.log(`[tools/check_refs-baseline.json: ${keys.length} tolerated references]`);
  process.exit(0);
}

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { refs: [] };
const known = new Set(base.refs || []);
const fresh = rows.filter((b) => !known.has(`${b.doc} ${b.ref}`));
const fixed = [...known].filter((k) => !keys.includes(k));
for (const b of fresh) console.log(`${b.doc}:${b.line}  ${b.ref}`);
if (fixed.length) console.log(`[check_refs] ${fixed.length} tolerated reference(s) are fixed now; delete them from tools/check_refs-baseline.json:\n  ${fixed.join('\n  ')}`);
if (!fresh.length) console.log(`[check_refs] ok (${keys.length} tolerated, ${livingDocs().length} living docs)`);
process.exit(fresh.length || fixed.length ? 1 : 0);
