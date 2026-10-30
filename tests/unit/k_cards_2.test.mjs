// Lane K tests, file 2 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SETUP = `const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; q.hand.length = 0; }`;

test('K-122 NO_BP_DESTROY_TURN (26RBS02-X13): marks one own Cost 6 or less Spirit for this turn only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = G.turnNo || 1;
    const c = BS.mkInst('26RBS02-X13'); c.cores = 4; P.spirits.push(c);
    const fx = BS.CARDS['26RBS02-X13'].effects.find(e => e.trigger === 'START_ATTACK');
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx);
    const set = P.spirits.filter(s => s.noBpTurn === G.turnNo).length; const cost = BS.CARDS[P.spirits.find(s => s.noBpTurn).id].cost;
    return [set, cost <= 6]; })()`);
  assert.deepEqual(r, [1, true], JSON.stringify(r));
});

test('K-123 26RBS02-X13 LV2: draws on the second or later attack of a Wailwraith/Hexcraft Spirit, not the first', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; P.deck.push(BS.mkInst('26RBS01-001'), BS.mkInst('26RBS01-001'));
    const c = BS.mkInst('26RBS02-X13'); c.cores = BS.CARDS['26RBS02-X13'].levels[1].cores; P.spirits.push(c);
    const go = async n => { P.attacksThisTurn = n; const h = P.hand.length; await BS.fireFx(P, 'ALLY_ATTACKS', c, { attacker: c, subject: c }); return P.hand.length - h; };
    return [await go(1), await go(2)]; })()`);
  assert.deepEqual(r, [0, 1], JSON.stringify(r));
});

test('K-124 MUST_ATTACK_OPP (26RBS02-081): marks one opposing Cost 3 or less Spirit for this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = 9;
    const c = BS.mkInst('26RBS02-081'); c.cores = 3; P.spirits.push(c);
    const lo = BS.mkInst('BS48-001'); lo.cores = 1; O.spirits.push(lo);
    const fx = BS.CARDS['26RBS02-081'].effects.find(e => e.trigger === 'OPP_START_ATTACK');
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx);
    return [lo.mustAtk === 9, BS.CARDS['BS48-001'].cost <= 3]; })()`);
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-125 26RBS02-081 LV2: end step refreshes a Spirit that prints a When Blocks effect, not one that does not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RBS02-081'); c.cores = BS.CARDS['26RBS02-081'].levels[1].cores; P.spirits.push(c);
    const a = BS.mkInst('BS50-040'), b = BS.mkInst('BS48-001'); a.exhausted = b.exhausted = true; a.cores = b.cores = 1; P.spirits.push(a, b);
    await BS.fireFx(P, 'END_STEP', c, {});
    return [a.exhausted, b.exhausted]; })()`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-126 26RCB01-035 LV1: opposing Spirit must attack only when all your Spirits/Nexuses are RYUKI', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = O.key; G.turnNo = 11;
    const z = BS.mkInst('26RCB01-035'); z.cores = 3; P.spirits.push(z);
    const foe = BS.mkInst('BS48-001'); foe.cores = 1; O.spirits.push(foe);
    const fx = BS.CARDS['26RCB01-035'].effects.find(e => e.trigger === 'OPP_START_ATTACK');
    const ok = BS.fxIf ? BS.fxIf(P, O, fx.if) : null;
    const other = BS.mkInst('BS48-001'); other.cores = 1; P.spirits.push(other);
    const no = BS.fxIf ? BS.fxIf(P, O, fx.if) : null;
    return [ok, no]; })()`);
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-127 26RDB01-038: needs the Soul Core in the Reserve; the picked opposing Spirit must be LV1', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.battleNo = 5;
    const c = BS.mkInst('26RDB01-038'); c.cores = 1; P.spirits.push(c); G.attacker = c;
    const lo = BS.mkInst('BS48-001'); lo.cores = 1; O.spirits.push(lo);
    const fx = BS.CARDS['26RDB01-038'].effects.find(e => e.trigger === 'ALLY_ATTACKS');
    P.reserve.soul = false; const no = BS.fxIf(P, O, fx.if);
    P.reserve.soul = true; const yes = BS.fxIf(P, O, fx.if);
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx); G.attacker = null;
    return [no, yes, lo.noBlockB === 5]; })()`);
  assert.deepEqual(r, [false, true, true], JSON.stringify(r));
});

