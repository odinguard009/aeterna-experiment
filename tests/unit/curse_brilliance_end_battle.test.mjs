// v0.78.0 bundle (plan W, pack bundle 5; rules: docs/mechanics/end-of-battle.md):
//  1. keyword Curse: at the end of the battle the Spirit that blocked is destroyed (CURSE);
//  2. keyword Brilliance: at the end of the battle the Magic cards you used during it return from the Trash (BRILLIANCE);
//  3. "At the end of (the) battle, X." inside a When Attacks / Blocks / Battles effect waits for the end of the battle (END_BATTLE);
//  4. "When only the opposing Spirit is destroyed by comparing BP with your X Spirit" on another card (ALLY_BATTLE_WIN),
//     with the step head deciding the side; "refresh that Spirit" = the Spirit that won (REFRESH to: 'subject').
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);
const eff = (text, i = 0) => { const r = compile(text); return r.review ? 'REVIEW ' + r.review : r.effects[i]; };
const pick = (e, keys) => typeof e === 'string' ? e : Object.fromEntries(keys.filter(k => e[k] !== undefined).map(k => [k, e[k]]));
const K = ['trigger', 'alsoBlocks', 'match', 'attackingOnly', 'blockingOnly', 'actions', 'if'];

test('PK78-01 compiler: Curse, Brilliance, "At the end of battle, X." and (When Battles)', () => {
  assert.deepEqual(pick(eff('[LV2] Curse (When Attacks)\nDestroy an opposing Spirit that blocked when the battle resolves at the end of battle.'), K), { trigger: 'ATTACKS', actions: [{ do: 'CURSE' }] });
  assert.deepEqual(pick(eff('[LV1] Curse (When Attacks)\nDestroy an opposing Spirit that blocked at the end of battle.'), K), { trigger: 'ATTACKS', actions: [{ do: 'CURSE' }] });
  assert.match(String(eff('[LV1] Curse (When Attacks)\nDestroy an opposing Spirit.')), /^REVIEW Curse text/);
  assert.deepEqual(pick(eff('[LV2] Brilliance (When Attacks)\nAt the end of battle, return every Magic card you used during this battle to your Hand.'), K), { trigger: 'ATTACKS', actions: [{ do: 'BRILLIANCE' }] });
  assert.deepEqual(pick(eff('[LV2] (When Attacks/Blocks)\nAt the end of the battle, return an opposing Spirit to the Hand.'), K),
    { trigger: 'ATTACKS', alsoBlocks: true, actions: [{ do: 'END_BATTLE', then: [{ do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit' }] }] });
  assert.deepEqual(pick(eff('[LV1] (When Battles)\nAt the end of battle, destroy this Spirit.'), K), { trigger: 'ATTACKS', alsoBlocks: true, actions: [{ do: 'END_BATTLE', then: [{ do: 'DESTROY_SELF' }] }] });
  assert.deepEqual(pick(eff('[LV1] (When Attacks) At the end of battle, during this turn, give a Spirit you control +3000 BP.'), K),
    { trigger: 'ATTACKS', actions: [{ do: 'END_BATTLE', then: [{ do: 'BP_TARGET', n: 3000, to: 'pick' }] }] });
  assert.match(String(eff('[LV1] (When Summoned) At the end of battle, draw a card.')), /^REVIEW/, 'no battle outside a battle trigger');
  assert.match(String(eff('[LV1] (When Attacks) At the end of battle, you can draw a card.')), /^REVIEW/, 'no optional delayed effect');
  assert.match(String(eff('[LV1] (When Destroyed) Destroy this Spirit.')), /^REVIEW/);
});

test('PK78-02 compiler: ally battle results with the step head side', () => {
  assert.deepEqual(pick(eff('[LV2] (Your Attack Step)\nWhen only the opposing Spirit is destroyed via BP comparison with your "Dragon"/"Ancient Dragon" family Spirits, draw a card.'), K),
    { trigger: 'ALLY_BATTLE_WIN', match: { family: ['Dragon', 'Ancient Dragon'], noUlt: true }, attackingOnly: true, actions: [{ do: 'DRAW', n: 1 }], if: { step: 'ATTACK', oppTurn: false } });
  assert.deepEqual(pick(eff('[LV1] (Opposing Attack Step)\nWhen only the opposing Spirit is destroyed by comparing BP with your "Mibrock"-named Spirit, put a core from the Void to any of your Spirits.'), K),
    { trigger: 'ALLY_BATTLE_WIN', match: { name: ['Mibrock'], noUlt: true }, blockingOnly: true, actions: [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit' }], if: { step: 'ATTACK', oppTurn: true } });
  assert.deepEqual(pick(eff('[LV1] When only the opposing Spirit is destroyed by comparing BP with your [The Gigantic Thor]/[The Walhalance], refresh this Spirit.'), K),
    { trigger: 'ALLY_BATTLE_WIN', match: { name: ['The Gigantic Thor', 'The Walhalance'], noUlt: true }, actions: [{ do: 'REFRESH' }] });
  assert.deepEqual(pick(eff('[LV2] (Your Attack Step)\nWhen only the opposing Spirit is destroyed by comparing BP with your Spirit with two or more symbols, refresh that Spirit you control.'), K),
    { trigger: 'ALLY_BATTLE_WIN', match: { symbolsGe: 2, noUlt: true }, attackingOnly: true, actions: [{ do: 'REFRESH', to: 'subject' }], if: { step: 'ATTACK', oppTurn: false } });
  assert.deepEqual(pick(eff('[LV1] (Opposing Attack Step) When only the opposing attacking Spirit is destroyed by comparing BP during battle, refresh the blocking Spirit you control.'), K),
    { trigger: 'ALLY_BATTLE_WIN', blockingOnly: true, actions: [{ do: 'REFRESH', to: 'subject' }], if: { step: 'ATTACK', oppTurn: true } });
  assert.deepEqual(pick(eff('[LV1] (When Blocks) When only the opposing Spirit is destroyed, draw a card.'), K), { trigger: 'BATTLE_WIN', blockingOnly: true, actions: [{ do: 'DRAW', n: 1 }] }, 'own battle result unchanged');
  assert.match(String(eff('[LV1] (Your Attack Step) When only the opposing Spirit is destroyed by comparing BP with your Spirit under "BP+" effects, draw a card.')), /^REVIEW/);
});

let g;
const FIX = [
  { id: 'T78-CURSE', name: 'Curse One', type: 'Spirit', color: 'purple', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'ATTACKS', lv: [1], actions: [{ do: 'CURSE' }] }] },
  { id: 'T78-BRIL', name: 'Bright One', type: 'Spirit', color: 'yellow', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 5000 }], effects: [{ trigger: 'ATTACKS', lv: [1], actions: [{ do: 'BRILLIANCE' }] }] },
  { id: 'T78-EOB', name: 'Late One', type: 'Spirit', color: 'yellow', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'ATTACKS', alsoBlocks: true, lv: [1], actions: [{ do: 'END_BATTLE', then: [{ do: 'DESTROY_SELF' }] }] }] },
  { id: 'T78-WALL', name: 'Big Wall', type: 'Spirit', color: 'red', cost: 6, symbols: 1, levels: [{ cores: 1, bp: 6000 }] },
  { id: 'T78-SMALL', name: 'Small One', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 500 }] },
  { id: 'T78-DRAG', name: 'Fire Drake', type: 'Spirit', color: 'red', cost: 3, symbols: 2, families: ['Dragon'], levels: [{ cores: 1, bp: 4000 }] },
  { id: 'T78-FAN', name: 'Dragon Fan', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'ALLY_BATTLE_WIN', lv: [1], match: { family: ['Dragon'], noUlt: true }, attackingOnly: true, actions: [{ do: 'DRAW', n: 1 }] }] },
  { id: 'T78-REF', name: 'Refresher', type: 'Nexus', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 0 }], effects: [{ trigger: 'ALLY_BATTLE_WIN', match: { symbolsGe: 2, noUlt: true }, actions: [{ do: 'REFRESH', to: 'subject' }] }] },
  { id: 'T78-MAG', name: 'Quick Spell', type: 'Magic', color: 'yellow', cost: 1, symbols: 0, magic: { timing: ['FLASH'], effect: 'DRAW', value: 1 } },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; q.void = 10; q.hand = []; q.life = 5; }
  P.deck = [BS.mkInst('T78-SMALL'), BS.mkInst('T78-SMALL')];
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const nx = (id, q = P) => { const i = BS.mkInst(id); i.cores = 0; q.nexus.push(i); return i; };
  const block = b => { window.cpuChooseBlock = () => b; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('PK78-03 engine: Curse destroys the blocker at the end of battle, even after the Curse Spirit lost', async () => {
  const r = await ev(`const a = sp('T78-CURSE'); const w = sp('T78-WALL', O); block(w); await BS.doBattle('player', a);
    const lost = [P.spirits.includes(a), O.spirits.includes(w)];
    const a2 = sp('T78-CURSE'); block(null); const life = O.life; await BS.doBattle('player', a2);
    return [lost, O.life < life, BS.G.eob];`);
  assert.deepEqual(r, [[false, false], true, null]);
});

test('PK78-04 engine: Brilliance returns the Magic used during the battle; END_BATTLE waits and needs its source', async () => {
  const r = await ev(`const a = sp('T78-BRIL'); const s = sp('T78-SMALL', O); const m = BS.mkInst('T78-MAG'); P.hand = [m]; P.reserve.n = 5;
    let used = false; const orig = window.cpuFlashChoice; window.cpuFlashChoice = (p) => { if (p === P && !used && P.hand.includes(m)) { used = true; return { inst: m, target: null, plan: null, ctx: 'flash' }; } return null; };
    block(s); await BS.doBattle('player', a); window.cpuFlashChoice = orig;
    const back = [used, P.hand.includes(m), P.trash.includes(m)];
    const e = sp('T78-EOB'); block(null); await BS.doBattle('player', e); const selfGone = !P.spirits.includes(e) && P.trash.includes(e);
    return [back, selfGone, BS.FX_ACTIONS.END_BATTLE.txt({ then: [{ do: 'DESTROY_SELF' }] })];`);
  assert.deepEqual(r, [[true, true, false], true, 'at the end of this battle, destroy this Spirit']);
});

test('PK78-05 engine: ALLY_BATTLE_WIN fires for the matching winner on the right side; REFRESH subject', async () => {
  const r = await ev(`sp('T78-FAN'); nx('T78-REF'); const d = sp('T78-DRAG'); const s = sp('T78-SMALL', O); block(s); P.hand = [];
    await BS.doBattle('player', d); const a = [P.hand.length, d.exhausted];
    const d2 = sp('T78-SMALL'); const s2 = sp('T78-SMALL', O, 1); s2.cores = 1; block(null); P.hand = []; await BS.doBattle('player', d2); const b = P.hand.length;
    return [a, b, BS.parseCard({ id: 'X', name: 'X', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'ALLY_BATTLE_WIN', blockingOnly: true, match: { symbolsGe: 2 }, actions: [{ do: 'REFRESH', to: 'subject' }] }] }).errors || []];`);
  assert.deepEqual(r, [[1, false], 0, []]);
});
