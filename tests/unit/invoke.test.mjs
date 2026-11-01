// v0.68.0 Invoke (Standard activations): "{{Invoke|Flash}}" / "{{Invoke|Main}}" heads, "<cost> ▶ <effect>".
// Rules: Standard manual "FAQ on Effects" Q11: the part before ▶ (the cost) must resolve in full, or the effect is not used at all
// (not "as much as possible"); the timing comes from the template (Flash = Flash Timings and also your Main Step; Main = your Main
// Step) plus the printed step / (During Attack) / (During Block) heads; limits only when printed ((Once Per Turn), (Once Per Battle)).
// Engine form: ACTIVATE {invoke:true, timing, when, once, oncePer, cost:{pay|exhaustSelf|destroySelf|exhaustOwn|discard}}.
// Also new sentence forms: own targets with battle/turn BP and extra symbols (BP_TARGET, SYMBOL_TARGET), "during this battle, this
// Spirit gains +N BP", opposing returns with a BP bound / attacking only, destroying an exhausted opposing Spirit.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'blue', cost: 4, families: ['Ferobeast'], levels: [{ cores: 1, bp: 5000 }, { cores: 3, bp: 7000 }], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('INV68-01 compiler: Armalido-style (26RSD06-007) Invoke = ACTIVATE with when, once, exhaustOwn cost and a battle BP boost', () => {
  const c = compile('[LV2] (True Release) (During Block) {{Invoke|Flash}} (Once Per Turn)\nExhaust one of your "Ferobeast" family Nexuses ▶ During this battle, this Spirit gains +3000 BP.');
  assert.equal(c.trueRelease, true, JSON.stringify(c));
  assert.deepEqual(c.effects, [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN', 'FLASH'], when: 'duringBlock', once: true, lv: [2],
    cost: { exhaustOwn: { kind: 'nexus', match: { family: ['Ferobeast'] } } }, actions: [{ do: 'BP_TARGET', n: 3000, to: 'self', battle: true }] }]);
  assert.equal(c.fxComplete, true);
});
test('INV68-02 compiler: heads, costs and Main timing', () => {
  const nx = { type: 'Nexus', levels: [{ cores: 0 }, { cores: 3 }] };
  const a = compile('[LV2] (Opposing Attack Step){{Invoke|Flash}}\nExhaust this Nexus ▶ Target an opposing attacking 3000 BP or less Spirit. Return it to the Hand.', nx);
  assert.deepEqual(a.effects, [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN', 'FLASH'], when: 'oppAttack', once: false, lv: [2], cost: { exhaustSelf: true },
    actions: [{ do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', bpLe: 3000, attackingOnly: true }] }], JSON.stringify(a));
  const b = compile('[LV1-2] {{Invoke|Main}}\nDestroy this Spirit ▶ Draw a card.');
  assert.deepEqual(b.effects[0], { trigger: 'ACTIVATE', invoke: true, timing: ['MAIN'], once: false, lv: [1, 2], cost: { destroySelf: true }, actions: [{ do: 'DRAW', n: 1 }] }, JSON.stringify(b));
  const d = compile('[LV1-2] (Your Attack Step) {{Invoke|Flash}} (Once Per Battle)\nPay two costs ▶ Target one of your attacking "Ferobeast" family Spirits. During this battle, it gains +2000 BP.');
  assert.deepEqual(d.effects[0], { trigger: 'ACTIVATE', invoke: true, timing: ['MAIN', 'FLASH'], when: 'yourAttack', once: true, oncePer: 'battle', lv: [1, 2], cost: { pay: 2 },
    actions: [{ do: 'BP_TARGET', n: 2000, to: 'pick', battle: true, attacking: true, match: { family: ['Ferobeast'] } }] }, JSON.stringify(d));
  const e = compile('[LV1-2] (Your Attack Step) {{Invoke|Flash}}\nExhaust this Spirit ▶ Target one of your Cost 8 or more "Oceanic Green" family Spirits. During this battle, it gains an extra Green symbol.');
  assert.deepEqual(e.effects[0].actions, [{ do: 'SYMBOL_TARGET', n: 1, match: { family: ['Oceanic Green'], costGe: 8 } }], JSON.stringify(e));
  const f = compile('[LV2] (Your Attack Step) {{Invoke|Flash}}\nDestroy this Spirit ▶ Target an opposing Cost 4 or less exhausted Spirit. Destroy it.');
  assert.deepEqual(f.effects[0].actions, [{ do: 'DESTROY', costLe: 4, exhaustedOnly: true }], JSON.stringify(f));
  const g2 = compile('[LV2] {{Invoke|Main}}\nDiscard a "Ferobeast" family card from your Hand ▶ Draw two cards.\nYou can only use this effect of the same card name once per turn.');
  assert.equal(g2.effects[0].sameName, true, JSON.stringify(g2)); assert.equal(g2.effects[0].once, true);
  assert.deepEqual(g2.effects[0].cost, { discard: { match: { family: ['Ferobeast'] } } });
});
test('INV68-03 compiler: unknown heads and costs stay in review', () => {
  assert.match(compile('[LV2] (Your End Step) {{Invoke|Flash}}\nExhaust this Spirit ▶ Draw a card.').review || '', /Invoke head/);
  assert.match(compile('[LV2] {{Invoke|Flash}}\nSend your to the Trash ▶ Draw a card.').review || '', /Invoke cost/);
  assert.match(compile('[LV2] {{Invoke|Flash}}\nExhaust this Nexus ▶ Draw a card.').review || '', /Invoke cost/, 'a Spirit cannot exhaust "this Nexus"');
});

let g;
const FIX = [
  { id: 'T68-BLK', name: 'T68-BLK', type: 'Spirit', color: 'blue', cost: 4, symbols: 1, families: ['Ferobeast'], levels: [{ cores: 1, bp: 5000 }, { cores: 3, bp: 7000 }], fxComplete: true, text: 'fixture',
    effects: [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN', 'FLASH'], when: 'duringBlock', once: true, cost: { exhaustOwn: { kind: 'nexus', match: { family: ['Ferobeast'] } } }, actions: [{ do: 'BP_TARGET', n: 3000, to: 'self', battle: true }] }] },
  { id: 'T68-NEX', name: 'T68-NEX', type: 'Nexus', color: 'blue', cost: 3, symbols: 1, families: ['Ferobeast'], levels: [{ cores: 0 }, { cores: 3 }], fxComplete: true, text: 'fixture',
    effects: [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN', 'FLASH'], when: 'oppAttack', once: false, cost: { exhaustSelf: true }, actions: [{ do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', bpLe: 3000, attackingOnly: true }] }] },
  { id: 'T68-PAY', name: 'T68-PAY', type: 'Spirit', color: 'blue', cost: 3, symbols: 1, families: ['Ferobeast'], levels: [{ cores: 1, bp: 3000 }], fxComplete: true, text: 'fixture',
    effects: [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN', 'FLASH'], when: 'yourAttack', once: true, oncePer: 'battle', cost: { pay: 3 }, actions: [{ do: 'BP_TARGET', n: 2000, to: 'pick', battle: true, attacking: true }] }] },
  { id: 'T68-DES', name: 'T68-DES', type: 'Spirit', color: 'blue', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 4000 }], fxComplete: true, text: 'fixture',
    effects: [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN'], once: false, cost: { destroySelf: true }, actions: [{ do: 'DRAW', n: 1 }] }] },
  { id: 'T68-DIS', name: 'T68-DIS', type: 'Spirit', color: 'blue', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 4000 }], fxComplete: true, text: 'fixture',
    effects: [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN'], once: true, sameName: true, cost: { discard: { match: { family: ['Ferobeast'] } } }, actions: [{ do: 'DRAW', n: 2 }] }] },
  { id: 'T68-FOE', name: 'T68-FOE', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }, { cores: 2, bp: 7000 }, { cores: 3, bp: 9000 }] },
];
before(async () => { g = await openGame(''); await g.page.evaluate(fx => { for (const c of fx) { const r = BS.parseCard(c); if (!r.card) throw new Error(c.id + JSON.stringify(r)); BS.CARDS[c.id] = r.card; } }, FIX); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 4; G.attacker = null; G.blocker = null;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.trash = []; q.hand = []; q.deck = [1,2,3,4,5,6].map(() => BS.mkInst('T68-FOE')); q.removed = []; q.reserve.n = 0; q.reserve.soul = false; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P) => { const i = BS.mkInst(id); i.cores = 0; q.nexus.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('INV68-04 the parser accepts the Invoke fields and rejects bad ones', async () => {
  const r = await ev(`const ok = BS.parseEffects(BS.CARDS['T68-PAY'].effects.map(e => Object.assign({}, e)));
    const bad1 = BS.parseEffects([{ trigger: 'ACTIVATE', invoke: true, when: 'sometimes', actions: [{ do: 'DRAW', n: 1 }] }]);
    const bad2 = BS.parseEffects([{ trigger: 'ACTIVATE', invoke: true, cost: { pay: 0 }, actions: [{ do: 'DRAW', n: 1 }] }]);
    const bad3 = BS.parseEffects([{ trigger: 'ACTIVATE', invoke: true, oncePer: 'game', actions: [{ do: 'DRAW', n: 1 }] }]);
    return [!ok.error, ok.effects && ok.effects[0].cost.pay, !!bad1.error, !!bad2.error, !!bad3.error];`);
  assert.deepEqual(r, [true, 3, true, true, true]);
});
test('INV68-05 (During Block): usable only while this Spirit blocks; the Nexus cost is paid first; +3000 BP for this battle only', async () => {
  const r = await ev(`const b = sp('T68-BLK', P, 1), n = nx('T68-NEX'), a = sp('T68-FOE', O, 1); G.active = O.key; G.step = 5;
    const i = BS.CARDS['T68-BLK'].effects.findIndex(e => e.invoke);
    G.attacker = a; const notBlocking = BS.activatable(P, b, 'FLASH').length;
    G.blocker = b; G.battleNo = (G.battleNo || 0) + 1; const before = BS.bpOf(b); const ok = await BS.activateFx(P, b, i);
    const during = BS.bpOf(b), nexEx = n.exhausted, again = BS.activatable(P, b, 'FLASH').length;
    G.attacker = null; G.blocker = null; const after = BS.bpOf(b);
    return [notBlocking, ok, before, during, nexEx, again, after];`);
  assert.deepEqual(r, [0, true, 5000, 8000, true, 0, 5000]);
});
test('INV68-06 the cost must be payable in full: no refreshed Ferobeast Nexus = not usable', async () => {
  const r = await ev(`const b = sp('T68-BLK', P, 1), n = nx('T68-NEX'), a = sp('T68-FOE', O, 1); G.active = O.key; G.step = 5; G.attacker = a; G.blocker = b; G.battleNo = 1;
    n.exhausted = true; const x = BS.activatable(P, b, 'FLASH').length; n.exhausted = false; return [x, BS.activatable(P, b, 'FLASH').length];`);
  assert.deepEqual(r, [0, 1]);
});
test('INV68-07 Nexus Invoke in the opposing Attack Step returns the attacking 3000 BP or less Spirit; never in your own turn', async () => {
  const r = await ev(`const n = nx('T68-NEX'), a = sp('T68-FOE', O, 1), big = sp('T68-FOE', O, 3); G.step = 5;
    G.attacker = a; const own = BS.activatable(P, n, 'FLASH').length; G.active = O.key;
    const i = BS.CARDS['T68-NEX'].effects.findIndex(e => e.invoke); const ok = await BS.activateFx(P, n, i);
    const ex = n.exhausted; G.attacker = big; n.exhausted = false; const tooBig = BS.activatable(P, n, 'FLASH').length;
    return [own, ok, O.hand.includes(a), ex, tooBig];`);
  assert.deepEqual(r, [0, true, true, true, 0]);
});
test('INV68-08 Pay three costs: needs three cores (Reserve or Field); Once Per Battle resets in the next battle', async () => {
  const r = await ev(`const s = sp('T68-PAY', P, 1), att = sp('T68-FOE', P, 1); G.step = 5; G.attacker = att; G.battleNo = 1; P.reserve.n = 0;
    const i = BS.CARDS['T68-PAY'].effects.findIndex(e => e.invoke); const poor = BS.activatable(P, s, 'FLASH').length; P.reserve.n = 4;
    const ok = await BS.activateFx(P, s, i); const bp = BS.bpOf(att), trash = P.trashCores.n, same = BS.activatable(P, s, 'FLASH').length;
    G.battleNo = 2; const next = BS.activatable(P, s, 'FLASH').length; return [poor, ok, bp, trash, P.reserve.n, same, next];`);
  assert.deepEqual(r, [0, true, 5000, 3, 1, 0, 1]);
});
test('INV68-09 Destroy this Spirit as the cost: it is destroyed first, then the effect resolves; Main only', async () => {
  const r = await ev(`const s = sp('T68-DES', P, 1); const i = BS.CARDS['T68-DES'].effects.findIndex(e => e.invoke);
    G.step = 5; const flash = BS.activatable(P, s, 'FLASH').length; G.step = 4; const ok = await BS.activateFx(P, s, i);
    return [flash, ok, P.spirits.includes(s), P.trash.includes(s), P.hand.length];`);
  assert.deepEqual(r, [0, true, false, true, 1]);
});
test('INV68-10 Discard cost needs a matching card in the Hand; same-name once per turn', async () => {
  const r = await ev(`const s = sp('T68-DIS', P, 1), t = sp('T68-DIS', P, 1); const i = BS.CARDS['T68-DIS'].effects.findIndex(e => e.invoke);
    P.hand = [BS.mkInst('T68-FOE')]; const none = BS.activatable(P, s, 'MAIN').length; P.hand.push(BS.mkInst('T68-BLK'), BS.mkInst('T68-PAY'));
    const ok = await BS.activateFx(P, s, i); const other = BS.activatable(P, t, 'MAIN').length;
    return [none, ok, P.trash.length, P.hand.length, other];`);
  assert.deepEqual(r, [0, true, 1, 4, 0]);
});
test('INV68-11 the CPU uses a battle BP Invoke only when it turns a lost or tied battle into a win', async () => {
  const r = await ev(`const b = sp('T68-BLK', P, 1), n = nx('T68-NEX'), a = sp('T68-FOE', O, 1); G.active = O.key; G.step = 5; G.attacker = a; G.blocker = b; G.battleNo = 1;
    const e = BS.CARDS['T68-BLK'].effects[0], ok = () => cpuInvokeOK(P, b, e, 'FLASH');      // engine global (classic script)
    a.cores = 2; const flips = ok(); a.cores = 3; const stillLoses = ok(); a.cores = 1; const alreadyWins = ok();
    return [flips, stillLoses, alreadyWins];`);
  assert.deepEqual(r, [true, false, false]);
});
test('INV68-12 scenario invoke-griffar-discard-plus-bp (real cards 26RSD01-007, 26RSD01-002, BS31-066)', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/invoke-griffar-discard-plus-bp.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    const L = BS.loadScenario(s); if (L.error) return L.error; BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const gr = window.SC.griffar, gen = window.SC.genbor, squid = window.SC.squid;
    const idle = BS.activatable(P, gr, 'FLASH').length;
    G.attacker = gr; G.blocker = squid; G.battleNo = 1; const bp0 = BS.bpOf(gr);
    const acts = BS.activatable(P, gr, 'FLASH'); if (!acts.length) return 'not activatable';
    await BS.activateFx(P, gr, acts[0].idx);
    return [idle, bp0, BS.bpOf(gr), BS.bpOf(squid), P.trash.includes(gen), P.hand.map(x => x.id), BS.activatable(P, gr, 'FLASH').length];
  }, spec);
  assert.deepEqual(r, [0, 5000, 8000, 7000, true, ['BS31-066'], 0]);
});
test('INV68-13 compiler: zero-BP destroy, "besides <Soul Core>" cores, family return from the Trash', () => {
  const a = compile('[LV2] (When Attacks)\nTarget an opposing Spirit. During this turn, give it -2000 BP. Then, if it has 0 BP, destroy it.');
  assert.deepEqual(a.effects[0].actions, [{ do: 'BP_MINUS', n: 2000, zeroDestroy: true }], JSON.stringify(a));
  const b = compile('[LV2] (When Attacks)\nTarget an opposing Spirit. Send a core, besides , from it to the Reserve.');
  assert.deepEqual(b.effects[0].actions, [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1 }], JSON.stringify(b));
  const c = compile('[LV2] {{Invoke|Main}}\nDestroy this Spirit ▶ Target a "Dark Puce" family Spirit card in your Trash. Return it to the Hand.');
  assert.deepEqual(c.effects[0].actions, [{ do: 'RETURN_TRASH', match: { family: ['Dark Puce'] } }], JSON.stringify(c));
  assert.match(compile('[LV2] (When Attacks)\nTarget an opposing Cost 3 or less Spirit. During this turn, give it -2000 BP. Then, if it has 0 BP, destroy it.').review || '', /bp minus/);
});
test('INV68-14 BP_MINUS zeroDestroy destroys the target only when it is at 0 BP', async () => {
  const r = await ev(`const s = sp('T68-DES', P, 1), weak = sp('T68-FOE', O, 1); const c = { p: P, opp: O, src: s, ctx: {} };
    await BS.FX_ACTIONS.BP_MINUS.run(c, { do: 'BP_MINUS', n: 3000, zeroDestroy: true }); const gone = !O.spirits.includes(weak);
    const strong = sp('T68-FOE', O, 2); await BS.FX_ACTIONS.BP_MINUS.run(c, { do: 'BP_MINUS', n: 3000, zeroDestroy: true });
    return [gone, O.spirits.includes(strong), BS.bpOf(strong)];`);
  assert.deepEqual(r, [true, true, 4000]);
});
test('INV68-15 review fixes: no "once" key = unlimited; battle BP ends when the Spirit leaves; pay never takes the source cores', async () => {
  const r = await ev(`const p = BS.parseEffects([{ trigger: 'ACTIVATE', invoke: true, actions: [{ do: 'DRAW', n: 1 }] }]).effects[0].once;
    const b = sp('T68-BLK', P, 1), a = sp('T68-FOE', O, 1); G.attacker = a; G.blocker = b; G.battleNo = 1;
    await BS.FX_ACTIONS.BP_TARGET.run({ p: P, opp: O, src: b, ctx: {} }, { do: 'BP_TARGET', n: 3000, to: 'self', battle: true });
    const up = BS.bpOf(b); BS.removeSpirit(P, b, 'destroyed', true); P.trash = P.trash.filter(x => x !== b); P.spirits.push(b); b.cores = 1;
    const back = BS.bpOf(b);
    const s = sp('T68-PAY', P, 2); G.active = P.key; G.step = 5; G.attacker = sp('T68-FOE', P, 1); G.blocker = null; G.battleNo = 2; P.reserve.n = 3;
    const ok = await BS.activateFx(P, s, BS.CARDS['T68-PAY'].effects.findIndex(e => e.invoke));
    return [p, up, back, ok, s.cores, P.reserve.n];`);
  assert.deepEqual(r, [false, 8000, 5000, true, 2, 0]);
});
test('INV68-16 compiler: "during this battle" outside a battle trigger stays in review', () => {
  assert.match(compile('[LV1] (When Summoned)\nDuring this battle, this Spirit gains +3000 BP.').review || '', /battle/);
  assert.equal(compile('[LV1] (When Attacks)\nDuring this battle, this Spirit gains +3000 BP.').effects[0].actions[0].battle, true);
});
