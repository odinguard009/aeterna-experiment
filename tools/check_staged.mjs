#!/usr/bin/env node
// v0.51.2: runs the game's own parseCard() over every staged card (data/import/saga-NN.json, reduced to the fields
// tools/promote_import.py keeps) and groups the rejections by error.
//   node tools/check_staged.mjs          -> "loadable X / Y" + one line per error group (with 3 example ids)
//   node tools/check_staged.mjs --json   -> {ok, total, groups: {error: [ids...]}}
// Known data gaps (cards that stay unloadable until the source data is fixed) are listed in KNOWN_GAPS below;
// the exit code is 1 when any other card fails to load.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame, closeBrowser } from '../tests/unit/lib/game.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = ['id', 'name', 'name_jp', 'type', 'color', 'cost', 'reduction', 'symbols', 'levels', 'families', 'text', 'image', 'block', 'saga', 'rarity', 'collab', 'bicon'];
// Fandom export has no levels for these Spirits (empty page data or a page template the export did not parse),
// two Braves have neither levels nor combine data, and BS60-XX01 lists one symbol per colour (6; the engine allows 5).
export const KNOWN_GAPS = new Set(['BS14-008', 'BS14-X01', 'BS16-036', 'BS18-009', 'BS55-XX01', 'BS42-006', 'BS42-021', 'BS42-038', 'BS77-AX01', 'BS77-AX02', 'BS77-AX03', 'BS42-074', 'BS44-072', 'BS60-XX01']);

export function stagedCards() {
  const dir = join(ROOT, 'data/import'), out = [];
  for (const f of readdirSync(dir).filter(f => /^saga-\d\d\.json$/.test(f)).sort())
    for (const c of JSON.parse(readFileSync(join(dir, f), 'utf8'))) { const n = {}; for (const k of KEEP) if (k in c) n[k] = c[k]; out.push(n); }
  return out;
}

export async function checkStaged(cards = stagedCards()) {
  const { page } = await openGame('');
  try {
    return await page.evaluate(cs => {
      const groups = {}; let ok = 0;
      for (const c of cs) {
        const r = BS.parseCard(c);
        if (r.card) { ok++; continue; }
        for (const e of r.errors) { const k = c.type + ': ' + e.replace(/"[^"]*" is reserved for a built-in card/, 'reserved id'); (groups[k] = groups[k] || []).push(c.id); }
      }
      return { ok, total: cs.length, groups };
    }, cards);
  } finally { await closeBrowser(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await checkStaged();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else {
    console.log(`loadable ${r.ok} / ${r.total}`);
    for (const [k, ids] of Object.entries(r.groups)) console.log(`  ${ids.length}  ${k.slice(0, 90)}  e.g. ${ids.slice(0, 3).join(', ')}`);
  }
  const unexpected = [...new Set(Object.values(r.groups).flat())].filter(id => !KNOWN_GAPS.has(id));
  if (unexpected.length) { console.error('unexpected rejects: ' + unexpected.slice(0, 20).join(', ')); process.exit(1); }
}
