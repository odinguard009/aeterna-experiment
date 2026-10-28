// v0.55.0 engine levers + compiler patterns: BP minus (no BP-0 destruction rule: Eternal manual FAQ p. 68),
// (When Destroyed by the Opponent) (Standard CR 12-2-1-12-1), (When Battles) "when only the opposing Spirit is destroyed
// by comparing BP" (Standard CR 8-1-6-2) and Rush {{Rush|Colour}} ("while you have a X symbol, the following effect activates next").
// rules: ETR:faq.bp@134528fb, STD:12-2-1-12@caad612c, STD:8-1-6@d5ccb2aa
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const card = (text, extra = {}) => JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra));
const compile = (text, extra) => py(`c = json.loads(${JSON.stringify(card(text, extra))})\ntry: print(json.dumps(ce.compile_card(c)))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);
const RUSH = c => `{{Rush|${c}}}\n(While you have a ${c} symbol, the following effect activates next)\n: `;

test('C55-01 BP minus: one opposing Spirit/Ultimate (Spirit and Magic); "every opposing" stays staged', () => {
  assert.deepEqual(compile('[LV1][LV2] (When Attacks) During this turn, give an opposing Spirit -3000 BP.').effects[0].actions, [{ do: 'BP_MINUS', n: 3000 }]);
  assert.deepEqual(compile('Flash During this turn, give an opposing Spirit/Ultimate -5000 BP.', { type: 'Magic', levels: [] }).magic,
    { timing: ['FLASH'], effect: 'ACTIONS', value: 0, actions: [{ do: 'BP_MINUS', n: 5000 }] });
  assert.match(compile('Flash During this turn, give every opposing Spirit/Ultimate -2000 BP.', { type: 'Magic', levels: [] }).review, /sentence/);
});
test('C55-02 (When Destroyed by the Opponent) = DESTROYED with if byOpp; Depleted/Destroyed adds alsoDepleted', () => {
  assert.deepEqual(compile('[LV2] (When Destroyed by the Opponent)\nDraw two cards.').effects, [{ trigger: 'DESTROYED', lv: [2], if: { byOpp: true }, actions: [{ do: 'DRAW', n: 2 }] }]);
  assert.match(compile('[LV1] (When Destroyed by the Opponent) Refresh this Spirit.').review, /about this Spirit/);
  assert.deepEqual(compile('[LV1] (When Depleted/Destroyed by the Opponent) Draw a card.').effects, [{ trigger: 'DESTROYED', lv: [1], if: { byOpp: true }, alsoDepleted: true, actions: [{ do: 'DRAW', n: 1 }] }]);   // v0.177.0
});
test('C55-03 (When Battles) "when only the opposing Spirit is destroyed by comparing BP" = BATTLE_WIN', () => {
  assert.deepEqual(compile('[LV1][LV2] (When Battles)\nWhen only the opposing Spirit is destroyed by comparing BP, exhaust an opposing Spirit.').effects,
    [{ trigger: 'BATTLE_WIN', lv: [1, 2], actions: [{ do: 'EXHAUST_OPP', n: 1 }] }]);
  assert.deepEqual(compile('[LV2] (When Battles)\nWhen only the opposing Spirit/Ultimate is destroyed via BP comparison, you can draw a card.').effects,
    [{ trigger: 'BATTLE_WIN', lv: [2], optional: true, actions: [{ do: 'DRAW', n: 1 }] }]);
  assert.match(compile('[LV1] (When Battles) During this turn, give two opposing Spirits -1000 BP.').review, /sentence: During this turn/);
});
test('C55-04 Rush: the Rush effect runs after the main body, only while you have that colour symbol', () => {
  const e = compile('[LV1][LV2][LV3] (When Attacks)\nThis Spirit gains +5000 BP.\n' + RUSH('Purple') + 'Draw a card.', { levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }, { cores: 5, bp: 7000 }] }).effects;
  assert.deepEqual(e, [{ trigger: 'ATTACKS', lv: [1, 2, 3], actions: [{ do: 'BP_PLUS', n: 5000 }, { do: 'DRAW', n: 1, if: { hasSymbol: 'purple' } }] }]);
  assert.deepEqual(compile('[LV1] (When Summoned) Draw a card.\n{{Rush|Yellow Symbol}}\n(While you have a Yellow symbol, the following effect activates next)\n: Exhaust an opposing Spirit.').effects[0].actions,
    [{ do: 'DRAW', n: 1 }, { do: 'EXHAUST_OPP', n: 1, if: { hasSymbol: 'yellow' } }]);
  assert.match(compile('[LV1] (When Summoned) Draw a card.\n' + RUSH('Purple') + 'You can draw a card.').review, /Rush/);
  assert.match(compile('Flash Draw a card.\n' + RUSH('Purple') + 'Draw a card.', { type: 'Magic', levels: [] }).review, /Rush/);
});

let g;
const FIX = [
  { id: 'T55-ATK', name: 'Minus Tester', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }] },
  { id: 'T55-MINUS', name: 'Minus Giver', type: 'Spirit', color: 'yellow', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'SUMMONED', actions: [{ do: 'BP_MINUS', n: 5000 }] }] },
  { id: 'T55-DBO', name: 'Opp Death', type: 'Spirit', color: 'white', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'DESTROYED', if: { byOpp: true }, actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T55-WIN', name: 'Battle Winner', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 5000 }], effects: [{ trigger: 'BATTLE_WIN', actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T55-RUSH', name: 'Rush Tester', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'SUMMONED', actions: [{ do: 'COUNTER', n: 1 }, { do: 'COUNTER', n: 2, if: { hasSymbol: 'purple' } }] }] },
  { id: 'T55-PUR', name: 'Purple Symbol', type: 'Spirit', color: 'purple', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T55-PNX', name: 'Purple Nexus', type: 'Nexus', color: 'purple', cost: 2, symbols: 1, levels: [{ cores: 0 }] },
  { id: 'T55-DIE', name: 'Any Death', type: 'Spirit', color: 'white', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'DESTROYED', actions: [{ do: 'COUNTER', n: 1 }] }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const block = b => { window.cpuChooseBlock = () => b; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('C55-05 parse: BATTLE_WIN trigger, BP_MINUS action, byOpp and hasSymbol conditions; bad values are rejected', async () => {
  const r = await ev(`const x = BS.parseEffects([{ trigger: 'BATTLE_WIN', actions: [{ do: 'BP_MINUS', n: 3000 }] }, { trigger: 'DESTROYED', if: { byOpp: true }, actions: [{ do: 'DRAW', n: 1, if: { hasSymbol: 'blue' } }] }]);
    const bad = [BS.parseActionList([{ do: 'BP_MINUS', n: 0 }]).error, BS.parseActionList([{ do: 'BP_MINUS', n: 1500 }]).error, BS.parseActionList([{ do: 'DRAW', n: 1, if: { hasSymbol: 'pink' } }]).error];
    return [x.error || null, x.effects.map(e => e.trigger), bad.map(b => !!b)];`);
  assert.deepEqual(r, [null, ['BATTLE_WIN', 'DESTROYED'], [true, true, true]]);
});
// rules: ETR:faq.bp@134528fb
test('C55-06 BP minus lowers BP until the end of the turn, never below 0, and does not destroy by itself (FAQ p. 68)', async () => {
  const r = await ev(`const t = sp('T55-ATK', O); const m = BS.mkInst('T55-MINUS'); m.cores = 1; P.spirits.push(m);
    await BS.fireFx(P, 'SUMMONED', m, {}); return [BS.bpOf(t), O.spirits.includes(t), t.bpMod];`);
  assert.deepEqual(r, [0, true, -5000]);
});
test('C55-07 (When Destroyed by the Opponent) fires only when the opponent destroys it', async () => {
  const r = await ev(`const a = sp('T55-DBO'); BS.removeSpirit(P, a, 'destroyed', true); await BS.flushBursts(); const n1 = P.count;
    const b = sp('T55-DBO'); BS.removeSpirit(P, b, 'destroyed', false); await BS.flushBursts(); return [n1, P.count];`);
  assert.deepEqual(r, [1, 1]);
});
test('C55-08 BATTLE_WIN: only when the opposing Spirit alone is destroyed by BP comparison (attacker and blocker side)', async () => {
  const r = await ev(`const a = sp('T55-WIN'), b = sp('T55-ATK', O); block(b); await BS.doBattle('player', a); const won = P.count;
    const c = sp('T55-ATK'), d = sp('T55-WIN', O); block(d); await BS.doBattle('player', c); const blkWon = O.count;
    const e = sp('T55-WIN'), f = sp('T55-WIN', O); block(f); await BS.doBattle('player', e); return [won, blkWon, P.count, O.count];`);
  assert.deepEqual(r, [1, 1, 1, 1]);
});
test('C55-09 Rush: the extra action runs only while you have that colour symbol', async () => {
  const r = await ev(`const x = sp('T55-RUSH'); await BS.fireFx(P, 'SUMMONED', x, {}); const without = P.count; P.count = 0;
    sp('T55-PUR'); await BS.fireFx(P, 'SUMMONED', x, {}); return [without, P.count];`);
  assert.deepEqual(r, [1, 3]);
});
test('C55-10 scenario battle-win-only-opposing-destroyed: The Witch Naja exhausts the other Goradon', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/battle-win-only-opposing-destroyed.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    BS.loadScenario(s); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const [blk, oth] = O.spirits; window.cpuChooseBlock = () => blk;
    await BS.doBattle('player', P.spirits[0]);
    return [O.spirits.length, oth.exhausted, P.spirits.length];
  }, spec);
  assert.deepEqual(r, [1, true, 1]);
});

test('C55-11 compiler: the Rush effect can have several sentences, each gets the symbol condition', () => {
  assert.deepEqual(compile('[LV1] (When Attacks) Draw a card.\n' + RUSH('Blue') + 'Draw a card. Exhaust an opposing Spirit.').effects[0].actions,
    [{ do: 'DRAW', n: 1 }, { do: 'DRAW', n: 1, if: { hasSymbol: 'blue' } }, { do: 'EXHAUST_OPP', n: 1, if: { hasSymbol: 'blue' } }]);
});
test('C55-12 compiler: BP minus outside the engine range stays staged; Rush without a main effect stays staged', () => {
  assert.match(compile('[LV1] (When Summoned) During this turn, give an opposing Spirit -1500 BP.').review, /BP minus 1500/);
  assert.match(compile('[LV1] (When Summoned) Draw a card.\n\n' + RUSH('Red') + 'Draw a card.').review, /Rush/);
});
test('C55-13 compiler: (When Destroyed by the Opponent) also on (When Summoned) cards keeps both effects separate', () => {
  const e = compile('[LV1] (When Summoned) Draw a card.\n\n[LV1][LV2] (When Destroyed by the Opponent) Exhaust an opposing Spirit.').effects;
  assert.deepEqual(e.map(x => [x.trigger, x.if || null]), [['SUMMONED', null], ['DESTROYED', { byOpp: true }]]);
});
test('C55-14 BP minus ends with the turn (bpMod is cleared in beginTurn)', async () => {
  const r = await ev(`const t = sp('T55-ATK', O); const m = sp('T55-MINUS'); await BS.fireFx(P, 'SUMMONED', m, {}); const a = BS.bpOf(t);
    for (const k of ['player', 'opponent']) for (const f of BS.fieldList(G.p[k])) f.bpMod = 0; return [a, BS.bpOf(t)];`);
  assert.deepEqual(r, [0, 3000]);
});
// rules: ETR:faq.bp@134528fb
test('C55-15 BP plus and minus add up in order on the current level BP (FAQ p. 68 Q1)', async () => {
  const r = await ev(`const t = sp('T55-ATK', O); t.bpMod = -5000; const a = BS.bpOf(t); t.bpMod += 3000; return [a, BS.bpOf(t)];`);
  assert.deepEqual(r, [0, 1000]);
});
test('C55-16 BP minus hits exactly one opposing Spirit when several are on the Field', async () => {
  const r = await ev(`sp('T55-ATK', O); sp('T55-WIN', O); sp('T55-PUR', O); const m = sp('T55-MINUS'); await BS.fireFx(P, 'SUMMONED', m, {});
    return O.spirits.filter(s => s.bpMod < 0).length;`);
  assert.equal(r, 1);
});
test('C55-17 BATTLE_WIN does not fire when the attack is not blocked', async () => {
  const r = await ev(`const a = sp('T55-WIN'); window.cpuChooseBlock = () => null; await BS.doBattle('player', a); return [P.count, O.life];`);
  assert.deepEqual(r, [0, 4]);
});
test('C55-18 destruction in battle counts as "by the opponent"; a plain (When Destroyed) still fires both ways', async () => {
  const r = await ev(`const a = sp('T55-ATK'), b = sp('T55-DBO', O); block(b); await BS.doBattle('player', a); const n1 = O.count;
    const d = sp('T55-DIE'); BS.removeSpirit(P, d, 'destroyed', false); await BS.flushBursts(); return [n1, P.count];`);
  assert.deepEqual(r, [1, 1]);
});
test('C55-19 Rush: a Nexus symbol of that colour counts; Soul State cards do not', async () => {
  const r = await ev(`const x = sp('T55-RUSH'); const s = BS.mkInst('T55-PUR'); P.soulState.push(s); await BS.fireFx(P, 'SUMMONED', x, {}); const a = P.count; P.count = 0;
    const n = BS.mkInst('T55-PNX'); P.nexus.push(n); await BS.fireFx(P, 'SUMMONED', x, {}); return [a, P.count];`);
  assert.deepEqual(r, [1, 3]);
});
test('C55-20 the 12 promoted v0.55 cards are in the pack with engine data', async () => {
  const ids = ['BS01-047', 'BS04-032', 'BS05-023', 'BS19-049', 'BS19-109', 'BS20-012', 'BS20-031', 'BS20-053', 'BS23-001', 'BS27-004', 'BS40-012', 'BS46-016'];
  const r = await g.page.evaluate(L => L.filter(id => !BS.CARDS[id] || !(BS.CARDS[id].effects || BS.CARDS[id].magic)), ids);
  assert.deepEqual(r, []);
});
test('C55-21 Bone-Tops (BS20-012): Rush destroys an opposing Nexus only with a Red symbol on your Field', async () => {
  const r = await ev(`const nx = () => { const i = BS.mkInst('T55-PNX'); O.nexus.push(i); return i; }; nx();
    for (let k = 0; k < 4; k++) P.deck.push(BS.mkInst('BS01-001'));
    const b = sp('BS20-012'); await BS.fireFx(P, 'SUMMONED', b, {}); const without = O.nexus.length;
    sp('T55-ATK'); await BS.fireFx(P, 'SUMMONED', b, {}); return [without, O.nexus.length];`);
  assert.deepEqual(r, [1, 0]);
});
