#!/usr/bin/env node
// Builds the shipped single file index.html from packages/ and apps/web/.
//   node tools/build.mjs           -> writes index.html (+ build/game.js, the joined script for ESLint)
//   node tools/build.mjs --check   -> exits 1 when index.html is not the build of its sources (CI guard)
// apps/web/index.template.html : page shell with the /*@@CSS@@*/ and /*@@JS@@*/ marker lines
// apps/web/styles.css          : all CSS
// packages/engine/src/NN-name.js + apps/web/src/NN-name.js : the game script, joined in file-name order
//                           across both folders as ONE classic script (tools/src_parts.mjs)
//                           (top-level functions stay global: inline handlers, window.BS and tests rely on that)
// The built-in card pack comes from build/all-cards.json (the Saga files joined; tools/all_cards.mjs writes it) (between /*PACK_START*/ and /*PACK_END*/).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { codeMap } from './code_map.mjs';
import { srcParts } from './src_parts.mjs';
import { ensureAllCards } from './all_cards.mjs';
import { roadmapStale, writeRoadmap } from './gen_roadmap.mjs';
import { mindmapStale, writeMindmap } from './gen_mindmap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(ROOT, p), 'utf8');
const allCards = () => JSON.parse(readFileSync(ensureAllCards(ROOT), 'utf8'));   // build/all-cards.json, written here when missing or stale

