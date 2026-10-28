// v0.70.0 step window heads (plan W, first pack; docs/mechanics/step-timings.md; Fandom Comprehensive Rules /
// Categories of Effects "Effects Which Activate During Specific Steps"): "(Your|Opposing|Either) <Step> Step)" is a
// window, not an event. The compiler reads the body below it with the normal trigger / constant patterns and adds the
// condition {"step": <STEPS name>, "oppTurn": false|true} (Either = no oppTurn). New engine pieces: condition "step",
// STATIC flag BLOCK_EXHAUSTED ("This Spirit can block while exhausted"), match.costLe on trigger subjects.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'white', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('S70-01 compiler: the step head becomes a window condition on the body (Your / Opposing / Either, any step)', () => {
  const b = compile('[LV1][LV2] (Opposing Attack Step)\nThis Spirit can block while exhausted.');
  assert.deepEqual(b.effects, [{ trigger: 'STATIC', flag: 'BLOCK_EXHAUSTED', to: 'self', lv: [1, 2], if: { step: 'ATTACK', oppTurn: true } }], JSON.stringify(b));
  const o = compile('[LV2] (Your Main Step)\nAll your "Investigator" family Spirits gain +3000 BP.');
  assert.deepEqual(o.effects[0], { trigger: 'STATIC', bp: 3000, to: 'own', match: { family: ['Investigator'] }, lv: [2], if: { step: 'MAIN', oppTurn: false } });
  const e = compile('[LV1] (Either Attack Step)\nThis Spirit gets +2000 BP.');
  assert.deepEqual(e.effects[0].if, { step: 'ATTACK' }, 'Either = no whose-turn condition');
});

test('S70-02 compiler: attack triggers under a window; the old (Your Attack Step) forms are unchanged; unknown bodies stay in review', () => {
  const a = compile('[LV1] (Opposing Attack Step)\nWhen an opposing Cost 3 or less Spirit attacks, draw a card.');
  assert.equal(a.effects[0].trigger, 'OPP_ATTACKS', JSON.stringify(a));
  assert.deepEqual(a.effects[0].match, { noUlt: true, costLe: 3 });
  assert.deepEqual(a.effects[0].if, { step: 'ATTACK', oppTurn: true });
  const y = compile('[LV1] (Either Attack Step)\nWhen your Blue Spirit attacks, draw a card.');
  assert.deepEqual([y.effects[0].trigger, y.effects[0].match], ['ALLY_ATTACKS', { noUlt: true, color: 'blue' }]);
  const old = compile('[LV1] (Your Attack Step)\nWhen your "Beast" family Spirit attacks, draw a card.');
  assert.deepEqual([old.effects[0].trigger, old.effects[0].if], ['ALLY_ATTACKS', undefined], 'v0.59 form kept as it was');
  assert.match(compile('[LV1] (Opposing Attack Step)\nWhen your Spirit is destroyed, this Spirit refreshes.').review || '', /^no trigger: When your Spirit is destroyed/);
  assert.match(compile('[LV1] (Your Attack Step)\nWhen an opposing Spirit attacks, draw a card.').review || '', /no trigger/, 'an opposing attack cannot happen in your Attack Step');
});

let g;
before(async () => { g = await openGame(''); });
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

test('S70-03 engine: condition "step" follows the running step; parseEffects rejects an unknown step', async () => {
  const r = await g.page.evaluate(() => {
    BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = O.key; G.step = 5;
    const w = { step: 'ATTACK', oppTurn: true }, out = [BS.fxIf(P, O, w), BS.fxIf(P, O, { step: 'ATTACK', oppTurn: false }), BS.fxIf(P, O, { step: 'ATTACK' })];
    G.step = 4; out.push(BS.fxIf(P, O, w), BS.fxIf(P, O, { step: 'MAIN' }));
    out.push(!!BS.parseEffects([{ trigger: 'STATIC', bp: 1000, to: 'self', if: { step: 'BATTLE' } }]).error, !!BS.parseEffects([{ trigger: 'STATIC', bp: 1000, to: 'self', if: { step: 'END' } }]).error);
    return out;
  });
  assert.deepEqual(r, [true, false, true, false, true, true, false]);
});

test('S70-04 scenario macha-block-exhausted-opposing-attack-step: the exhausted Macha blocks in the opposing Attack Step only', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/macha-block-exhausted-opposing-attack-step.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    const e = BS.loadScenario(s); if (e && e.error) return e.error;
    BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const [macha] = P.spirits, out = [macha.exhausted, BS.canBlockState(P, macha)];
    G.active = P.key; out.push(BS.canBlockState(P, macha)); G.step = 4; G.active = O.key; out.push(BS.canBlockState(P, macha)); G.step = 5;
    const life = P.life; window.cpuChooseBlock = () => macha;
    await BS.doBattle('opponent', O.spirits[0]);
    out.push(P.life === life);
    return out;
  }, spec);
  assert.deepEqual(r, [true, true, false, false, true]);
});
