#!/usr/bin/env node
// F1 (v0.81.0): validates every shipped and staged card effect against packages/engine/fx-schema.json and the engine's own parser.
//   node tools/fx_validate.mjs            -> shipped cards (build/all-cards.json + tokens.json): schema + engine parse; exit 1 on any error
//   node tools/fx_validate.mjs --staged   -> also compiles the staged pool (tools/compile_v2.py --partial) and writes docs/reports/fx-validate.md
//   node tools/fx_validate.mjs --static   -> schema checks only (no browser)
//   node tools/fx_validate.mjs --json     -> machine-readable result
// Checks: the schema is up to date with packages/engine/src; unknown card / effect / Burst / Magic / match / condition fields;
// unknown trigger, action, STATIC flag, Burst timing, Magic effect; action fields the action's code never reads; `residual`
// (list of up to 12 strings, each at most 400 characters); `fxComplete: true` with a residual; and BS.parseCard() errors.
// Format notes: docs/ai/effect-format.md.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildSchema, schemaText, SCHEMA_PATH } from './fx_schema.mjs';
import { ensureAllCards } from './all_cards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESIDUAL_MAX = 400, RESIDUAL_N = 12;

/** Schema errors of one card (plain JSON as stored). Returns a list of "path: message" strings. */
export function cardErrors(card, S) {
  const err = [], acts = new Set(Object.keys(S.actions)), cardOk = new Set([...S.cardFields, ...S.metaFields]);
  const keys = (o, allowed, path) => { for (const k of Object.keys(o)) if (!allowed.has(k)) err.push(`${path}: unknown field "${k}"`); };
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const cond = (o, path) => { if (isObj(o)) keys(o, new Set(S.conditions), path); };
  const match = (o, path) => { if (isObj(o)) keys(o, new Set(S.matchFields), path); };
  // every action anywhere (BY.cost / BY.then / END_BATTLE.then / nested lists are found by the walk)
  const walk = (o, path) => {
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (!isObj(o)) return;
    if (typeof o.do === 'string') {
      if (!acts.has(o.do)) err.push(`${path}: unknown action "${o.do}"`);
      else keys(o, new Set([...S.actionFields, ...S.actions[o.do].fields]), `${path} ${o.do}`);
      if (o.if != null) cond(o.if, `${path}.if`);
    }
    for (const [k, v] of Object.entries(o)) if (k !== 'if') walk(v, `${path}.${k}`);
  };
  keys(card, cardOk, 'card');
  (Array.isArray(card.effects) ? card.effects : []).forEach((e, i) => {
    const p = `effects[${i}]`;
    if (!isObj(e)) { err.push(`${p}: not an object`); return; }
    if (!S.triggers.includes(e.trigger)) err.push(`${p}: unknown trigger "${e.trigger}"`);
    keys(e, new Set(S.effectFields), p);
    if (e.flag != null && !S.staticFlags.includes(e.flag)) err.push(`${p}: unknown STATIC flag "${e.flag}"`);
    if (e.if != null) cond(e.if, `${p}.if`);
    if (e.match != null) match(e.match, `${p}.match`);
  });
  if (isObj(card.burst)) {
    keys(card.burst, new Set(S.burstFields), 'burst');
    if (!S.burstWhen.includes(card.burst.when)) err.push(`burst: unknown timing "${card.burst.when}"`);
    if (card.burst.if != null) cond(card.burst.if, 'burst.if');
  }
  if (isObj(card.magic)) {
    const m = card.magic;
    keys(m, new Set(S.magicFields), 'magic');
    if (m.effect != null && !S.magicEffects.includes(m.effect)) err.push(`magic: unknown effect "${m.effect}"`);
    if (Array.isArray(m.timing) && m.timing.some((t) => !S.magicTimings.includes(t))) err.push('magic: unknown timing');
    if (isObj(m.by)) for (const [k, b] of Object.entries(m.by)) if (isObj(b) && b.effect != null && !S.magicEffects.includes(b.effect)) err.push(`magic.by.${k}: unknown effect "${b.effect}"`);
  }
  walk(card, 'card');
  if (card.residual != null) {
    if (!Array.isArray(card.residual) || card.residual.length > RESIDUAL_N || card.residual.some((x) => typeof x !== 'string' || !x.trim()))
      err.push(`residual: must be a list of up to ${RESIDUAL_N} non-empty strings`);
    else card.residual.forEach((x, i) => { if (x.length > RESIDUAL_MAX) err.push(`residual[${i}]: ${x.length} characters (limit ${RESIDUAL_MAX}; parseCard drops the card)`); });
  }
  if (card.fxComplete === true && Array.isArray(card.residual) && card.residual.length) err.push('fxComplete: true with a residual list');
  return err;
}

