// v0.59.7 (C5): short README front page, release notes in CHANGELOG.md, GitHub Releases made by a workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, BASH } from './lib/game.mjs';

const rd = p => readFileSync(join(ROOT, p), 'utf8');
const VERSION = rd('packages/engine/src/01-cards.js').match(/const VERSION = '([^']+)'/)[1];
const localLinks = (md) => [...md.matchAll(/\]\(([^)\s]+)\)|src="([^"]+)"/g)].map(m => m[1] || m[2])
  .filter(u => !/^(https?:|mailto:|#)/.test(u)).map(u => u.split('#')[0]);

test('C597-01 README is a short front page (under 120 lines) with no release notes', () => {
  const r = rd('README.md');
  assert.ok(r.split('\n').length < 120, 'README.md has ' + r.split('\n').length + ' lines');
  assert.doesNotMatch(r, /^## v\d/m, 'release notes belong in CHANGELOG.md');
});
test('C597-02 every local link and image in README and CHANGELOG exists', () => {
  for (const f of ['README.md', 'CHANGELOG.md', 'CHANGELOG-archive.md']) {
    for (const u of localLinks(rd(f))) assert.ok(existsSync(join(ROOT, u)), `${f}: ${u} does not exist`);
  }
});
test('C597-03 until v1.0 the README has no link buttons and no screenshots (owner, 2026-10-17)', () => {
  const r = rd('README.md');
  assert.doesNotMatch(r, /<img|docs\/images\//, 'screenshots come back at v1.0 (node tools/screens.mjs)');
  assert.doesNotMatch(r, /\*\*\[Download\]/, 'link line comes back at v1.0');
  assert.ok(!existsSync(join(ROOT, 'docs/images')) || readdirSync(join(ROOT, 'docs/images')).length === 0, 'docs/images is empty');
});
test('C597-04 CHANGELOG newest heading is the current VERSION and headings are unique', () => {
  const heads = [...rd('CHANGELOG.md').matchAll(/^## (v\d[\d.]*)\s*$/gm)].map(m => m[1]);
  assert.equal(heads[0], 'v' + VERSION);
  assert.equal(new Set(heads).size, heads.length);
});
test('C597-05 README keeps the neutral sentences the brand mapping restores, word for word', () => {
  const r = rd('README.md');
  assert.ok(r.includes('web simulator for a trading card game.'));
  assert.ok(r.includes('Unofficial non-commercial fan project; card names, text and trademarks belong to their owners.'));
});
test('C597-06 release workflow runs after CI on main with contents: write and calls tools/make_releases.sh', () => {
  const w = rd('.github/workflows/release.yml');
  for (const s of ['workflow_run:', 'workflows: [CI]', 'branches: [main]', 'contents: write', 'fetch-depth: 0', 'tools/make_releases.sh', "conclusion == 'success'"]) assert.ok(w.includes(s), s);
});
test('C597-07 make_releases.sh dry run plans the HEAD commit version with its CHANGELOG title and skips bad input', { skip: !existsSync(join(ROOT, '.git')) }, () => {
  // the version of the committed HEAD (before the version commit exists, that is the previous release)
  const VERSION = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { cwd: ROOT, encoding: 'utf8' })).version;
  const out = execFileSync(BASH, ['tools/make_releases.sh', 'HEAD', VERSION, '0.50.0', 'x;y'], { cwd: ROOT, env: { ...process.env, DRY_RUN: '1' }, encoding: 'utf8' });
  // v0.106.0: the title comes from the first real summary, so both boilerplate bullets are skipped
  const title = (rd('CHANGELOG.md') + rd('CHANGELOG-archive.md')).split(`## v${VERSION}`)[1].split('\n').find(l => l.startsWith('- ') && !/^- (Lane|Time):/.test(l)).replace(/^- /, '').replace(/\*\*|`/g, '').replace(/[(:].*$/, '').replace(/[ .,;]+$/, '').slice(0, 70);
  assert.match(out, new RegExp(`would release v${VERSION.replace(/\./g, '\\.')} at [0-9a-f]{7}: v${VERSION.replace(/\./g, '\\.')} - `));
  assert.ok(out.includes(`- ${title} (`), 'title from the first CHANGELOG bullet after the Lane bullet: ' + title);
  assert.doesNotMatch(out, /v0\.50\.0/, 'versions before v0.57.1 stay in the archive');
  assert.match(out, /not a version: x;y/);
});
