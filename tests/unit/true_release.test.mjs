// v0.66.0 True Release (= Super Unleash; Standard rule manual "True Release", CR 12-2-1-1; Fandom True Release Q&A 31532-31534):
// "For a card with this keyword, you can either put the specified number of cores onto it, or only the Soul Core, to fulfill
// the condition to level up" -> a card with the keyword that holds the Soul Core is at least LV2 ("True Release state").
// The level-up by the Soul Core is a rule, not an effect. Text head "[LV2] (True Release)" -> card field trueRelease: true.
// Also (During Attack) heads (manual "Examples on Activation Timings": active as long as the Spirit is attacking):
// "This Spirit gains +N BP" -> STATIC bp attackingOnly; Clash "Opposing Spirits must block if possible" -> MUST_BLOCK.
// rules: STD:12-2-1-1@cc53242a, SJP:true-release@55609a47
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('TR66-01 compiler: "[LV2] (True Release)" sets trueRelease and keeps the LV2 effect; (During Attack) BP is attackingOnly', () => {
  const c = compile('[LV2] (True Release) (During Attack)\nThis Spirit gains +2000 BP.');
  assert.equal(c.trueRelease, true, JSON.stringify(c));
  assert.deepEqual(c.effects, [{ trigger: 'STATIC', bp: 2000, to: 'self', attackingOnly: true, lv: [2] }]);
  assert.equal(c.fxComplete, true);
  assert.equal(compile("[LV2]' (True Release) (During Attack)\nThis Spirit gains +2000 BP.").trueRelease, true, 'stray quote in the export (26RBS01-032)');
  const d = compile('[LV2] (True Release) (When Destroyed)\nTarget an opposing Cost 3 or less Spirit. Destroy it.');
  assert.equal(d.trueRelease, true, JSON.stringify(d));
  assert.match(compile('[LV1] (True Release) (During Attack)\nThis Spirit gains +2000 BP.').review || '', /True Release/);
  assert.match(compile('[LV2] (True Release) (During Attack)\nThis Spirit gains +2000 BP.', { levels: [{ cores: 1, bp: 3000 }] }).review || '', /True Release/);
  assert.equal(compile('[LV1] (When Summoned)\nDraw a card.').trueRelease, undefined);
});
test('TR66-02 compiler: Clash with (During Attack) and "Opposing Spirits must block if possible"', () => {
  const c = compile('[LV2] (True Release) Clash (During Attack)\nOpposing Spirits must block if possible.');
  assert.equal(c.trueRelease, true, JSON.stringify(c));
  assert.deepEqual(c.effects, [{ trigger: 'STATIC', flag: 'MUST_BLOCK', to: 'self', lv: [2] }]);
});

let g;
const FIX = [
  { id: 'T66-TR', name: 'T66-TR', type: 'Spirit', color: 'red', cost: 3, symbols: 1, trueRelease: true, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }],
    effects: [{ trigger: 'STATIC', bp: 2000, to: 'self', attackingOnly: true, lv: [2] }], fxComplete: true, text: '[LV2] (True Release) (During Attack) This Spirit gains +2000 BP.' },
  { id: 'T66-PLAIN', name: 'T66-PLAIN', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }] },
  { id: 'T66-TR3', name: 'T66-TR3', type: 'Spirit', color: 'red', cost: 5, symbols: 1, trueRelease: true, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }, { cores: 5, bp: 8000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 5;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.burst = null; }
  for (const f of P.spirits) f.soul = false; P.reserve.soul = false;
  const sp = (id, n = 1, soul = false) => { const i = BS.mkInst(id); i.cores = n; i.soul = soul; P.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('TR66-03 parse: trueRelease is kept on Spirits / Nexuses with an LV2, rejected elsewhere', async () => {
  const r = await g.page.evaluate(() => [BS.CARDS['T66-TR'].trueRelease, BS.CARDS['T66-PLAIN'].trueRelease || false,
    BS.parseCard({ id: 'T66-BAD', name: 'B', type: 'Magic', color: 'red', cost: 3, trueRelease: true }).errors ? 'err' : 'ok',
    BS.parseCard({ id: 'T66-BAD2', name: 'B', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 1000 }], trueRelease: true }).errors ? 'err' : 'ok']);
  assert.deepEqual(r, [true, false, 'err', 'err']);
});
test('TR66-04 rule: only the Soul Core = LV2 (True Release); a plain card or normal cores stay LV1; enough cores still reach LV3', async () => {
  const r = await ev(`const a = sp('T66-TR', 0, true), b = sp('T66-PLAIN', 0, true), c = sp('T66-TR', 1), d = sp('T66-TR3', 0, true), e = sp('T66-TR3', 4, true);
    const out = [BS.lvNo(a), BS.bpOf(a), BS.lvNo(b), BS.lvNo(c), BS.lvNo(d), BS.lvNo(e)];
    a.soul = false; P.reserve.soul = true; out.push(BS.lvNo(a)); return out;`);
  assert.deepEqual(r, [2, 5000, 1, 1, 2, 3, 0]);
});
test('TR66-05 (During Attack) +BP only while that Spirit is the attacker, and only at LV2', async () => {
  const r = await ev(`const a = sp('T66-TR', 0, true), b = sp('T66-TR', 1);
    const idle = BS.bpOf(a); G.attacker = a; const att = BS.bpOf(a); G.attacker = b; const low = BS.bpOf(b), other = BS.bpOf(a); G.attacker = null; return [idle, att, low, other];`);
  assert.deepEqual(r, [5000, 7000, 3000, 5000]);
});
test('TR66-06 scenario true-release-soul-core-lv2: real cards 26RSD01-002 Gen-Bor and 26RSD10-004 Monocowl', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/true-release-soul-core-lv2.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(s => {
    BS.loadScenario(s); const G = BS.G, P = G.p.player; const [gb, mono] = P.spirits;
    const out = [BS.lvNo(gb), BS.bpOf(gb), BS.lvNo(mono), BS.bpOf(mono)]; G.attacker = gb; out.push(BS.bpOf(gb)); G.attacker = null;
    out.push(!!BS.CARDS['26RSD01-002'].implemented); return out;
  }, spec);
  assert.deepEqual(r, [2, 5000, 1, 3000, 7000, true]);
});
