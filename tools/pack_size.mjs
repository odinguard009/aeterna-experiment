#!/usr/bin/env node
// v0.51.0: projected size of the embedded card pack when every card is playable.
//   node tools/pack_size.mjs          -> one line per format (plain JSON vs compact codec), raw and gzip bytes
//   node tools/pack_size.mjs --json   -> the same numbers as JSON (tests/unit/budget.test.mjs reads them)
// Projection = data/cards (promoted) + data/import (staged, reduced to the fields tools/promote_import.py keeps),
// each staged card given the average "effects"/"residual" size of today's promoted cards (the compiler adds those).
// Reads data/import only for this measurement; the build never does (budget test B07).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codec, packBlob, packExpr } from './build.mjs';
import { ensureAllCards } from './all_cards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = ['id', 'name', 'name_jp', 'type', 'color', 'cost', 'reduction', 'symbols', 'levels', 'families', 'text', 'image', 'block', 'saga', 'rarity', 'collab', 'bicon'];
export function projectedCards() {
  const live = JSON.parse(readFileSync(ensureAllCards(ROOT), 'utf8')).map(({ note, ...c }) => c);
  const have = new Set(live.map(c => c.id)), dir = join(ROOT, 'data/import');
  // the promoted card whose effects JSON is closest to the mean size stands in for the compiler's output
  const withFx = live.filter(c => c.effects), len = c => JSON.stringify(c.effects).length;
  const mean = withFx.reduce((s, c) => s + len(c), 0) / (withFx.length || 1);
  const fx = withFx.length ? withFx.reduce((a, c) => (Math.abs(len(c) - mean) < Math.abs(len(a) - mean) ? c : a)).effects : undefined;
  const staged = [];
  if (existsSync(dir)) for (const f of readdirSync(dir).filter(f => /^saga-\d\d\.json$/.test(f)).sort())
    for (const c of JSON.parse(readFileSync(join(dir, f), 'utf8'))) {
      if (have.has(c.id)) continue;
      const n = {}; for (const k of KEEP) if (k in c) n[k] = c[k];
      if (c.keyword) n.mechanics = [c.keyword];
      n.fxComplete = false;
      if (fx) n.effects = fx;                                    // placeholder of realistic size for the compiler's output
      staged.push(n);
    }
  return live.concat(staged);
}
export function measure(cards = projectedCards()) {
  const gz = s => gzipSync(s, { level: 9 }).length;
  const plain = packBlob(cards), compact = packExpr(cards);
  const back = codec().unpackCards(codec().packCards(cards));
  return { cards: cards.length, plain: plain.length, plainGzip: gz(plain), compact: Buffer.byteLength(compact), compactGzip: gz(compact), roundTrip: JSON.stringify(back.map(c => Object.keys(c).sort().map(k => [k, c[k]]))) === JSON.stringify(cards.map(c => Object.keys(c).sort().filter(k => c[k] != null).map(k => [k, c[k]]))) };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const m = measure();
  if (process.argv.includes('--json')) console.log(JSON.stringify(m));
  else console.log(`${m.cards} cards: plain ${(m.plain / 1e6).toFixed(2)} MB (gzip ${(m.plainGzip / 1e6).toFixed(2)} MB), compact ${(m.compact / 1e6).toFixed(2)} MB (gzip ${(m.compactGzip / 1e6).toFixed(2)} MB), round trip ${m.roundTrip ? 'ok' : 'FAILED'}`);
}