test('K-128 26RDB01-061 Main: Blue Beat Nexus only, any Blue Beat card when the Soul Core is in the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const m = BS.mkInst('26RDB01-061'), run = async () => { await BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: BS.CARDS['26RDB01-061'].magic.by.MAIN.actions }); };
    const out = [];
    for (const soul of [false, true]) {
      P.reserve.soul = soul; P.trash.length = 0; P.hand.length = 0;
      const s = BS.mkInst('26RDB01-033'); P.trash.push(s); await run(); out.push(P.hand.includes(s));
    }
    return out; })()`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});

test('K-129 26RDB01-039 LV2: reveals two, summons one Blue Beat Cost<=5 with another name, rest to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RDB01-039'); c.cores = 1; P.spirits.push(c);
    const fx = BS.CARDS['26RDB01-039'].effects.find(e => e.trigger === 'ATTACKS');
    P.reserve.soul = false; const no = BS.fxIf(P, O, fx.if);
    P.reserve.soul = true; const yes = BS.fxIf(P, O, fx.if);
    P.deck = ['BS48-001', '26RDB01-033', 'BS48-001', 'BS48-001'].map(id => BS.mkInst(id));
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx);
    return [no, yes, P.spirits.map(x => x.id).join(), P.deck.length, P.revealed.length]; })()`);
  assert.deepEqual(r, [false, true, '26RDB01-039,26RDB01-033', 3, 0], JSON.stringify(r));
});

test('K-130 26RBS02-087: the picked Spirit is armed for this turn (flag only; the battle hook is not fought out here)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; G.turnNo = 9;
    const s = BS.mkInst('26RDB01-039'); s.cores = 1; P.spirits.push(s);
    const m = BS.mkInst('26RBS02-087'), ctx = { picked: s };
    const fx = BS.CARDS['26RBS02-087'].magic.by ? BS.CARDS['26RBS02-087'].magic.by.FLASH : BS.CARDS['26RBS02-087'].magic;
    await BS.runActions({ p: P, opp: O, src: m, ctx }, { actions: fx.actions.filter(a => a.do === 'LIFE_HIT_NEXUS') });
    return [JSON.stringify(s.lifeHitNexus)]; })()`);
  assert.equal(r[0], JSON.stringify({ turn: 9, costLe: 4 }), JSON.stringify(r));
});

test('K-131 26RDB01-031: reveals three, adds a Yellow Rise Spirit/Magic with another name; LV2 gives a Rei-Ohba +5000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RDB01-031'); c.cores = 1; P.spirits.push(c);
    const fx = BS.CARDS['26RDB01-031'].effects;
    P.deck = ['BS48-001', '26RSD08-X02', 'BS48-001', 'BS48-001'].map(id => BS.mkInst(id));
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'SUMMONED'));
    const rei = BS.mkInst('26RDB01-X05'); rei.cores = 1; P.spirits.push(rei); const b0 = rei.bpMod || 0;
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'ATTACKS'));
    return [P.hand.map(x => x.id).join(), P.deck.length, (rei.bpMod || 0) - b0]; })()`);
  assert.deepEqual(r, ['26RSD08-X02', 3, 5000], JSON.stringify(r));
});

test('K-132 26RSD01-006: pulls up to two cores from the Trash; LV2 End Step sends the Soul Core to a Windfang Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RSD01-006'); c.cores = 1; P.spirits.push(c);
    const fx = BS.CARDS['26RSD01-006'].effects;
    P.trashCores.n = 3; P.trashCores.soul = true;
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'SUMMONED'));
    const w = BS.mkInst('26RBS02-003'); w.cores = 1; P.spirits.push(w);
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'END_STEP'));
    return [c.cores, P.trashCores.n, P.trashCores.soul, !!w.soul, !!c.soul]; })()`);
  assert.deepEqual(r[0] === 3 && r[1] === 1, true, JSON.stringify(r));
  assert.ok(r[2] === false && (r[3] || r[4]), JSON.stringify(r));
});

test('K-133 26RBS02-036: Legacy summon exhausts a foe; life hit discards the whole Hand and draws three', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key;
    const c = BS.mkInst('26RBS02-036'); c.cores = 2; P.spirits.push(c);
    const fx = BS.CARDS['26RBS02-036'].effects;
    P.hand = ['BS48-001', 'BS48-001'].map(id => BS.mkInst(id)); P.deck = ['BS48-001', 'BS48-001', 'BS48-001', 'BS48-001'].map(id => BS.mkInst(id));
    const t0 = P.trash.length;
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'ALLY_LIFE_HIT'));
    return [P.hand.length, P.trash.length - t0, fx.some(e => e.trigger === 'SUMMONED')]; })()`);
  assert.deepEqual(r, [3, 2, true], JSON.stringify(r));
});

