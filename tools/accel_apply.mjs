#!/usr/bin/env node
// Accel reduction icons for library cards that carry an ACCEL effect without them (hand-written before v0.179.0):
// data/sources/accel-reductions.json (tools/accel_reductions.py) -> effects[].reduction, and the matching "icons not in the export" residual is dropped.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const T = JSON.parse(readFileSync('data/sources/accel-reductions.json', 'utf8'));
let n = 0;
for (const f of readdirSync('data/cards').filter(x => /^saga-\d+\.json$/.test(x))) {
  const p = 'data/cards/' + f, cards = JSON.parse(readFileSync(p, 'utf8')); let hit = false;
  for (const c of cards) {
    const rows = T[c.name.replace(/​/g, '')]; let k = 0;
    for (const e of c.effects || []) {
      if (e.trigger !== 'ACCEL') continue;
      const r = rows && rows[k++];
      if (!r || r.cost !== e.cost || e.reduction || !Object.keys(r.reduction).length) continue;
      e.reduction = r.reduction; hit = true; n++;
      if (c.residual) { c.residual = c.residual.filter(x => !/^Accel cost reduction icons/.test(x)); if (!c.residual.length) delete c.residual; }
    }
  }
  if (hit) writeFileSync(p, JSON.stringify(cards, null, 1));
}
console.log('reductions added:', n);
