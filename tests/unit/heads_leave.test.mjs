// v0.73.0 leave heads (plan W pack "event trigger heads", row "no trigger: When this Spirit" of docs/reports/pack-plan.md;
// Comprehensive Rules / Categories of Effects "Spirit/Nexus' When Destroyed Effects", Destruction "Resolving Destruction",
// Fandom keyword pages Curtain Call / True-Curse for the "would leave the Field due to ..." wording; docs/mechanics/leave-heads.md):
// "When this Spirit is destroyed by the opponent" = DESTROYED byOpp (opposing effect or BP comparison);
// "... destroyed by opposing effects / an opposing effect" = DESTROYED byOppFx (opposing effect only, not BP comparison);
// "When this Spirit would leave the Field due to the opponent" = LEAVES (destroyed, depleted, returned or removed by the
// opponent: opposing effect or BP comparison); "... due to / by opposing effects" = LEAVES byOppFx.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('LV73-01 compiler: destroyed-by and would-leave heads', () => {
  const a = compile('[LV1][LV2] When this Spirit is destroyed by the opponent, draw a card.');
  assert.deepEqual(a.effects, [{ trigger: 'DESTROYED', lv: [1, 2], if: { byOpp: true }, actions: [{ do: 'DRAW', n: 1 }] }], JSON.stringify(a));
  for (const w of ['opposing effects', 'an opposing effect']) {
    const b = compile(`[LV2] When this Spirit is destroyed by ${w}, draw a card.`);
    assert.deepEqual(b.effects, [{ trigger: 'DESTROYED', lv: [2], if: { byOppFx: true }, actions: [{ do: 'DRAW', n: 1 }] }], w + ' ' + JSON.stringify(b));
  }
  const c = compile('[LV1][LV2] When this Spirit would leave the Field due to the opponent, draw a card.');
  assert.deepEqual(c.effects, [{ trigger: 'LEAVES', lv: [1, 2], actions: [{ do: 'DRAW', n: 1 }] }], JSON.stringify(c));
  for (const w of ['due to opposing effects', 'due to an opposing effect', 'by opposing effects', 'due to opposing effect']) {
    const d = compile(`[LV1] When this Spirit would leave the field ${w}, draw a card.`);
    assert.deepEqual(d.effects, [{ trigger: 'LEAVES', lv: [1], if: { byOppFx: true }, actions: [{ do: 'DRAW', n: 1 }] }], w + ' ' + JSON.stringify(d));
  }
  assert.match(compile('[LV1] When this Spirit would leave the Field due to opposing effects, you can return it to the Hand.').review || '', /./, 'self-return bodies stay in review');
  assert.match(compile('[LV1] When this Spirit is destroyed by opposing effects, this Spirit gains +3000 BP.').review || '', /./, 'bodies about this Spirit stay in review');
});

let g;
const FIX = [
  { id: 'T73-OPP', name: 'Opp Destroyed', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }],
    effects: [{ trigger: 'DESTROYED', if: { byOpp: true }, actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T73-FX', name: 'Fx Destroyed', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }],
    effects: [{ trigger: 'DESTROYED', if: { byOppFx: true }, actions: [{ do: 'COUNTER', n: 2 }] }] },
  { id: 'T73-LV', name: 'Leaver', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 2, bp: 1000 }],
    effects: [{ trigger: 'LEAVES', actions: [{ do: 'COUNTER', n: 4 }] }] },
  { id: 'T73-LVFX', name: 'Fx Leaver', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 2, bp: 1000 }],
    effects: [{ trigger: 'LEAVES', if: { byOppFx: true }, actions: [{ do: 'COUNTER', n: 5 }] }] },
  { id: 'T73-BIG', name: 'Big', type: 'Spirit', color: 'blue', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 9000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r).slice(0, 600));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = O.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const src = BS.mkInst('T73-BIG'); src.cores = 1; O.spirits.push(src);
  const oppFx = async acts => { await BS.runActions({ p: O, opp: P, src, ctx: {} }, { actions: acts }); await BS.flushBursts(); };
  const battleLoss = async me => { const a = BS.mkInst('T73-BIG'); a.cores = 1; O.spirits.push(a); G.step = 5; window.cpuChooseBlock = () => me; await BS.doBattle('opponent', a); await BS.flushBursts(); };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('LV73-02 engine: DESTROYED byOpp fires on effect and battle; byOppFx only on an opposing effect', async () => {
  const r = await ev(`const out = [];
    sp('T73-OPP'); await oppFx([{ do: 'DESTROY' }]); out.push(P.count); P.count = 0;
    const s1 = sp('T73-OPP'); await battleLoss(s1); out.push(P.count); P.count = 0;
    sp('T73-FX'); await oppFx([{ do: 'DESTROY' }]); out.push(P.count); P.count = 0;
    const s2 = sp('T73-FX'); await battleLoss(s2); out.push(P.count); return out;`);
  assert.deepEqual(r, [1, 1, 2, 0]);
});

