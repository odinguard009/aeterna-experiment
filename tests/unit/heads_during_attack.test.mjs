// v0.72.0 battle heads (plan W pack "event trigger heads", row "(During Attack)" of docs/reports/pack-plan.md;
// Standard rule manual "Examples on Activation Timings" for (During Attack), Comprehensive Rules / Categories of Effects
// "Spirits' When Attacks/Blocks Effects" for battle results; docs/mechanics/battle-heads.md):
// (During Attack) + "When only the opposing Spirit is destroyed by BP comparison" = BATTLE_WIN as the attacker only;
// "When this Spirit's attack reduces the opposing Life" = ALLY_LIFE_HIT self; "For each X you control, this Spirit gains
// +N BP" = STATIC bp / BP_PLUS with "per" (count of matching cards on your Field, this card included).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('DA72-01 compiler: (During Attack) battle result and Life heads', () => {
  for (const w of ['via BP comparison', 'by BP comparison', 'by comparing BP']) {
    const a = compile(`[LV2] (During Attack) When only the opposing Spirit is destroyed ${w}, draw a card.`);
    assert.deepEqual(a.effects, [{ trigger: 'BATTLE_WIN', lv: [2], attackingOnly: true, actions: [{ do: 'DRAW', n: 1 }] }], JSON.stringify(a));
  }
  const b = compile("[LV1][LV2] (During Attack) When this Spirit's attack reduces the opposing Life, draw two cards.");
  assert.deepEqual(b.effects, [{ trigger: 'ALLY_LIFE_HIT', lv: [1, 2], self: true, actions: [{ do: 'DRAW', n: 2 }] }], JSON.stringify(b));
  const c = compile("[LV2] (When Attacks) When this Spirit's attack reduces the opposing Life, put a core from the Void to your Reserve.");
  assert.deepEqual(c.effects[0].trigger + '/' + c.effects[0].self, 'ALLY_LIFE_HIT/true');
  assert.equal(compile('[LV2] (When Battles) When only the opposing Spirit is destroyed by BP comparison, draw a card.').effects[0].attackingOnly, undefined, '(When Battles) = attacker or blocker');
  assert.match(compile("[LV2] (During Attack) When this Spirit's attack would reduce the opposing Life, reduce +1 core.").review || '', /./);
});

test('DA72-02 compiler: "For each X you control, this Spirit gains +N BP" (static, (During Attack), (When Attacks))', () => {
  assert.deepEqual(compile('[LV1][LV2] (During Attack) For each Blue Nexus you control, this Spirit gains +1000 BP.').effects,
    [{ trigger: 'STATIC', bp: 1000, to: 'self', lv: [1, 2], attackingOnly: true, per: { type: 'Nexus', colors: ['blue'] } }]);
  assert.deepEqual(compile('[LV1] For each "Armored Fish" family Spirit you control, this Spirit gains +1000 BP.').effects,
    [{ trigger: 'STATIC', bp: 1000, to: 'self', lv: [1], per: { type: 'Spirit', family: 'Armored Fish' } }]);
  assert.deepEqual(compile('[LV1] For each "Ryuman"-named Spirit you control, this Spirit gains +2000 BP.').effects[0].per, { type: 'Spirit', name: 'Ryuman' });
  const a = compile('[LV1][LV2] (When Attacks) For each "Dragon" family Spirit you control, this Spirit gains +2000 BP.');
  assert.deepEqual(a.effects, [{ trigger: 'ATTACKS', lv: [1, 2], actions: [{ do: 'BP_PLUS', n: 2000, per: { type: 'Spirit', family: 'Dragon' } }] }], JSON.stringify(a));
  assert.deepEqual(compile('[LV1] (During Attack) For each Spirit with Legacy you control, this Spirit gains +2000 BP.').effects[0].per, { type: 'Spirit', keyword: 'Legacy' });      // v0.167: keyword counts (engine per.keyword)
});

