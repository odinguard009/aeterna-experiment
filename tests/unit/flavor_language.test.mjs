// The Lore tab shows English flavor text only. Some Fandom pages carry a Japanese-only flavor, and an old
// parser swallowed `| jpflavorN = ...` into the English index; check the index stays English (2026-11-01).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const flavor = JSON.parse(readFileSync(join(ROOT, 'data/index/flavor.json'), 'utf8'));
const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;

test('FLAV-01 every flavor text is English (no Japanese kana or kanji)', () => {
  const bad = Object.entries(flavor).filter(([, text]) => typeof text === 'string' && japanese.test(text)).map(([id]) => id);
  assert.deepEqual(bad, []);
});
test('FLAV-02 no flavor entry carries raw wiki parameters or br tags', () => {
  const bad = Object.entries(flavor).filter(([, text]) => typeof text === 'string' && /(\|\s*(jp)?flavor\d*\s*=)|<br\s*\/?>/i.test(text)).map(([id]) => id);
  assert.deepEqual(bad, []);
});
