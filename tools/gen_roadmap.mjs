#!/usr/bin/env node
// Generates docs/progress.html: one self-contained page (no network, phone friendly) for the owner to follow progress.
//   node tools/gen_roadmap.mjs          -> writes docs/progress.html
//   node tools/build.mjs [--check]      -> the build writes it too; --check fails when it is stale (pre-push hook)
// Sources (nothing is typed twice): CLAUDE.md "Roadmap", docs/ai/roadmap-archive.md (Index, Items), CHANGELOG.md "## vX.Y.Z" release notes,
// packages/engine/src/01-cards.js VERSION, and `git log` (recent commits block).
// The commits block sits between markers and is merged with what the file already holds, so a shallow clone never
// loses history. It is ignored by --check (a new commit must not make the page "stale").
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'docs/progress.html';
const rd = p => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');      // LF only, so a Windows CRLF checkout renders the same page as CI
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const plain = s => s.replace(/[*`]/g, '');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const slug = v => 'r-' + v.replace(/[^0-9a-z]+/gi, '-');

function section(md, headRe) {
  const lines = md.split('\n');
  const i = lines.findIndex(l => headRe.test(l));
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < lines.length; j++) { if (/^## /.test(lines[j])) break; out.push(lines[j]); }
  return out;
}
const topBullets = lines => lines.filter(l => /^- /.test(l)).map(l => l.slice(2));

// split on a separator that is not inside (...) or [...]
function splitTop(s, sep) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function renderLines(lines) {
  let out = '', depth = 0;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const m = raw.match(/^(\s*)- (.*)$/);
    if (m) {
      const d = Math.floor(m[1].length / 2) + 1;
      while (depth > d) { out += '</ul>'; depth--; }
      while (depth < d) { out += '<ul>'; depth++; }
      out += '<li>' + inline(m[2]) + '</li>';
    } else {
      while (depth > 0) { out += '</ul>'; depth--; }
      out += '<p>' + inline(raw.trim()) + '</p>';
    }
  }
  while (depth > 0) { out += '</ul>'; depth--; }
  return out;
}

function releases(readme) {
  const out = []; let cur = null;
  for (const l of readme.split('\n')) {
    const m = l.match(/^## (v\d[\d.]*)\s*$/);
    if (m) { cur = { v: m[1], lines: [] }; out.push(cur); continue; }
    if (/^## /.test(l)) { cur = null; continue; }
    if (cur) cur.lines.push(l);
  }
  return out;
}

function gitCommits() {
  try {
    const o = execFileSync('git', ['log', '-n', '40', '--format=%h%x09%cs%x09%s'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return o.split('\n').filter(Boolean).map(l => { const [sha, date, ...r] = l.split('\t'); return { sha, date, html: esc(r.join('\t')) }; });
  } catch { return []; }
}
function oldCommits(html) {
  const out = []; const re = /<li data-sha="([^"]+)" data-date="([^"]+)"><code>[^<]*<\/code> <time>[^<]*<\/time> <span>(.*?)<\/span><\/li>/g;
  let m; while ((m = re.exec(html))) out.push({ sha: m[1], date: m[2], html: m[3] });
  return out;
}
function mergeCommits(fresh, old) {
  const seen = new Set(fresh.map(c => c.sha));
  return [...fresh, ...old.filter(c => !seen.has(c.sha))].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 40);
}
const commitsBlock = list => '<!--commits:start-->\n<ul class="commits">\n' + list.map(c =>
  `<li data-sha="${c.sha}" data-date="${c.date}"><code>${c.sha}</code> <time>${c.date}</time> <span>${c.html}</span></li>`).join('\n') + '\n</ul>\n<!--commits:end-->';
const COMMITS_RE = /<!--commits:start-->[\s\S]*?<!--commits:end-->/;

const CSS = `:root{--bg:#f6f7f9;--fg:#1c2330;--mut:#5d6778;--card:#fff;--line:#dfe3ea;--acc:#2b6cb0;--ok:#1f8a4c;--next:#b7791f}
@media(prefers-color-scheme:dark){:root{--bg:#12161d;--fg:#e6e9ef;--mut:#9aa4b5;--card:#1b212b;--line:#2c3441;--acc:#6aa6e8;--ok:#4cc486;--next:#e0a840}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:16px}h1{font-size:22px;margin:4px 0 2px}h2{font-size:17px;margin:26px 0 10px}
.sub{color:var(--mut);font-size:13px}.ver{display:inline-block;background:var(--acc);color:#fff;border-radius:999px;padding:1px 10px;font-size:13px;margin-left:6px;vertical-align:middle}
.card{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:8px;padding:10px 12px;margin:8px 0}
.card.done{border-left-color:var(--ok)}.card.next{border-left-color:var(--next)}.card.note{border-left-color:var(--acc)}
.tag{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.chips a{border:1px solid var(--line);background:var(--card);color:var(--fg);text-decoration:none;border-radius:999px;padding:2px 10px;font-size:13px}
details{background:var(--card);border:1px solid var(--line);border-radius:8px;margin:6px 0;padding:0 12px}summary{cursor:pointer;padding:9px 0;font-weight:600}
summary span{font-weight:400;color:var(--mut)}details>div{padding-bottom:8px}ul{margin:4px 0 4px 18px;padding:0}li{margin:3px 0}p{margin:6px 0}
code{background:rgba(127,127,127,.16);border-radius:4px;padding:0 4px;font-size:13px;word-break:break-word}
.commits{list-style:none;margin:0;padding:0}.commits li{border-bottom:1px solid var(--line);padding:5px 0;font-size:13px}.commits time{color:var(--mut)}`;

export function roadmapPage(commits = []) {
  const version = (rd('packages/engine/src/01-cards.js').match(/VERSION\s*=\s*'([^']+)'/) || [, '?'])[1];
  const rm = topBullets(section(rd('CLAUDE.md'), /^## Roadmap/));
  const idx = topBullets(section(rd('docs/ai/roadmap-archive.md'), /^## Index/));
  const items = topBullets(section(rd('docs/ai/roadmap-archive.md'), /^## Items/));
  const rels = releases(rd('CHANGELOG.md') + '\n' + rd('CHANGELOG-archive.md'));

  const status = rm.map(b => {
    const cls = /^\*\*Done/.test(b) ? 'done' : /^\*\*Next/.test(b) ? 'next' : 'note';
    const tag = { done: 'Done', next: 'Next', note: 'Note' }[cls];
    return `<div class="card ${cls}"><div class="tag">${tag}</div>${inline(b)}</div>`;
  }).join('\n');

  const chips = rels.slice(0, 12).map(r => `<a href="#${slug(r.v)}">${esc(r.v)}</a>`).join('');

  const open = items.map(b => {
    const i = b.indexOf(':');
    const head = i > 0 ? b.slice(0, i) : 'Open';
    const parts = splitTop(i > 0 ? b.slice(i + 1) : b, ';');
    return `<details><summary>${inline(head)} <span>(${parts.length} groups)</span></summary><div><ul>${parts.map(p => '<li>' + inline(p) + '</li>').join('')}</ul></div></details>`;
  }).join('\n');

  const rel = rels.map((r, n) => {
    const first = (r.lines.find(l => /^- /.test(l)) || '- ').slice(2);
    return `<details id="${slug(r.v)}"${n === 0 ? ' open' : ''}><summary>${esc(r.v)} <span>${esc(clip(plain(first), 110))}</span></summary><div>${renderLines(r.lines)}</div></details>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aeterna - Progress</title>
<style>${CSS}</style></head><body><main>
<h1>Aeterna - Progress <span class="ver">build v${esc(version)}</span></h1>
<div class="sub">Generated by <code>tools/gen_roadmap.mjs</code> on every build from CLAUDE.md, docs/ai/roadmap-archive.md and the CHANGELOG release notes. Do not edit by hand.</div>
<h2>Status</h2>
${status}
<h2>Open items</h2>
<div class="card note"><div class="tag">By mechanic</div><ul>${idx.map(b => '<li>' + inline(b) + '</li>').join('')}</ul></div>
${open}
<h2>Release notes</h2>
<div class="chips">${chips}</div>
${rel}
<h2>Recent commits</h2>
<div class="sub">Updated by the next build after a commit.</div>
${commitsBlock(commits)}
</main></body></html>
`;
}

const strip = h => h.replace(COMMITS_RE, '');
export function roadmapStale() {
  let cur = '';
  try { cur = rd(OUT); } catch { return true; }
  return strip(cur) !== strip(roadmapPage([]));
}
// The build keeps the commits block as it is (so building after a commit never dirties the tree);
// only `node tools/gen_roadmap.mjs` refreshes it from git log.
export function writeRoadmap(refreshCommits = false) {
  let old = [];
  try { old = oldCommits(rd(OUT)); } catch { /* first run */ }
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, OUT), roadmapPage(refreshCommits ? mergeCommits(gitCommits(), old) : old));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeRoadmap(true);
  console.log(`${OUT} written`);
}
