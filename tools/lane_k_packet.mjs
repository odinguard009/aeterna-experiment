#!/usr/bin/env node
// Lane K work packet: the next 3-4 partial cards, their text, open glossary tags and rule notes.
// Read-only: writes build/lane-k-packet.md (generated, never committed) unless --summary is used.
// Usage: node tools/lane_k_packet.mjs [--block A|all] [--cards N] [--out FILE] [--summary]
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const USAGE = `Lane K work packet
Usage: node tools/lane_k_packet.mjs [options]
  --block A|all   cards to consider (default A; falls back to all when A is finished)
  --cards N       cards in the packet (default 4)
  --out FILE      output file (default build/lane-k-packet.md)
  --summary       print machine-readable counts (complete=..., blockA_partial=..., next_tags=...)
  --help          this text`;

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--summary') o.summary = true;
    else if (a === '--block') o.block = argv[++i];
    else if (a === '--cards') o.cards = Number(argv[++i]);
    else if (a === '--out') o.out = argv[++i];
    else { console.error('unknown argument: ' + a); process.exit(2); }
  }
  return o;
}
const args = parseArgs(process.argv.slice(2));
if (args.help) { console.log(USAGE); process.exit(0); }
const N = Number.isFinite(args.cards) && args.cards > 0 ? args.cards : 4;
const BLOCK = args.block || 'A';

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
function dirCards(dir) {
  const out = [];
  for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.startsWith('saga-') && x.endsWith('.json')).sort()) {
    for (const c of readJson(dir + '/' + f)) out.push({ ...c, source: dir + '/' + f });
  }
  return out;
}
const cards = dirCards('data/cards');
const staged = dirCards('data/import');
const playable = new Set(cards.map((c) => c.id));
const stagedOnly = staged.filter((c) => !playable.has(c.id));
const residual = readJson('data/glossary/residual-tags.json');
const glossary = new Map(readJson('data/glossary/effects.json').map((e) => [e.id, e]));
const counts = readJson('docs/reports/card-counts.json');
const partial = cards.filter((c) => !c.fxComplete);
// residual-tags.json lists every glossary tag a residual clause matches; only a tag whose status is not
// "wired" is still open (same rule as tools/residual_tags.py).
const openTags = (id) => (residual[id] || []).filter((t) => { const g = glossary.get(t); return !g || g.status !== 'wired'; });

