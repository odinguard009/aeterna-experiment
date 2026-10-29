// v0.52.0 effect compiler (tools/compile_effects.py) and the pilot promotion (vanilla cards + Saga 1).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, quietBoard, closeBrowser } from './lib/game.mjs';

after(closeBrowser);
const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const card = (text, extra = {}) => JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra));
const compile = (text, extra) => py(`c = json.loads(${JSON.stringify(card(text, extra))})\ntry: print(json.dumps(ce.compile_card(c)))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('C52-01 old and current wordings compile to the same effect', () => {
  const a = compile('[LV1][LV2] (When Attacks)\nThis Spirit gains +2000 BP.');
  const b = compile('Original = [LV1][LV2] (When Attacks) This spirit gets +2000BP until end of turn.');
  assert.deepEqual(a.effects, [{ trigger: 'ATTACKS', lv: [1, 2], actions: [{ do: 'BP_PLUS', n: 2000 }] }]);
  assert.deepEqual(b.effects, a.effects);
  assert.equal(a.fxComplete, true);
});
test('C52-02 any sentence it cannot map sends the whole card to review (no partial promotion)', () => {
  const r = compile('[LV1][LV2] (When Summoned)\nDraw a card.\n\n[LV2] (When Attacks)\nThe opponent discards a card from their Hand.');
  assert.match(r.review, /^sentence/);
  assert.match(compile('[LV1] {{Tribute|Cost 3 or more}} x').review, /template/);
  assert.match(compile('Original = [LV1] (When Attacks) Draw a card.\n\nAfter Errata = [LV1] (When Attacks) Draw two cards.').review, /more than one text version/);
});
test('C52-03 Nexus LV2+ text stays staged without level data; Magic with two timings uses magic.by', () => {
  assert.match(compile('[LV2] (Your Attack Step) All attacking Spirits you control gain +1000 BP.', { type: 'Nexus', levels: [] }).review, /Nexus \[LV2\]/);
  const m = compile('Main\nDraw two cards.\n\nFlash\nDuring this turn, give a Spirit +2000 BP.', { type: 'Magic', levels: [] });
  assert.deepEqual(m.magic, { timing: ['MAIN', 'FLASH'], effect: null, value: 0, by: { MAIN: { effect: 'DRAW', value: 2 }, FLASH: { effect: 'BP_PLUS', value: 2000 } } });
});
test('C52-04 promoted cards are marked compiled, and none of them is also staged', () => {
  const pack = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));
  const comp = pack.filter(c => /compile_effects/.test(c.note || '') && !/Partial card \(v0\.(79\.0|191\.0)/.test(c.note || ''));      // v0.79.0: A1 partial cards are checked in partial79
  assert.ok(comp.length >= 340, String(comp.length));
  assert.ok(comp.every(c => c.fxComplete === true && !(c.residual || []).length));
});
test('C52-05 compiled effects work in the game: draw on summon, Clash, High Speed, two-timing Magic', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; BS.SETTINGS.speed = 'instant'; G.active = P.key;
    for (const x of ['BS01-001', 'BS01-001']) { const d = BS.mkInst(x); P.deck.push(d); }
    const h = P.hand.length, s = BS.mkInst('BS01-030'); s.cores = 1; P.spirits.push(s);
    await BS.fireFx(P, 'SUMMONED', s, {});
    const drew = P.hand.length - h;
    const clash = BS.CARDS['BS06-012'].effects[0];
    return { drew, clash: [clash.trigger, clash.flag], hs: BS.CARDS['BS01-064'].highSpeed === true, by: Object.keys(BS.CARDS['BS01-117'].magic.by || {}) };
  });
  assert.deepEqual(r, { drew: 1, clash: ['STATIC', 'MUST_BLOCK'], hs: true, by: ['MAIN', 'FLASH'] });
});
