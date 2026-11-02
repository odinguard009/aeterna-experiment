// v0.74.0 bundle of three packs (plan W, owner 2026-10-20: 3-4 packs per release, ranked by measured yield: docs/reports/pack-plan.md):
//  1. "Put N core(s) from the Void to <Reserve | one of your [colour] [\"family\"] Spirits>" = VOID_TO_RESERVE / VOID_TO_CARD with match;
//  2. battle result heads: "(When Attacks) When only the opposing Spirit is destroyed ..." = BATTLE_WIN attackingOnly, "(When Blocks) ..." =
//     BATTLE_WIN blockingOnly (new engine flag), the "(When Battles)" parenthesis and the "by BP comparison" words are optional;
//  3. sentences for actions the engine already had: own discard, "Your counters +N", sending an opposing Life to the Reserve / Trash.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);
const acts = text => { const r = compile(text); return r.review ? 'REVIEW ' + r.review : r.effects[0].actions; };

test('VD74-01 compiler: Void cores to the Reserve or to one of your Spirits (colour / family filter, optional, spelling variants)', () => {
  assert.deepEqual(acts('[LV1] (When Summoned) Put a core from Void to your Reserve.'), [{ do: 'VOID_TO_RESERVE', n: 1 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Put a core from the void to the Reserve.'), [{ do: 'VOID_TO_RESERVE', n: 1 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Put a core from the Void to any of your Spirit.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit' }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Put a core from the Void to any of your White Spirits.'), [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit', match: { color: 'white' } }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Put two cores from the Void to any "Terra Dragon"/"Ocean Emperor" family Spirit you control.'),
    [{ do: 'VOID_TO_CARD', n: 2, to: 'anySpirit', match: { family: ['Terra Dragon', 'Ocean Emperor'] } }]);
  const o = compile('[LV1] (When Summoned) You can put a core from the Void to any "Winged Beast" family Spirit you control.');
  assert.deepEqual([o.effects[0].optional, o.effects[0].actions[0].match], [true, { family: ['Winged Beast'] }], JSON.stringify(o));
  // v0.75 reads Trash, two colours, "each to every" and "this Spirit, and refresh it" (tests/unit/void_to_trash_reveal.test.mjs PK75-01)
  assert.equal(typeof acts('[LV1] (When Summoned) Put a core from the Void to a Spirit.'), 'string', 'an unmarked "a Spirit" stays in review');
});

