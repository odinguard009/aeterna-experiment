// R4/R5: the Japanese heads, Lv ranges, BP figures and counts on the official pages agree with every complete card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT } from './lib/game.mjs';

test('R4-01 tools/audit_heads.py finds no mismatch in the complete cards', () => {
  const out = execFileSync('python3', ['tools/audit_heads.py'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /\d+ complete cards checked, 0 with a head mismatch/, out.slice(-600));
});

test('R4-02 Medici-Cattery gains the official +2000 BP, Yoroibatta is partial until its Rush chain runs', () => {
  const find = (saga, id) => JSON.parse(readFileSync(`${ROOT}/data/cards/saga-${saga}.json`, 'utf8')).find(c => c.id === id);
  assert.equal(find('50', '26RSD02-003').effects[0].bp, 2000);
  const y = find('04', 'BS23-020');
  assert.equal(y.fxComplete, false);
  assert.ok(y.residual.length);
});