/** BS.parseCard() over the cards in the built game (index.html). Returns {id: [errors]} for the cards it rejects. */
export async function engineErrors(cards) {
  const { openGame, closeBrowser } = await import('../tests/unit/lib/game.mjs');
  const { page } = await openGame('');
  try {
    return await page.evaluate((cs) => {
      const out = {};
      for (const c of cs) { const r = BS.parseCard(/^Token (Spirit|Nexus)$/.test(c.type) ? Object.assign({}, c, { type: c.type === 'Token Nexus' ? 'Nexus' : 'Spirit' }) : c);   /* as registerTokens() does */ if (!r.card) out[c.id] = r.errors.map((e) => e.replace(/"[^"]*" is reserved for a built-in card/, 'reserved id')); }
      return out;
    }, cards);
  } finally { await closeBrowser(); }
}

const tally = (errs) => { const g = {}; for (const [id, list] of Object.entries(errs)) for (const e of list) { const k = e.replace(/\[\d+\]/g, '[]'); (g[k] = g[k] || []).push(id); } return Object.entries(g).sort((a, b) => b[1].length - a[1].length); };

export async function validate({ staged = false, engine = true } = {}) {
  const res = { schemaStale: false, shipped: {}, staged: null };
  const S = buildSchema();
  try { res.schemaStale = readFileSync(SCHEMA_PATH, 'utf8') !== schemaText(S); } catch { res.schemaStale = true; }
  const shipped = [...JSON.parse(readFileSync(ensureAllCards(ROOT), 'utf8')), ...JSON.parse(readFileSync(join(ROOT, 'data/cards/tokens.json'), 'utf8'))];
  for (const c of shipped) { const e = cardErrors(c, S); if (e.length) res.shipped[c.id] = e; }
  res.shippedN = shipped.length;
  let pool = [];
  if (staged) {
    mkdirSync(join(ROOT, 'build'), { recursive: true });
    const out = join(ROOT, 'build/fx-staged.json');
    const r = spawnSync('python3', [join(ROOT, 'tools/compile_v2.py'), '--partial', '--out', out], { encoding: 'utf8', cwd: ROOT });
    if (r.status !== 0) throw new Error('compile_v2.py failed: ' + (r.stderr || r.stdout).slice(-400));
    pool = JSON.parse(readFileSync(out, 'utf8'));
    res.staged = {}; res.stagedN = pool.length;
    for (const c of pool) { const e = cardErrors(c, S); if (e.length) res.staged[c.id] = e; }
  }
  if (engine) {
    const shipEng = await engineErrors(shipped);
    for (const [id, e] of Object.entries(shipEng)) res.shipped[id] = (res.shipped[id] || []).concat(e.map((x) => 'parseCard: ' + x));
    if (staged) {
      const live = new Set(shipped.map((c) => c.id));
      const st = await engineErrors(pool.filter((c) => !live.has(c.id)));
      for (const [id, e] of Object.entries(st)) res.staged[id] = (res.staged[id] || []).concat(e.map((x) => 'parseCard: ' + x));
    }
  }
  return res;
}

function report(res) {
  const L = ['# Effect format validation (generated by tools/fx_validate.mjs --staged; do not edit)', '',
    `Schema: packages/engine/fx-schema.json (${res.schemaStale ? 'OUT OF DATE' : 'up to date'}). Format: docs/ai/effect-format.md.`, '',
    `Shipped cards: ${res.shippedN}, with errors: ${Object.keys(res.shipped).length} (must be 0).`, '',
    `Staged pool (tools/compile_v2.py --partial): ${res.stagedN} compiled cards, with errors: ${Object.keys(res.staged).length}. Staged errors do not fail the build; a card with errors cannot be promoted until they are fixed.`, ''];
  for (const [title, errs] of [['Shipped', res.shipped], ['Staged', res.staged]]) {
    const t = tally(errs); if (!t.length) continue;
    L.push(`## ${title} errors`, '', '| Error | Cards | Examples |', '|---|---|---|');
    for (const [k, ids] of t) L.push(`| ${k.replace(/\|/g, '/').slice(0, 160)} | ${ids.length} | ${ids.slice(0, 4).join(', ')} |`);
    L.push('');
  }
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2), staged = a.includes('--staged');
  const res = await validate({ staged, engine: !a.includes('--static') });
  if (staged) writeFileSync(join(ROOT, 'docs/reports/fx-validate.md'), report(res) + '\n');
  if (a.includes('--json')) { console.log(JSON.stringify(res)); process.exit(0); }
  const nS = Object.keys(res.shipped).length;
  console.log(`[fx_validate] schema ${res.schemaStale ? 'OUT OF DATE (run node tools/fx_schema.mjs; it asks for a SCHEMA_VERSION bump when the format changed)' : 'ok'}, shipped ${res.shippedN - nS}/${res.shippedN} ok` + (staged ? `, staged ${res.stagedN - Object.keys(res.staged).length}/${res.stagedN} ok (docs/reports/fx-validate.md)` : ''));
  for (const [k, ids] of tally(res.shipped).slice(0, 15)) console.log(`  ${ids.length}x ${k}  (${ids.slice(0, 3).join(', ')})`);
  process.exit(res.schemaStale || nS ? 1 : 0);
}