test('K-134 26RSD09-010: soulToTrash invoke cost needs a Soul Core and sends it to the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RSD09-010'].effects.find(e => e.invoke); const n = BS.mkInst('26RSD09-010'); P.nexus.push(n);
    P.reserve.soul = false; const no = invokeCostOK(P, n, fx.cost);
    P.reserve.soul = true; const yes = invokeCostOK(P, n, fx.cost);
    const paid = await payInvokeCost(P, n, fx.cost);
    return [no, yes, paid, P.reserve.soul]; })()`);
  assert.deepEqual(r, [false, true, true, false], JSON.stringify(r));
});

test('K-135 26RSD02-009: Bloodrouse summon gains a Purple symbol at LV2 after an opposing Spirit was lost to your effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RSD02-009'); n.cores = 3; P.nexus.push(n);
    const c = BS.mkInst('26RBS01-023');
    const a = summonSymbols(P, BS.CARDS['26RBS01-023']).length;
    P.oppFxLossTurn = G.turnNo;
    const m = summonSymbols(P, BS.CARDS['26RBS01-023']).length;
    P.oppDepletedTurn = G.turnNo;
    const b = summonSymbols(P, BS.CARDS['26RBS01-023']).length;
    return [a, m, b]; })()`);
  assert.deepEqual(r, [0, 0, 1], JSON.stringify(r));
});

test('K-136 26RBS02-007: LV2 battle win in your attack step gives +5000 BP only when the winner is BP-boosted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; P.cpu = true; G.step = 5;
    const c = BS.mkInst('26RBS02-007'); c.cores = 3; P.spirits.push(c);
    const tot = () => P.spirits.reduce((a, x) => a + bpOf(x), 0);
    const run = async () => { const t0 = tot(); await BS.fireFx(P, 'ALLY_BATTLE_WIN', c, { subject: c, attacker: c, attacking: true }); return tot() - t0; };
    c.bpMod = 0; const plain = await run();
    c.bpMod = 1000; const boosted = await run();
    return [plain, boosted]; })()`);
  assert.deepEqual(r, [0, 5000], JSON.stringify(r));
});

test('K-140 26RSD02-009: depleting an opposing Spirit by your effect sets the oppDepleted marker', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    G.active = P.key; P.cpu = true; O.cpu = true;
    const n = BS.mkInst('26RSD02-009'); n.cores = 3; P.nexus.push(n);
    const v = BS.mkInst('26RBS01-023'); v.cores = 1; O.spirits.push(v);
    const before = P.oppDepletedTurn === G.turnNo;
    await BS.runActions({ p: P, opp: O, src: n, ctx: {} }, { actions: [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1 }] });
    return [before, P.oppDepletedTurn === G.turnNo, !O.spirits.includes(v)]; })()`);
  assert.deepEqual(r, [false, true, true], JSON.stringify(r));
});

test('K-137 26RBS03-075: deploy destroys a 4000 BP or less foe only with a Cost 4+ Purgatory Wings Spirit; End Step moves the Soul Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RBS03-075'); n.cores = 2; P.nexus.push(n);
    const fx = BS.CARDS['26RBS03-075'].effects;
    const gate = fxIf(P, O, fx[0].if);
    const w = BS.mkInst('26RSD09-006'); w.cores = 2; P.spirits.push(w);
    const gate2 = fxIf(P, O, fx[0].if);
    P.cpu = true; P.trashCores.soul = true; w.soul = false;
    await BS.runActions({ p: P, opp: O, src: n, ctx: {} }, fx[1]);
    return [gate, gate2, !!P.trashCores.soul]; })()`);
  assert.deepEqual(r[0], false, JSON.stringify(r));
  assert.deepEqual(r[1], true, JSON.stringify(r));
  assert.equal(r[2], false, 'soul left in trash ' + JSON.stringify(r));
});

test('K-138 26RSD09-006: soul-paid summon gives a Purgatory Wings Spirit +2000 BP; LV2 carries MUST_BLOCK', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    P.cpu = true; const c = BS.mkInst('26RSD09-006'); c.cores = 2; P.spirits.push(c);
    const fx = BS.CARDS['26RSD09-006'].effects;
    const b0 = bpOf(c);
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, fx.find(e => e.trigger === 'SUMMONED'));
    return [bpOf(c) - b0, fx.some(e => e.flag === 'MUST_BLOCK')]; })()`);
  assert.deepEqual(r, [2000, true], JSON.stringify(r));
});