// v0.99.0 (U8a, stylesheet budget B04): drop the spaces next to { } ; and after : and , outside strings; descendant-selector
// spaces and the spaces inside values (calc, font shorthands) stay, so the rules mean the same
function cssShrink(css) {
  return css.split(/("[^"\n]*"|'[^'\n]*')/).map((p, i) => i % 2 ? p : p.replace(/[ \t]*([{};])[ \t]*/g, '$1').replace(/([:,])[ \t]+/g, '$1')).join('');
}

// v0.51.0: the pack codec lives in packages/engine/src/01a-card-pack.js and is shared with the game (one implementation)
export function codec() {
  return new Function(rd('packages/engine/src/01a-card-pack.js') + '\nreturn { packCards, unpackCards, packBlockOf, inflateRaw, packBytes, loadPack };')();
}
// the pack JSON before compression (compact format); --check compares this, not the compressed bytes,
// so a different zlib build on CI cannot fail the check
export function packJson(cards) { return JSON.stringify(codec().packCards(cards)); }
// the embedded pack expression: loadPack("<base64 of raw DEFLATE level 9>"), one line, no "<" possible
export function packExpr(cards) { return 'loadPack("' + deflateRawSync(Buffer.from(packJson(cards), 'utf8'), { level: 9 }).toString('base64') + '")'; }
export const PACK_RE = /\/\*PACK_START\*\/const BUILTIN_PACK = loadPack\("([A-Za-z0-9+\/=]*)"\);\/\*PACK_END\*\//;

export function packBlob(cards) {
  // same bytes as the old tools/embed_pack.py (json.dumps, compact, no ASCII escaping, "</" escaped)
  return JSON.stringify(cards).replace(/<\//g, '<\\/');
}

// The joined game script of the given parts, with the card pack and the token cards filled in.
function joinScript(parts, cards) {
  // v0.50: the data-source "note" of each card is for maintainers (data/cards); the game never reads it, so it is not embedded
  const pack = '/*PACK_START*/const BUILTIN_PACK = ' + packExpr(cards.map(({ note, ...c }) => c)) + ';/*PACK_END*/';
  let js = parts.map(p => rd(p.rel)).join('');
  const n = js.split('/*PACK_START*//*PACK_END*/').length - 1;
  if (n !== 1) throw new Error(`expected exactly one empty pack marker in the script parts, found ${n}`);
  js = js.replace('/*PACK_START*//*PACK_END*/', () => pack);
  // Token cards (v0.35): data/cards/tokens.json, kept outside every Deck, between /*TOKENS_START*/ and /*TOKENS_END*/
  const tokens = JSON.parse(rd('data/cards/tokens.json'));
  if (js.split('/*TOKENS_START*//*TOKENS_END*/').length !== 2) throw new Error('expected exactly one empty token marker in the script parts');
  js = js.replace('/*TOKENS_START*//*TOKENS_END*/', () => '/*TOKENS_START*/const BUILTIN_TOKENS = ' + packBlob(tokens) + ';/*TOKENS_END*/');
  // v0.131.0 U14g: English flavor text per card id (data/index/flavor.json, tools/fetch_flavor.py), a compressed blob for the Lore tab;
  // only the web parts carry the marker, the headless engine script does not
  if (js.includes('/*FLAVOR_START*//*FLAVOR_END*/')) {
    const fp = join(ROOT, 'data/index/flavor.json'), fl = existsSync(fp) ? readFileSync(fp, 'utf8') : '{}';
    js = js.replace('/*FLAVOR_START*//*FLAVOR_END*/', () => '/*FLAVOR_START*/const BUILTIN_FLAVOR = "' + deflateRawSync(Buffer.from(JSON.stringify(JSON.parse(fl)), 'utf8'), { level: 9 }).toString('base64') + '";/*FLAVOR_END*/');
  }
  return js;
}
// v0.82.0 (F2 = M2): the script without the web host (packages/protocol + packages/engine parts only), for the
// headless Node runner packages/engine/headless.mjs. Same pack and tokens as the game.
export function engineScript(opts = {}) {
  const parts = srcParts(ROOT).filter(p => !p.rel.startsWith('apps/'));
  return joinScript(parts, opts.cards || allCards());
}
// v0.121.0 U14a: the three UI fonts (SIL OFL, Latin subsets in apps/web/fonts) ride inside the page as data URIs; no network
const FONTS = [['Oxanium', 400, 800], ['Saira', 400, 800], ['Orbitron', 400, 900]];
const fontFaces = () => FONTS.map(([n, a, b]) => `@font-face{font-family:"${n}";font-weight:${a} ${b};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(join(ROOT, 'apps/web/fonts', n + '.woff2')).toString('base64')}) format("woff2")}`).join('\n') + '\n';
export function buildParts(opts = {}) {   // opts.cards: build with another card list (load-time test of the full pack)
  const parts = srcParts(ROOT), files = parts.map(p => p.name);
  const cards = opts.cards || allCards();
  const js = joinScript(parts, cards);
  const tpl = rd('apps/web/index.template.html');
  for (const m of ['/*@@CSS@@*/\n', '/*@@JS@@*/\n']) if (tpl.split(m).length !== 2) throw new Error('template marker missing: ' + m.trim());
  // v0.86.0: the page carries the stylesheet without comments and indentation (apps/web/styles.css keeps both; budget B04)
  const css = fontFaces() + cssShrink([rd('apps/web/styles.css'), rd('apps/web/mockup.css'), rd('apps/web/mk-glue.css')].join(String.fromCharCode(10)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]+/gm, '').replace(/\n{2,}/g, '\n'));
  const html = tpl.replace('/*@@CSS@@*/\n', () => css).replace('/*@@JS@@*/\n', () => js);
  return { html, js, files, cards: cards.length };
}


// v0.80.0 (A2 prep c): card counts come from docs/reports/card-counts.json (written by tools/unlock_report.py); the build
// never reads the staging files (test B07) and never falls back to an old total: a missing or out-of-date file fails the build.
function cardCounts() {
  let j; try { j = JSON.parse(rd('docs/reports/card-counts.json')); } catch { throw new Error('docs/reports/card-counts.json missing or invalid: run python3 tools/unlock_report.py'); }
  const n = allCards().length;
  if (!(j.total > 0) || !(j.complete >= 0) || j.playable !== n) throw new Error(`docs/reports/card-counts.json is out of date (playable ${j.playable}, data/cards has ${n}): run python3 tools/unlock_report.py`);
  return j;
}
// README "Current build" line follows packages/engine/src/01-cards.js VERSION and the playable card count (it went stale at v0.41.5).
const README_RE = /^Current build: \*\*v[^*]+\*\*.*$/m;
function readmeLine() {
  const v = rd('packages/engine/src/01-cards.js').match(/const VERSION = '([^']+)'/)[1];
  const { playable: n, total, complete: k } = cardCounts();      // v0.79.0 (A1): complete = every effect runs
  return `Current build: **v${v}** (${n.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} cards playable, ${k.toLocaleString('en-US')} complete). Download \`aeterna-v${v}.html\` from the [latest release](https://github.com/odinguard009/aeterna-experiment/releases/latest) and open it in Chrome or Edge; release notes are in [CHANGELOG.md](CHANGELOG.md).`;
}
// v0.59.7 (C5): release notes live in CHANGELOG.md; its newest "## vX.Y.Z" heading must be the current VERSION.
const changelogHead = () => (rd('CHANGELOG.md').match(/^## (v\d[\d.]*)\s*$/m) || [, null])[1];
const changelogStale = () => changelogHead() !== 'v' + rd('packages/engine/src/01-cards.js').match(/const VERSION = '([^']+)'/)[1];
const readmeStale = () => { const r = rd('README.md'); return README_RE.test(r) && r.match(README_RE)[0] !== readmeLine(); };
const writeReadme = () => { const r = rd('README.md'); if (README_RE.test(r)) writeFileSync(join(ROOT, 'README.md'), r.replace(README_RE, readmeLine())); };
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { html, js, files, cards } = buildParts();
  if (process.argv.includes('--check')) {
    const cur = rd('index.html'), strip = h => h.replace(PACK_RE, '/*PACK*/'), m = cur.match(PACK_RE);
    const packOk = m && new TextDecoder().decode(codec().inflateRaw(Buffer.from(m[1], 'base64'))) === packJson(allCards().map(({ note, ...c }) => c));
    if (strip(cur) !== strip(html) || !packOk) { console.error('index.html is out of date: run  node tools/build.mjs'); process.exit(1); }
    if (rd('docs/ai/code-map.md') !== codeMap()) { console.error('docs/ai/code-map.md is out of date: run  node tools/build.mjs'); process.exit(1); }
    if (mindmapStale()) { console.error('docs/roadmap.html is out of date: run  node tools/build.mjs (edit docs/roadmap-data.json, not the HTML)'); process.exit(1); }
    if (roadmapStale()) { console.error('docs/progress.html is out of date: run  node tools/build.mjs'); process.exit(1); }
    if (readmeStale()) { console.error('README.md "Current build" line is out of date: run  node tools/build.mjs'); process.exit(1); }
    if (changelogStale()) { console.error(`CHANGELOG.md newest heading is ${changelogHead()}, not the current VERSION: add the release notes there`); process.exit(1); }
    console.log('index.html, the code map and the roadmap page match their sources');
  } else {
    writeFileSync(join(ROOT, 'index.html'), html);
    mkdirSync(join(ROOT, 'docs/ai'), { recursive: true });
    writeFileSync(join(ROOT, 'docs/ai/code-map.md'), codeMap());
    writeMindmap();
    writeRoadmap();
    writeReadme();
    console.log(`built index.html from ${files.length} script parts, ${cards} cards, ${html.length} chars`);
  }
  mkdirSync(join(ROOT, 'build'), { recursive: true });
  writeFileSync(join(ROOT, 'build/game.js'), js);
}