let g;
const FIX = [
  { id: 'T72-ATK', name: 'Battle Winner', type: 'Spirit', color: 'red', cost: 2, symbols: 1, families: ['Dragon'], levels: [{ cores: 1, bp: 9000 }],
    effects: [{ trigger: 'BATTLE_WIN', attackingOnly: true, actions: [{ do: 'COUNTER', n: 3 }] }, { trigger: 'ALLY_LIFE_HIT', self: true, actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T72-PER', name: 'Counted', type: 'Spirit', color: 'red', cost: 2, symbols: 1, families: ['Dragon'], levels: [{ cores: 1, bp: 1000 }],
    effects: [{ trigger: 'STATIC', bp: 1000, to: 'self', per: { type: 'Spirit', family: 'Dragon' } }, { trigger: 'STATIC', bp: 500, to: 'self', attackingOnly: true, per: { type: 'Nexus', colors: ['blue'] } }] },
  { id: 'T72-ATT', name: 'Pumped', type: 'Spirit', color: 'red', cost: 2, symbols: 1, families: ['Dragon'], levels: [{ cores: 1, bp: 1000 }],
    effects: [{ trigger: 'ATTACKS', actions: [{ do: 'BP_PLUS', n: 2000, per: { type: 'Spirit', family: 'Dragon' } }] }] },
  { id: 'T72-NX', name: 'Blue Nexus', type: 'Nexus', color: 'blue', cost: 2, levels: [{ cores: 0 }] },
  { id: 'T72-SM', name: 'Small', type: 'Spirit', color: 'blue', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('DA72-03 engine: BATTLE_WIN attackingOnly fires for the winning attacker, not for a winning blocker; ALLY_LIFE_HIT self', async () => {
  const r = await ev(`G.step = 5; const a = sp('T72-ATK'); sp('T72-SM', O); window.cpuChooseBlock = (D, att) => D.spirits[0];
    await BS.doBattle('player', a); const asAtt = P.count;
    P.count = 0; for (const q of [P, O]) q.spirits = []; const b = sp('T72-ATK', O); const s = sp('T72-SM'); window.cpuChooseBlock = (D, att) => D.spirits[0];
    await BS.doBattle('player', s); const asBlk = O.count;
    O.count = 0; P.count = 0; for (const q of [P, O]) q.spirits = []; const c = sp('T72-ATK'); window.cpuChooseBlock = () => null;
    await BS.doBattle('player', c); return [asAtt, asBlk, P.count];`);
  assert.deepEqual(r, [3, 0, 1]);
});

test('DA72-04 engine: STATIC per counts matching cards on your Field; attackingOnly per only while attacking; BP_PLUS per', async () => {
  const r = await ev(`const a = sp('T72-PER'); const one = BS.bpOf(a); sp('T72-ATT'); const two = BS.bpOf(a);
    const nx = BS.mkInst('T72-NX'); P.nexus.push(nx); const idle = BS.bpOf(a); G.attacker = a; const att = BS.bpOf(a); G.attacker = null;
    const ok = [BS.parseActionList([{ do: 'BP_PLUS', n: 2000, per: { type: 'Spirit', family: 'Dragon' } }]).error || 'ok', BS.parseActionList([{ do: 'BP_PLUS', n: 2000, per: { type: 'Magic' } }]).error ? 'err' : 'ok'];
    for (const q of [P, O]) q.spirits = []; const p = sp('T72-ATT'); sp('T72-PER'); window.cpuChooseBlock = () => null; G.step = 5;
    await BS.doBattle('player', p); return [one, two, idle, att, ok, p.bpMod || 0];`);
  assert.deepEqual(r, [2000, 3000, 3000, 3500, ['ok', 'err'], 4000]);
});

test('DA72-05 promoted cards carry the read effects (13 cards, v0.72.0)', async () => {
  const { readFileSync } = await import('node:fs');
  const all = JSON.parse(readFileSync(new URL('../../build/all-cards.json', import.meta.url), 'utf8'));
  const by = Object.fromEntries((Array.isArray(all) ? all : Object.values(all)).map(c => [c.id, c]));
  const ids = ['BS01-021', 'BS10-030', 'BS12-001', 'BS13-017', 'BS18-004', 'BS18-030', 'BS20-034', 'BS34-031', 'BS60-061', '26RBS01-036', '26RBS01-086', '26RCB01-034', '26RSD03-008'];
  for (const id of ids) assert.ok(by[id] && by[id].effects && by[id].effects.length, id);
  assert.deepEqual(by['26RBS01-086'].effects[0].per, { type: 'Nexus', colors: ['blue'] });
  assert.equal(by['26RBS01-036'].effects[0].attackingOnly, true);
  assert.deepEqual([by['BS12-001'].effects[0].trigger, by['BS12-001'].effects[0].self], ['ALLY_LIFE_HIT', true]);
  // v0.74.0: the Brave "(When Brave Attacks)" Life head was staged here; its body (Void core to this Spirit) reads now, so it is promoted
  assert.deepEqual([by['BS21-060'].effects[0].trigger, by['BS21-060'].effects[0].self, by['BS21-060'].effects[0].braved], ['ALLY_LIFE_HIT', true, true]);
});
