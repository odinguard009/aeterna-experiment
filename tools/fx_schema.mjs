#!/usr/bin/env node
// F1 (v0.81.0): machine-readable schema of the card effect format, generated from packages/engine/src.
//   node tools/fx_schema.mjs           -> writes packages/engine/fx-schema.json
//   node tools/fx_schema.mjs --check   -> exit 1 when the committed schema differs from the source (run by tools/fx_validate.mjs)
// The schema lists every trigger, condition, STATIC flag, Burst timing, Magic effect, the fields parseEffects / parseBurst /
// parseCard read, and per action the fields its code reads (`a.<field>` in the action, its wrappers and the helpers it calls).
// It is read by tools/fx_validate.mjs; docs/ai/effect-format.md explains it. A change to the effect format = bump SCHEMA_VERSION.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 146;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'packages/engine/src');
export const SCHEMA_PATH = join(ROOT, 'packages/engine/fx-schema.json');

// Card fields the engine does not read: tooling and source metadata kept in data/cards (not effect format).
const META_FIELDS = ['note', 'mechanics', 'name_jp', 'text_partial', 'icons_verified', 'text_verified_web', 'color', 'ex_symbols', 'source', 'saga'];

/** Index just past the bracket that closes the one at `open` (skips strings, template literals, comments, regex literals). */
export function closeOf(s, open) {
  const pairs = { '{': '}', '(': ')', '[': ']' }, stack = [pairs[s[open]]];
  let i = open + 1, prev = s[open];
  while (i < s.length && stack.length) {
    const ch = s[i];
    if (ch === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) i = s.length; continue; }
    if (ch === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 2; continue; }
    if (ch === '"' || ch === "'") { i++; while (i < s.length && s[i] !== ch) i += s[i] === '\\' ? 2 : 1; i++; prev = ch; continue; }
    if (ch === '`') { i = skipTemplate(s, i); prev = '`'; continue; }
    if (ch === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(prev)) {      // regex literal
      i++; let cls = false;
      while (i < s.length && (cls || s[i] !== '/')) { if (s[i] === '\\') i++; else if (s[i] === '[') cls = true; else if (s[i] === ']') cls = false; i++; }
      i++; while (/[a-z]/.test(s[i] || '')) i++; prev = 'r'; continue;
    }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === stack[stack.length - 1]) stack.pop();
    if (!/\s/.test(ch)) prev = ch;
    i++;
  }
  return i;
}
function skipTemplate(s, i) {
  i++;
  while (i < s.length && s[i] !== '`') {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === '$' && s[i + 1] === '{') { i = closeOf(s, i + 1); continue; }
    i++;
  }
  return i + 1;
}

const uniq = (a) => [...new Set(a)].sort();
const fieldsIn = (t, v = 'a') => {
  const out = [...t.matchAll(new RegExp(`\\b${v}\\.([A-Za-z_]\\w*)`, 'g'))].map((m) => m[1]);
  // `a[k]` over a list of names (the 02l/02m filter wrappers): the quoted names in that chunk count too
  if (new RegExp(`\\b${v}\\[k\\]`).test(t)) for (const l of t.matchAll(/const [A-Z_]+ = \[([^\]]*)\]/g)) for (const m of l[1].matchAll(/'([a-z][A-Za-z]+)'/g)) out.push(m[1]);
  return out;
};
const strList = (src, name) => {
  const m = src.match(new RegExp(`(?:const|let) ${name} = (?:new Set\\()?\\[`));
  if (!m) throw new Error(`fx_schema: ${name} not found`);
  const at = m.index + m[0].length - 1, body = src.slice(at, closeOf(src, at));
  return [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
};
const objKeys = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = \\{`));
  if (!m) throw new Error(`fx_schema: ${name} not found`);
  const at = m.index + m[0].length - 1, body = src.slice(at + 1, closeOf(src, at) - 1), keys = [];
  for (let i = 0; i < body.length;) {          // top-level keys only
    const k = body.slice(i).match(/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*([A-Za-z_]\w*|'[^']+')\s*:/);
    if (!k) break;
    keys.push(k[1].replace(/'/g, '')); i += k[0].length;
    let j = i; while (j < body.length && body[j] !== ',') { if ('{(['.includes(body[j])) j = closeOf(body, j); else if (body[j] === '`') j = skipTemplate(body, j); else if (body[j] === "'" || body[j] === '"') { const q = body[j]; j++; while (body[j] !== q) j += body[j] === '\\' ? 2 : 1; j++; } else j++; }
    i = j + 1;
  }
  return keys;
};
const fnBody = (src, name) => {
  const m = src.match(new RegExp(`function ${name}\\s*\\(`));
  if (!m) throw new Error(`fx_schema: function ${name} not found`);
  const b = src.indexOf('{', closeOf(src, m.index + m[0].length - 1));
  return src.slice(b, closeOf(src, b));
};