function releaseBaseline() {
  const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const i = changelog.indexOf('\n## v');
  if (i >= 0) {
    const next = changelog.indexOf('\n## ', i + 1);
    const section = changelog.slice(i + 1, next < 0 ? undefined : next);
    const m = section.match(/->\s*([\d,]+)\s+of\s+[\d,]+/);
    if (m) {
      const v = section.match(/^## (v[\d.]+)/);
      return { baseline: Number(m[1].replace(/,/g, '')), version: v ? v[1] : '?' };
    }
  }
  try {
    const tag = execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const old = JSON.parse(execFileSync('git', ['show', tag + ':docs/reports/card-counts.json'], { cwd: ROOT, encoding: 'utf8' }));
    return { baseline: old.complete, version: tag };
  } catch { return null; }
}
const base = releaseBaseline();
const cycle = base ? Math.max(0, counts.complete - base.baseline) : null;

// Same greedy order as tools/residual_tags.py: wire a tag, count the cards that finish, repeat.
function greedyOrder(pool) {
  const open = new Map();
  for (const c of pool) { const ts = openTags(c.id); if (ts.length) open.set(c.id, ts); }
  const wired = new Set();
  const order = [];
  for (let step = 0; step < 5; step++) {
    const tags = new Set();
    for (const ts of open.values()) for (const t of ts) if (!wired.has(t)) tags.add(t);
    let best = null;
    for (const tag of tags) {
      let finish = 0, touch = 0;
      for (const ts of open.values()) {
        if (!ts.includes(tag)) continue;
        touch++;
        if (ts.every((t) => t === tag || wired.has(t))) finish++;
      }
      if (!best || finish > best.finish || (finish === best.finish && touch > best.touch) || (finish === best.finish && touch === best.touch && tag < best.tag)) best = { tag, finish, touch };
    }
    if (!best) break;
    order.push(best);
    wired.add(best.tag);
    for (const [id, ts] of open) if (ts.every((t) => wired.has(t))) open.delete(id);
  }
  return order;
}

if (args.summary) {
  const blockA = cards.filter((c) => c.block === 'A');
  const poolA = partial.filter((c) => c.block === 'A');
  const stats = greedyOrder(poolA.length ? poolA : partial).slice(0, 5);
  console.log([
    'complete=' + counts.complete,
    'total=' + counts.total,
    'playable=' + counts.playable,
    'blockA_complete=' + blockA.filter((c) => c.fxComplete).length,
    'blockA_partial=' + poolA.length,
    'blockA_staged=' + stagedOnly.filter((c) => c.block === 'A').length,
    'baseline_complete=' + (base ? base.baseline : 'unknown'),
    'last_release=' + (base ? base.version : 'unknown'),
    'new_since_release=' + (cycle === null ? 'unknown' : cycle),
    'release_target=' + (base ? base.baseline + 50 : 'unknown'),
    'next_tags=' + (stats.length ? stats.map((s) => s.tag + '(' + s.finish + ')').join(',') : 'none'),
  ].join('\n'));
  process.exit(0);
}

let pool = BLOCK === 'all' ? partial : partial.filter((c) => c.block === BLOCK);
let pickedBlock = BLOCK;
if (!pool.length && BLOCK !== 'all') { pool = partial; pickedBlock = 'all'; }
const stats = greedyOrder(pool);
const top = stats[0];
const order = (a, b) => openTags(a.id).length - openTags(b.id).length || a.id.localeCompare(b.id);
const finishable = top ? pool.filter((c) => { const ts = openTags(c.id); return ts.length > 0 && ts.every((t) => t === top.tag); }).sort(order) : [];
const withTop = top ? pool.filter((c) => openTags(c.id).includes(top.tag)).sort(order) : [];
const fill = [...finishable, ...withTop, ...pool.filter((c) => !withTop.includes(c) && !finishable.includes(c)).sort(order)];
const picked = [];
for (const c of fill) { if (!picked.includes(c)) picked.push(c); if (picked.length === N) break; }
const testText = new Map();
for (const f of readdirSync(join(ROOT, 'tests/unit')).filter((f) => f.endsWith('.test.mjs'))) testText.set(f, readFileSync(join(ROOT, 'tests/unit', f), 'utf8'));
const testsFor = (id) => [...testText].filter(([, t]) => t.includes(id)).map(([f]) => 'tests/unit/' + f).slice(0, 3);
const levels = (c) => (c.levels || []).map((l, i) => 'Lv' + (i + 1) + ' ' + l.cores + '/' + (l.bp || '-')).join(', ');

const lines = [];
lines.push('# Lane K work packet - ' + new Date().toISOString().slice(0, 10));
lines.push('');
lines.push('Scope: ' + (pickedBlock === 'all' ? 'all blocks (block A is finished)' : 'block ' + pickedBlock) + '; ' + pool.length + ' partial cards; cycle ' + (cycle === null ? '?' : cycle) + '/50.');
if (stats.length) lines.push('Suggested order: ' + stats.slice(0, 5).map((s) => s.tag + ' (finish ' + s.finish + ', touches ' + s.touch + ')').join(' > '));
lines.push('');
picked.forEach((c, i) => {
  lines.push('## ' + (i + 1) + '. ' + c.id + ' - ' + c.name);
  lines.push('- source: ' + c.source);
  lines.push('- block ' + c.block + ' | ' + c.type + ' | ' + c.color + ' | cost ' + c.cost + ' | ' + levels(c));
  if (c.text) lines.push('- text: ' + c.text.replace(/\s*\n\s*/g, ' / '));
  if (c.residual && c.residual.length) lines.push('- residual: ' + c.residual.join(' / '));
  const ts = openTags(c.id);
  lines.push('- open tags: ' + (ts.length ? ts.join(', ') : '(none)'));
  for (const t of ts) {
    const g = glossary.get(t);
    if (g) lines.push('  - ' + t + ' (' + (g.status || '?') + '): ' + (g.meaning || '') + (g.rule ? ' - rule: ' + g.rule : ''));
  }
  const tests = testsFor(c.id);
  if (tests.length) lines.push('- existing tests: ' + tests.join(', '));
  lines.push('- do: read the text against the JSON; wire a missing glossary tag once in the engine; add the card test.');
  lines.push('');
});
lines.push('Test template: `tests/unit/k_cards_3.test.mjs` (sharedBoard from `tests/unit/lib/game.mjs`). Run `npm run -s loop` once per bundle.');

const out = args.out || 'build/lane-k-packet.md';
mkdirSync(dirname(join(ROOT, out)), { recursive: true });
writeFileSync(join(ROOT, out), lines.join('\n') + '\n');
console.log('packet: ' + out + ' (' + picked.length + ' cards, tag ' + (top ? top.tag : 'none') + '; cycle ' + (cycle === null ? '?' : cycle) + '/50)');