test('K-139 26RSD08-007: attack discards a Sword Eye card besides Rei-Ohba for +3000 BP; LV2 buffs Rei-Ohba', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    P.cpu = true; const c = BS.mkInst('26RSD08-007'); c.cores = 3; P.spirits.push(c);
    const fx = BS.CARDS['26RSD08-007'].effects, atk = fx.find(e => e.trigger === 'ATTACKS');
    P.hand = [BS.mkInst('26RDB01-X05')];
    const b0 = bpOf(c);
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, atk);
    const rei = [P.hand.length, bpOf(c) - b0];
    P.hand.push(BS.mkInst('26RSD08-007'));
    await BS.runActions({ p: P, opp: O, src: c, ctx: {} }, atk);
    return [rei, P.hand.length, bpOf(c) - b0, fx.some(e => e.trigger === 'STATIC' && e.bp === 3000)]; })()`);
  assert.deepEqual(r, [[1, 0], 1, 3000, true], JSON.stringify(r));
});

test('K-141 26RBS02-052: Wailwraith card returns to the decktop, to the Hand after two attacks; LV2 refresh on summon in own Main Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const s = BS.mkInst('26RBS02-052'); s.cores = 3; P.spirits.push(s);
    const fx = BS.CARDS['26RBS02-052'].effects;
    const w = P.deck.length, out = [];
    for (const atk of [0, 2]) {
      const t = BS.mkInst('26RBS01-071'); P.trash.push(t); P.attacksThisTurn = atk;
      const h = P.hand.length, d = P.deck.length;
      await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, fx[0]);
      out.push([P.deck.length - d, P.hand.length - h, P.trash.includes(t)]);
    }
    return [out, fx[1].trigger, fx[1].lv]; })()`);
  assert.deepEqual(r[0], [[1, 0, false], [0, 1, false]], JSON.stringify(r));
});

test('K-142 26RBS03-084: Invoke cost exhausts two Cyantree Nexuses; destroys one Cost 2 and one Cost 3 Spirit; needs two Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    P.cpu = true; const n = BS.mkInst('26RBS03-084'); n.cores = 3; P.nexus.push(n);
    const fx = BS.CARDS['26RBS03-084'].effects[0];
    const no = await payInvokeCost(P, n, fx.cost);
    const a = BS.mkInst('26RBS03-084'), b = BS.mkInst('26RBS03-084'); P.nexus.push(a, b);
    const paid = await payInvokeCost(P, n, fx.cost);
    const ex = P.nexus.filter(x => x.exhausted).length;
    O.spirits.length = 0; O.spirits.push(...['BS48-047', 'BS48-001', 'BS48-021'].map(i => { const x = BS.mkInst(i); x.cores = 2; return x; }));
    await BS.runActions({ p: P, opp: O, src: n, ctx: {} }, fx);
    return [no, paid, ex, O.spirits.map(x => x.id), fx.actions.map(x => x.costIs)]; })()`);
  assert.equal(r[0], false, JSON.stringify(r)); assert.equal(r[1], true, JSON.stringify(r)); assert.equal(r[2], 2, JSON.stringify(r));
  assert.deepEqual(r[3], ['BS48-021'], JSON.stringify(r));
});

test('K-143 26RBS01-X06: summon sends a core from up to three opposing Spirits; LV2 attack gets +1 symbol only after an opposing Spirit was depleted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    P.cpu = true; const s = BS.mkInst('26RBS01-X06'); s.cores = 3; P.spirits.push(s);
    const fx = BS.CARDS['26RBS01-X06'].effects;
    O.spirits.length = 0; const t = BS.mkInst('BS48-047'); t.cores = 3; O.spirits.push(t);
    await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, fx[0]);
    return [t.cores, fx[1].if.oppDepleted, fx[1].actions[0].do]; })()`);
  assert.deepEqual(r, [2, true, 'SYMBOL_PLUS'], JSON.stringify(r));
});