/** Top-level statements of one file (comments, strings and bracketed code skipped as a whole). */
function topChunks(s) {
  const out = []; let start = 0, i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '/' && s[i + 1] === '/') { const e = s.indexOf('\n', i); i = e < 0 ? s.length : e; continue; }
    if (ch === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 2; continue; }
    if (ch === '"' || ch === "'") { i++; while (i < s.length && s[i] !== ch) i += s[i] === '\\' ? 2 : 1; i++; continue; }
    if (ch === '`') { i = skipTemplate(s, i); continue; }
    if ('{(['.includes(ch)) { const e = closeOf(s, i); if (e > s.length) throw new Error('fx_schema: unbalanced bracket at ' + s.slice(i, i + 60)); i = e; continue; }
    if (ch === '\n') { if (s.slice(start, i).trim()) out.push(s.slice(start, i)); start = i + 1; }
    i++;
  }
  if (s.slice(start).trim()) out.push(s.slice(start));
  return out;
}

export function buildSchema() {
  const files = readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
  const texts = files.map((f) => readFileSync(join(SRC, f), 'utf8')), all = texts.join('\n');
  // 1. action blocks: `const FX_ACTIONS = {`, every `Object.assign(FX_ACTIONS, {` and `FX_ACTIONS.NAME = {`
  const actions = {}, rest = [];
  for (const t of texts) for (const ch of topChunks(t)) {
    const m = ch.match(/const FX_ACTIONS = \{|Object\.assign\(FX_ACTIONS, \{/);
    if (m) {
      const at = m.index + m[0].length - 1, body = ch.slice(at + 1, closeOf(ch, at) - 1);
      const ent = [...body.matchAll(/^ {2}([A-Z][A-Z0-9_]+): \{/gm)];
      ent.forEach((e, i) => { actions[e[1]] = { text: body.slice(e.index, i + 1 < ent.length ? ent[i + 1].index : body.length) }; });
      continue;
    }
    for (const d of ch.matchAll(/FX_ACTIONS\.([A-Z][A-Z0-9_]+) = \{/g)) { const at = d.index + d[0].length - 1; actions[d[1]] = { text: ch.slice(at, closeOf(ch, at)) }; }
    rest.push(ch);
  }
  // 2. helpers that take the action object: function f(c, a ...) / function f(a ...)
  const helpers = {};
  for (const m of all.matchAll(/function (\w+)\s*\(\s*(?:c\s*,\s*)?a\b[^)]*\)\s*\{/g)) {
    const b = m.index + m[0].length - 1; helpers[m[1]] = all.slice(b, closeOf(all, b));
  }
  // 3. top-level code that wraps or extends an action (const D = FX_ACTIONS.NAME, ...): its fields count for that action
  //    An IIFE `(() => { ... })();` is split into its statements; `const D = FX_ACTIONS.NAME` aliases and the local helpers
  //    an attributed statement uses (`const okNew = a => ...`, `const NEW = [...]`) count for NAME too.
  for (const ch of rest) {
    const iife = ch.match(/\(\(\) => \{/);
    const stmts = iife ? topChunks(ch.slice(iife.index + iife[0].length, closeOf(ch, iife.index + iife[0].length - 1) - 1)) : [ch];
    const alias = {};
    for (const st of stmts) for (const m of st.matchAll(/\b(?:const|let)?\s*(\w+) = FX_ACTIONS\.([A-Z][A-Z0-9_]+)\b(?!\.)/g)) alias[m[1]] = m[2];
    const local = {};
    for (const st of stmts) { const m = st.match(/^\s*(?:const|let|function)\s+(\w+)/); if (m) local[m[1]] = st; }
    const owners = (st) => new Set([...[...st.matchAll(/FX_ACTIONS\.([A-Z][A-Z0-9_]+)/g)].map((x) => x[1]), ...Object.keys(alias).filter((k) => new RegExp(`\\b${k}\\.`).test(st)).map((k) => alias[k])]);
    for (const st of stmts) {
      if (/FX_ACTIONS\.[A-Z0-9_]+ = \{/.test(st)) continue;          // a definition (step 1), not a wrapper
      const names = [...owners(st)].filter((n) => actions[n]); if (!names.length) continue;
      let text = st; const used = new Set();
      for (let grow = true; grow;) { grow = false; for (const [k, body] of Object.entries(local)) if (!used.has(k) && body !== st && new RegExp(`\\b${k}\\b`).test(text)) { used.add(k); text += '\n' + body; grow = true; } }
      for (const n of names) actions[n].text += '\n' + text;
    }
  }
  const out = {};
  for (const [name, { text }] of Object.entries(actions)) {
    let f = fieldsIn(text); const seen = new Set();
    const visit = (t) => { for (const [h, body] of Object.entries(helpers)) if (!seen.has(h) && new RegExp(`\\b${h}\\(`).test(t)) { seen.add(h); f = f.concat(fieldsIn(body)); visit(body); } };
    visit(text);
    out[name] = { fields: uniq(f.filter((x) => !['do', 'length'].includes(x))) };
  }
  // 4. effect, Burst and card fields read by the parsers
  const effectFields = uniq(fieldsIn(fnBody(all, 'parseEffects'), 'e').concat(fieldsIn(fnBody(all, 'invokeParse'), 'e')));
  const burstFields = uniq(fieldsIn(fnBody(all, 'parseBurst'), 'b').concat(['when', 'actions']));
  // parseCard delegates its levels and Magic sections to parseLevels / parseMagicOf (v0.106.0 split),
  // so the card and Magic fields are the union of the three bodies.
  const pc = [fnBody(all, 'parseCard'), fnBody(all, 'parseMagicOf'), fnBody(all, 'parseLevels')].join('\n');
  const cardFields = uniq(fieldsIn(pc, 'o').concat(fieldsIn(pc, 'c')).filter((x) => !['length', 'some', 'map', 'trim'].includes(x)));
  const magicFields = uniq(fieldsIn(pc, 'm'));
  const matchFields = uniq(fieldsIn(fnBody(all, 'fxMatch'), 'm'));
  const actionFields = uniq(fieldsIn(fnBody(all, 'runActions')));      // every action: do, if, cost ("by <action>" stops the rest when unpaid)
  return {
    schemaVersion: SCHEMA_VERSION,
    note: 'Generated by tools/fx_schema.mjs from packages/engine/src; do not edit. Format notes: docs/ai/effect-format.md.',
    triggers: strList(all, 'FX_TRIGGERS'),
    conditions: uniq(strList(all, 'FX_COND_KEYS')),
    staticFlags: strList(all, 'STATIC_FLAGS'),
    burstWhen: objKeys(all, 'BURST_WHEN'),
    magicEffects: objKeys(all, 'MAGIC_FX').concat(all.includes("MAGIC_FX.ACTIONS =") ? ['ACTIONS'] : []),
    magicTimings: strList(all, 'MAGIC_TIMINGS'),
    actionFields, effectFields, burstFields, magicFields, matchFields, cardFields, metaFields: META_FIELDS.slice().sort(),
    actions: Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]])),
  };
}

export const schemaText = (s) => JSON.stringify(s, null, 1) + '\n';

/** The format part of a schema (everything but the version and the note): a change here needs a SCHEMA_VERSION bump. */
export const formatOf = (s) => { const { schemaVersion, note, ...f } = s; return JSON.stringify(f); };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const s = buildSchema(), text = schemaText(s);
  const cur = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf8') : '';
  const old = cur ? JSON.parse(cur) : null;
  if (old && formatOf(old) !== formatOf(s) && old.schemaVersion >= s.schemaVersion) {
    console.log(`fx-schema: the effect format changed (engine source) but SCHEMA_VERSION is still ${s.schemaVersion}: bump it in tools/fx_schema.mjs and note the change in docs/ai/effect-format.md`);
    process.exit(1);
  }
  if (process.argv.includes('--check')) {
    if (cur !== text) { console.log('fx-schema.json is out of date: run node tools/fx_schema.mjs'); process.exit(1); }
    console.log('fx-schema.json up to date');
  } else { writeFileSync(SCHEMA_PATH, text); console.log(`fx-schema.json v${s.schemaVersion}: ${Object.keys(s.actions).length} actions, ${s.triggers.length} triggers, ${s.conditions.length} conditions`); }
}
