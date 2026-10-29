// v0.62.0: Standard block A import (tools/fetch_fandom_std.py -> data/sources/fandom-cards-26r.json -> data/import/saga-50.json).
// Parser tests use inline wikitext (no network); data tests read the committed staging/game files (present in the light clone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const py = (code) => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import fetch_fandom_std as F\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const js = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const PAGE = `{{CardTable3
| image = 26RBS01-009.png
| jpname = {{Ruby|赤|せき}}{{ruby|導|どう}}シャニエル
| type = Spirit
| color = Red
| cost = 5
| reductions = [[File:Red core.png|20px]][[File:Red core.png|20px]][[file:Red core.png|20px]]
| symbols = [[file:Red EX symbol.png|25px]]
| family = Red Cloud
| family2 = Luminaze
| keyword = Clash
| level = Level 1: 1 core, 5000 BP<br>Level 2: 3 cores/[[File:Stan Soul Core.png|20px]] {{ST|True Release}} 7000 BP
| effect = '''[LV1-2]''' {{tk|Clash}}{{ST|During Attack}}<br>Opposing [[Spirit]]s must block if possible. <br><Br>'''[LV2]'''{{ST|Your Attack Step}}<br>{{tk|team|Blue Beat}} {{Soul Magic|r}}

| jpeffect = x
}}`;

test('S62-01 an infobox becomes one export row (EX symbol counted as a symbol, levels, families, text rules of the BS export)', () => {
  const r = py(`print(json.dumps(F.row_of({'id': '26RBS01-009', 'set': '26RBS01', 'title': 'The RedGuide Shaniel', 'list_color': 'Red', 'list_type': 'Spirit', 'rarity': 'Master Rare', 'secret_variant': True}, 'The RedGuide Shaniel', ${JSON.stringify(PAGE)})))`);
  assert.equal(r.name_jp, '赤導シャニエル');
  assert.deepEqual([r.cost, r.reduction, r.symbols, r.ex_symbols], [5, { red: 3 }, { red: 1 }, 1]);
  assert.deepEqual(r.families, ['Red Cloud', 'Luminaze']);
  assert.deepEqual(r.levels, [{ lv: 1, cores: 1, bp: 5000 }, { lv: 2, cores: 3, bp: 7000 }]);
  assert.equal(r.effect, '[LV1-2] Clash (During Attack)\nOpposing Spirits must block if possible.\n\n[LV2] (Your Attack Step)\n[Team: Blue Beat] {{Soul Magic|r}}');
});

test('S62-02 set list rows: number + linked title; page disambiguation is dropped from the card name', () => {
  const rows = py(`print(json.dumps(F.set_rows('26RCB01', '|-\\n|26RCB01-029 \\n|[[Kamen Rider Gai (26RCB01-029)]]\\n|{{White}}\\n|Spirit\\n|Common \\n|-\\n')))`);
  assert.deepEqual(rows.map(r => [r.id, r.title, r.list_color]), [['26RCB01-029', 'Kamen Rider Gai (26RCB01-029)', 'White']]);
  assert.equal(py(`print(json.dumps(F.card_name('Kamen Rider Gai (26RCB01-029)')))`), 'Kamen Rider Gai');
  assert.equal(py(`print(json.dumps(F.card_name('Kamen Rider Snipe Hunter Shooting Gamer Level 5 (Full Dragon)')))`), 'Kamen Rider Snipe Hunter Shooting Gamer Level 5 (Full Dragon)');
});

test('S62-03 block A staging: saga 50, block "A", 26R numbers only, no number also staged in an Eternal Saga file', () => {
  const std = js('data/import/saga-50.json'), ids = new Set(std.map(c => c.id));
  assert.ok(std.length + js('data/cards/saga-50.json').length >= 600, String(std.length));      // staged + promoted (cards leave staging when promoted)
  for (const c of std) { assert.equal(c.saga, 50, c.id); assert.equal(c.block, 'A', c.id); assert.match(c.id, /^26R[A-Z]+\d+-[A-Z]*\d+$/, c.id); }
  for (let s = 1; s <= 17; s++) for (const c of js(`data/import/saga-${String(s).padStart(2, '0')}.json`)) assert.ok(!ids.has(c.id) && !c.id.startsWith('26R'), c.id);
});

test('S62-04 promoted block A cards live in data/cards/saga-50.json with compiled effects or an empty text (vanilla)', () => {
  const cards = js('data/cards/saga-50.json');
  assert.ok(cards.length >= 51, String(cards.length));
  for (const c of cards) {
    assert.equal(c.block, 'A', c.id);
    assert.ok((c.residual || []).length && /Partial card \(v0\.79\.0/.test(c.note || '') || !(c.text || '').replace(/^\[Teams?:[^\]\n]+\]\s*$/m, '').trim() || (c.effects || []).length || c.highSpeed || c.costPer || c.magic || (c.legacy && !c.text.replace(/\(Legacy\)/, '').trim()), `${c.id} has text but no effects`);   // v0.69: a card whose only text is the (Legacy) head is complete
  }
});