test('LV73-03 engine: LEAVES fires on opposing destroy, return, depletion and battle; byOppFx not on battle; never on own leave', async () => {
  const r = await ev(`const out = [];
    sp('T73-LV', P, 2); await oppFx([{ do: 'DESTROY' }]); out.push(P.count); P.count = 0;
    sp('T73-LV', P, 2); await oppFx([{ do: 'BOUNCE_OPP', to: 'hand' }]); out.push(P.count, P.hand.some(h => h.id === 'T73-LV')); P.count = 0;
    const d = sp('T73-LV', P, 2); d.cores = 1; G.fxBy = O.key; BS.checkDepletion(P); G.fxBy = null; await BS.flushBursts(); out.push(P.count); P.count = 0;
    const b = sp('T73-LV', P, 2); await battleLoss(b); out.push(P.count); P.count = 0;
    const f = sp('T73-LVFX', P, 2); await battleLoss(f); out.push(P.count); P.count = 0;
    sp('T73-LVFX', P, 2); await oppFx([{ do: 'DESTROY' }]); out.push(P.count); P.count = 0;
    const own = sp('T73-LV', P, 2); BS.removeSpirit(P, own, 'destroyed', false); await BS.flushBursts(); out.push(P.count);
    return out;`);
  assert.deepEqual(r, [4, 4, true, 4, 4, 0, 5, 0]);
});

test('LV73-04 compiler: "Then, B." = B with if.prev; "A, and B." = both actions in order; conditions cover both halves', () => {
  const a = compile('[LV1] (When Blocks) Your counter +2. Then, draw a card.');
  assert.deepEqual(a.effects[0].actions, [{ do: 'COUNTER', n: 2 }, { do: 'DRAW', n: 1, if: { prev: true } }], JSON.stringify(a));
  const b = compile('[LV1] (When Attacks) Draw a card, and destroy an opposing 3000 BP or less Spirit.');
  assert.deepEqual(b.effects[0].actions, [{ do: 'DRAW', n: 1 }, { do: 'DESTROY', bpLe: 3000 }], JSON.stringify(b));
  const c = compile('[LV1] (When Summoned) Your Counter +1, and draw a card from the deckbottom.');
  assert.deepEqual(c.effects[0].actions, [{ do: 'COUNTER', n: 1 }, { do: 'DRAW_BOTTOM', n: 1 }], JSON.stringify(c));
  const d = compile('[LV1] (When Summoned) If you have 3 or less Life, draw a card, and put a core from the Void to your Reserve.');
  if (!d.review) for (const x of d.effects[0].actions) assert.ok(x.if && Object.keys(x.if).length, 'the condition covers both halves: ' + JSON.stringify(d));
  assert.match(compile('[LV1] (When Summoned) Draw a card, and you can put a core from the Void to your Reserve.').review || '', /./, 'an optional second half stays in review');
});

test('LV73-05 promoted cards carry the read effects (12 cards, v0.73.0)', async () => {
  const { readFileSync } = await import('node:fs');
  const all = JSON.parse(readFileSync(new URL('../../build/all-cards.json', import.meta.url), 'utf8'));
  const by = Object.fromEntries((Array.isArray(all) ? all : Object.values(all)).map(c => [c.id, c]));
  const ids = ['BS14-100', 'BS19-067', 'BS21-047', 'BS41-003', 'BS43-028', 'BS47-053', 'BS55-046', 'BS60-025', 'BS60-050', 'BS67-027', 'BS67-065', 'BS67-066'];
  for (const id of ids) assert.ok(by[id] && (by[id].effects || by[id].magic), id);
  assert.deepEqual([by['BS47-053'].effects[0].trigger, by['BS47-053'].effects[0].if], ['LEAVES', { byOppFx: true }]);
  assert.deepEqual([by['BS60-050'].effects[1].trigger, by['BS60-050'].effects[1].lv], ['LEAVES', [2]]);
  assert.deepEqual(by['BS67-027'].effects[1].actions[1].if, { prev: true });
});