let g;
const FIX = [
  { id: 'T74-WH', name: 'White One', type: 'Spirit', color: 'white', cost: 2, symbols: 1, families: ['Angel'], levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T74-RD', name: 'Red One', type: 'Spirit', color: 'red', cost: 2, symbols: 1, families: ['Dragon'], levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T74-SM', name: 'Small', type: 'Spirit', color: 'blue', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T74-ATK', name: 'Attack Winner', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 9000 }],
    effects: [{ trigger: 'BATTLE_WIN', attackingOnly: true, actions: [{ do: 'COUNTER', n: 3 }] }] },
  { id: 'T74-BLK', name: 'Block Winner', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 9000 }],
    effects: [{ trigger: 'BATTLE_WIN', blockingOnly: true, actions: [{ do: 'COUNTER', n: 2 }] }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('VD74-02 engine: VOID_TO_CARD with a match only feeds a matching Spirit; nothing moves when none matches', async () => {
  const r = await ev(`const red = sp('T74-RD'), white = sp('T74-WH'), src = sp('T74-SM');
    const run = m => BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: [{ do: 'VOID_TO_CARD', n: 1, to: 'anySpirit', match: m }] });
    await run({ color: 'white' }); const a = [red.cores, white.cores];
    await run({ family: ['Dragon'] }); const b = [red.cores, white.cores];
    const before = P.void; await run({ family: ['Nobody'] }); return [a, b, P.void === before, red.cores + white.cores];`);
  assert.deepEqual(r, [[1, 2], [2, 2], true, 4]);
});

test('VD74-03 compiler: (When Attacks) / (When Blocks) battle result heads; "(When Battles)" and "by BP comparison" are optional', () => {
  const a = compile('[LV2] (When Attacks) When only the opposing Spirit is destroyed by comparing BP, draw a card.');
  assert.deepEqual(a.effects, [{ trigger: 'BATTLE_WIN', lv: [2], attackingOnly: true, actions: [{ do: 'DRAW', n: 1 }] }], JSON.stringify(a));
  const b = compile('[LV1] (When Blocks) When only the opposing Spirit/Ultimate is destroyed via BP comparison, draw a card.');
  assert.deepEqual(b.effects, [{ trigger: 'BATTLE_WIN', lv: [1], blockingOnly: true, actions: [{ do: 'DRAW', n: 1 }] }], JSON.stringify(b));
  for (const t of ['When only the opposing Spirit is destroyed by comparing BP', '(When Battles) When only the opposing Spirit is destroyed', '(When Attacks/Blocks) When only the opposing Spirit is destroyed by BP comparison']) {
    const c = compile(`[LV1] ${t}, draw a card.`);
    assert.deepEqual(c.effects, [{ trigger: 'BATTLE_WIN', lv: [1], actions: [{ do: 'DRAW', n: 1 }] }], t + ' ' + JSON.stringify(c));
  }
  assert.equal(compile('[LV1] When only the opposing Spirit is destroyed by comparing BP with your "Dragon" family Spirit, draw a card.').effects[0].trigger, 'ALLY_BATTLE_WIN', 'v0.78: ally variants (with your X Spirit) are ALLY_BATTLE_WIN');
});

test('VD74-04 engine: BATTLE_WIN blockingOnly fires for the winning blocker only; attackingOnly still for the winning attacker only', async () => {
  const r = await ev(`G.step = 5; const a = sp('T74-ATK'); sp('T74-SM', O); window.cpuChooseBlock = (D, att) => D.spirits[0];
    await BS.doBattle('player', a); const atkAsAtt = P.count;
    P.count = 0; for (const q of [P, O]) q.spirits = []; const b = sp('T74-BLK'); sp('T74-SM', O); window.cpuChooseBlock = (D, att) => D.spirits[0];
    await BS.doBattle('player', b); const blkAsAtt = P.count;
    P.count = 0; O.count = 0; for (const q of [P, O]) q.spirits = []; const blk = sp('T74-BLK', O); const s = sp('T74-SM'); window.cpuChooseBlock = (D, att) => D.spirits[0];
    await BS.doBattle('player', s); const blkAsBlk = O.count;
    O.count = 0; for (const q of [P, O]) q.spirits = []; const atk = sp('T74-ATK', O); const s2 = sp('T74-SM'); window.cpuChooseBlock = (D, att) => D.spirits[0];
    await BS.doBattle('player', s2); const atkAsBlk = O.count;
    return [atkAsAtt, blkAsAtt, blkAsBlk, atkAsBlk];`);
  assert.deepEqual(r, [3, 0, 2, 0]);
});

test('VD74-05 compiler: sentences for existing actions (discard, counters plural, opposing Life)', () => {
  assert.deepEqual(acts('[LV1] (When Summoned) Discard two cards from your Hand.'), [{ do: 'DISCARD_HAND', n: 2 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Discard a card from your Hand.'), [{ do: 'DISCARD_HAND', n: 1 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Your counters +2.'), [{ do: 'COUNTER', n: 2 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Send an opposing Life to their Reserve.'), [{ do: 'LIFE_TO_RESERVE', n: 1 }]);
  assert.deepEqual(acts('[LV1] (When Summoned) Send an opposing Life to the Trash.'), [{ do: 'OPP_LIFE_TO_TRASH', n: 1 }]);
  assert.equal(typeof acts('[LV1] (When Summoned) Discard any number of cards from your Hand.'), 'string', 'any number stays in review');
});

test('VD74-06 promoted cards carry the read effects (13 cards, v0.74.0)', async () => {
  const { readFileSync } = await import('node:fs');
  const all = JSON.parse(readFileSync(new URL('../../build/all-cards.json', import.meta.url), 'utf8'));
  const by = Object.fromEntries((Array.isArray(all) ? all : Object.values(all)).map(c => [c.id, c]));
  const ids = ['BS03-126', 'BS05-020', 'BS06-029', 'BS09-020', 'BS12-060', 'BS14-069', 'BS16-023', 'BS21-060', 'BS24-081', 'BS28-022', 'BS30-025', 'BS51-071', 'BS59-039'];
  for (const id of ids) assert.ok(by[id] && (by[id].effects || by[id].magic), id);
  assert.deepEqual(by['BS09-020'].effects[0].actions[0].match, { color: 'white' });
  assert.deepEqual([by['BS16-023'].effects[0].trigger, by['BS16-023'].effects[0].attackingOnly], ['BATTLE_WIN', true]);
  assert.deepEqual(by['BS12-060'].effects[0].actions[1], { do: 'DISCARD_HAND', n: 2, if: { prev: true } });
});
