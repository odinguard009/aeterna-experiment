// Lane K tests, file 80 (rule 1b). Schemas v259-v262: DISCARD_ANY_DRAW, DEPLOY_TRASH.all, MILL_OPP.perOppHand, RESERVE_TO_SPIRIT, VOID_TO_CARD per-count. Cards: BS16-049, BS19-005, BS02-092, BS02-093, BS04-098, BS02-107, BS03-146, BS03-148, BS02-068, BS02-069, BS04-111, BS01-078, BS01-115, BS03-030, BS01-X03.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-808 MILL_OPP perOppHand: one opposing deck-top card goes to the Trash per card in the opposing Hand (BS04-111)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')]; O.deck = Array.from({ length: 6 }, () => BS.mkInst('BS01-001')); const t0 = O.trash.length;
    const act = BS.CARDS['BS04-111'].magic.by.MAIN.actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS04-111'), ctx: {} };
    await BS.FX_ACTIONS.MILL_OPP.run(c, act); return [O.deck.length, O.trash.length - t0, BS.FX_ACTIONS.MILL_OPP.chk(act)]; })()`);
  assert.deepEqual(r, [3, 3, true], JSON.stringify(r));
});

test('K-809 BS01-078 moves one core from the Trash to the Reserve when it attacks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.trashCores.n = 2; const r0 = P.reserve.n;
    const e = BS.CARDS['BS01-078'].effects[0]; const c = { p: P, opp: O, src: BS.mkInst('BS01-078'), ctx: {} };
    await BS.FX_ACTIONS.TRASH_CORES_TO.run(c, e.actions[0]); return [e.trigger, P.trashCores.n, P.reserve.n - r0]; })()`);
  assert.deepEqual(r, ['ATTACKS', 1, 1], JSON.stringify(r));
});

test('K-810 RESERVE_TO_SPIRIT: up to 3 Reserve cores go to a Spirit, then BS01-115 draws a card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.spirits = [];
    const i = BS.mkInst('BS01-001'); i.cores = 1; P.spirits.push(i); P.reserve.n = 2; P.hand = []; P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    const acts = BS.CARDS['BS01-115'].magic.by.FLASH.actions; const c = { p: P, opp: O, src: BS.mkInst('BS01-115'), ctx: {} };
    await BS.FX_ACTIONS.RESERVE_TO_SPIRIT.run(c, acts[0]); await BS.FX_ACTIONS.DRAW.run(c, acts[1]); return [i.cores, P.reserve.n, P.hand.length, acts.length]; })()`);
  assert.deepEqual(r, [3, 0, 1, 2], JSON.stringify(r));
});

test('K-811 VOID_TO_CARD perNexus / perOtherSpirit: one Void core per Nexus (BS03-030) and per other Spirit (BS01-X03)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.spirits = []; P.nexus = [];
    const a = BS.mkInst('BS03-030'); a.cores = 1; P.spirits.push(a); const b = BS.mkInst('BS01-001'); b.cores = 1; P.spirits.push(b); P.nexus.push(BS.mkInst('BS01-X03'), BS.mkInst('BS01-X03')); P.void = 9;
    const e = BS.CARDS['BS03-030'].effects[0].actions[0]; const c = { p: P, opp: O, src: a, ctx: {} }; const k0 = a.cores;
    await BS.FX_ACTIONS.VOID_TO_CARD.run(c, e); const nx = a.cores - k0;
    const e2 = BS.CARDS['BS01-X03'].effects.find(x => x.trigger === 'SUMMONED').actions[0]; const k1 = a.cores; await BS.FX_ACTIONS.VOID_TO_CARD.run({ p: P, opp: O, src: a, ctx: {} }, e2);
    return [BS.FX_ACTIONS.VOID_TO_CARD.chk(e), BS.FX_ACTIONS.VOID_TO_CARD.chk(e2), nx, a.cores - k1]; })()`);
  assert.deepEqual(r, [true, true, 2, 1], JSON.stringify(r));
});

test('K-812 BS02-068 deploys a White Nexus from the Hand free and skips a non-White one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.nexus = [];
    P.hand = [BS.mkInst('BS01-102')]; const e = BS.CARDS['BS02-068'].effects[0]; const act = e.actions[0]; const c = { p: P, opp: O, src: BS.mkInst('BS02-068'), ctx: {} };
    await BS.FX_ACTIONS.SUMMON_HAND.run(c, act); const none = P.nexus.length;
    P.hand = [BS.mkInst('BS01-110')]; await BS.FX_ACTIONS.SUMMON_HAND.run(c, act);
    return [e.trigger, e.optional, none, P.nexus.length, P.nexus[0] && P.nexus[0].id, BS.FX_ACTIONS.SUMMON_HAND.chk(act)]; })()`);
  assert.deepEqual(r, ['SUMMONED', true, 0, 1, 'BS01-110', true], JSON.stringify(r));
});

test('K-813 DISCARD_ANY_DRAW: the CPU discards every Nexus in hand and draws one per card (BS03-146)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    P.hand = [BS.mkInst('BS01-102'), BS.mkInst('BS01-110'), BS.mkInst('BS01-001')]; P.deck = Array.from({ length: 5 }, () => BS.mkInst('BS01-001')); const t0 = P.trash.length;
    const act = BS.CARDS['BS03-146'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.DISCARD_ANY_DRAW.run({ p: P, opp: O, src: BS.mkInst('BS03-146'), ctx: {} }, act);
    return [P.trash.length - t0, P.hand.length, P.deck.length, BS.FX_ACTIONS.DISCARD_ANY_DRAW.chk(act)]; })()`);
  assert.deepEqual(r, [2, 3, 3, true], JSON.stringify(r));
});

test('K-814 DEPLOY_TRASH all: every Red/Green/Blue Nexus in the Trash is deployed, others stay (BS03-148)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.nexus = [];
    const act = BS.CARDS['BS03-148'].magic.by.MAIN.actions[0]; const ids = ['BS01-098', 'BS01-099'];
    P.trash = [BS.mkInst(ids[0]), BS.mkInst(ids[1]), BS.mkInst('BS01-102')];
    await BS.FX_ACTIONS.DEPLOY_TRASH.run({ p: P, opp: O, src: BS.mkInst('BS03-148'), ctx: {} }, act);
    return [P.nexus.length, P.trash.map(x => x.id), BS.FX_ACTIONS.DEPLOY_TRASH.chk(act)]; })()`);
  assert.equal(r[0], 2, JSON.stringify(r)); assert.deepEqual(r[1], ['BS01-102']); assert.equal(r[2], true);
});

test('K-815 OPP_CORE_TO_TRASH_NR: the CPU takes a core from the opposing Nexus holding the most, else the Reserve (BS02-092)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const n = BS.mkInst('BS01-098'); n.cores = 2; O.nexus = [n]; O.reserve.n = 3; const t0 = O.trashCores.n;
    const act = BS.CARDS['BS02-092'].magic.by.MAIN.actions[0]; const c = () => ({ p: P, opp: O, src: BS.mkInst('BS02-092'), ctx: {} });
    await BS.FX_ACTIONS.OPP_CORE_TO_TRASH_NR.run(c(), act); const a = [n.cores, O.reserve.n, O.trashCores.n - t0];
    n.cores = 0; await BS.FX_ACTIONS.OPP_CORE_TO_TRASH_NR.run(c(), act); return [a, [n.cores, O.reserve.n, O.trashCores.n - t0], BS.FX_ACTIONS.OPP_CORE_TO_TRASH_NR.chk(act)]; })()`);
  assert.deepEqual(r, [[1, 3, 1], [0, 2, 2], true], JSON.stringify(r));
});

test('K-816 BOTH_CORES_TO_TRASH: each player sends four cores from their Spirits to their own Trash (BS02-093)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true; P.spirits = []; O.spirits = [];
    const mk = (q, n) => { const i = BS.mkInst('BS01-001'); i.cores = n; q.spirits.push(i); return i; }; const a = mk(P, 5), b = mk(O, 3); const pt = P.trashCores.n, ot = O.trashCores.n;
    const act = BS.CARDS['BS02-093'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.BOTH_CORES_TO_TRASH.run({ p: P, opp: O, src: BS.mkInst('BS02-093'), ctx: {} }, act);
    return [a.cores, b.cores, P.trashCores.n - pt, O.trashCores.n - ot, BS.FX_ACTIONS.BOTH_CORES_TO_TRASH.chk(act)]; })()`);
  assert.deepEqual(r, [1, 0, 4, 3, true], JSON.stringify(r));
});

test('K-817 VOID_TO_NEXUS_LV: Void cores fill a Nexus up to its LV2 threshold and no further (BS04-098)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const n = BS.mkInst('BS01-098'); n.cores = 0; P.nexus = [n]; P.void = 20; const need = BS.CARDS['BS01-098'].levels[1].cores;
    const act = BS.CARDS['BS04-098'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.VOID_TO_NEXUS_LV.run({ p: P, opp: O, src: BS.mkInst('BS04-098'), ctx: {} }, act);
    return [n.cores === need, P.void === 20 - need, BS.FX_ACTIONS.VOID_TO_NEXUS_LV.chk(act)]; })()`);
  assert.deepEqual(r, [true, true, true], JSON.stringify(r));
});

test('K-818 per.type Hand: BS16-049 gets +1000 BP per card in the opposing Hand when it attacks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.hand = [1, 2, 3, 4].map(() => BS.mkInst('BS01-001'));
    const s = BS.mkInst('BS16-049'); s.cores = 1; P.spirits = [s]; const act = BS.CARDS['BS16-049'].effects[0].actions[0]; const b0 = s.bpMod || 0;
    await BS.FX_ACTIONS.BP_PLUS.run({ p: P, opp: O, src: s, ctx: {} }, act); return [(s.bpMod || 0) - b0, BS.FX_ACTIONS.BP_PLUS.chk(act)]; })()`);
  assert.deepEqual(r, [4000, true], JSON.stringify(r));
});

test('K-819 BS19-005 is complete: returns a Spirit from the Trash on summon, +1000 BP per own Hand card in its own Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { const k = BS.CARDS['BS19-005']; const e = k.effects;
    return [e.map(x => x.trigger + ':' + (x.actions ? x.actions[0].do : x.perHand)), JSON.stringify(e[1].if)]; })()`);
  assert.deepEqual(r, [['SUMMONED:RETURN_TRASH', 'STATIC:true'], '{"attackStep":true,"oppTurn":false}'], JSON.stringify(r));
});

test('K-820 BS11-024 and BS21-057 are wired with existing actions (REFRESH_SPIRIT count 2 High Speed; braved DESTROYED EXHAUST_OPP 2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { const a = BS.CARDS['BS11-024'].effects, b = BS.CARDS['BS21-057'].effects;
    return [a[1].actions[0].do + a[1].actions[0].count, JSON.stringify(a[1].lv), b[0].trigger + b[0].braved + b[0].actions[0].n]; })()`);
  assert.deepEqual(r, ['REFRESH_SPIRIT2', '[2]', 'DESTROYEDtrue2'], JSON.stringify(r));
});

test('K-821 BS04-103 refreshes three exhausted Giant/Armored Beast Spirits; BS06-051 is wired for Brilliance', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; P.spirits = [];
    const fam = Object.values(BS.CARDS).filter(k => k.type === 'Spirit' && (k.families || []).some(f => f === 'Giant Beast' || f === 'Armored Beast')).slice(0, 4);
    const sp = fam.map(k => { const i = BS.mkInst(k.id); i.cores = 1; i.exhausted = true; P.spirits.push(i); return i; });
    const act = BS.CARDS['BS04-103'].magic.by.FLASH.actions[0]; await BS.FX_ACTIONS.REFRESH_SPIRIT.run({ p: P, opp: O, src: BS.mkInst('BS04-103'), ctx: {} }, act);
    return [sp.length, sp.filter(s => !s.exhausted).length, BS.CARDS['BS06-051'].effects[0].trigger]; })()`);
  assert.deepEqual(r, [4, 3, 'DESTROYED'], JSON.stringify(r));
});

test('K-822 OPP_HAND_TO_BOTTOM top:true puts the card on the decktop (BS07-013); BS20-023 is wired as a choice', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const h = BS.mkInst('BS01-001'); O.hand = [h]; O.deck = [BS.mkInst('BS01-002')];
    const act = BS.CARDS['BS07-013'].effects[0].actions[0]; await BS.FX_ACTIONS.OPP_HAND_TO_BOTTOM.run({ p: P, opp: O, src: BS.mkInst('BS07-013'), ctx: {} }, act);
    return [O.deck[0] === h, O.hand.length, BS.FX_ACTIONS.OPP_HAND_TO_BOTTOM.chk(act), BS.CARDS['BS20-023'].effects[0].actions[0].do]; })()`);
  assert.deepEqual(r, [true, 0, true, 'CHOOSE_ONE'], JSON.stringify(r));
});

test('K-823 DESTROY_NEXUS_ALL drawEach: BS21-074 destroys every opposing Nexus and draws one card per Nexus; BS03-077 is wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    O.nexus = [BS.mkInst('BS01-098'), BS.mkInst('BS01-099')]; P.deck = [1, 2, 3, 4].map(() => BS.mkInst('BS01-001')); P.hand = [];
    const act = BS.CARDS['BS21-074'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.DESTROY_NEXUS_ALL.run({ p: P, opp: O, src: BS.mkInst('BS21-074'), ctx: {} }, act);
    return [O.nexus.length, P.hand.length, BS.FX_ACTIONS.DESTROY_NEXUS_ALL.chk(act), BS.CARDS['BS03-077'].effects[0].trigger]; })()`);
  assert.deepEqual(r, [0, 2, true, 'DESTROYED'], JSON.stringify(r));
});

test('K-824 DESTROY_OWN drawLv draws cards equal to the destroyed Spirit level (BS38-069); BS58-054 and BS19-072 are wired', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS01-001'); s.cores = 1; P.spirits = [s]; P.deck = [1, 2, 3, 4].map(() => BS.mkInst('BS01-001')); P.hand = [];
    const lv = BS.lvNo ? BS.lvNo(s) : 1; const act = BS.CARDS['BS38-069'].magic.by.MAIN.actions[0];
    await BS.FX_ACTIONS.DESTROY_OWN.run({ p: P, opp: O, src: BS.mkInst('BS38-069'), ctx: {} }, act);
    return [P.spirits.length, P.hand.length >= 1, BS.FX_ACTIONS.DESTROY_OWN.chk(act), BS.CARDS['BS58-054'].effects.map(e => e.trigger).sort().join(), BS.CARDS['BS19-072'].effects[0].actions[0].do]; })()`);
  assert.deepEqual(r, [0, true, true, 'DESTROYED,SUMMONED', 'VOID_TO_MATCHING'], JSON.stringify(r));
});

test('K-825 BS41-085 CHOOSE_ONE returns a Spirit or three Astral Dragons from the Trash; BS10-043 draws on a Cost 2 ally death', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    P.trash = [BS.mkInst('BS01-001')]; P.hand = [];
    const act = BS.CARDS['BS41-085'].magic.by.MAIN.actions[0]; await BS.FX_ACTIONS.CHOOSE_ONE.run({ p: P, opp: O, src: BS.mkInst('BS41-085'), ctx: {} }, act);
    const e = BS.CARDS['BS10-043'].effects[0];
    return [P.hand.length, P.trash.length, BS.FX_ACTIONS.CHOOSE_ONE.chk(act), e.trigger, JSON.stringify(e.match)]; })()`);
  assert.deepEqual(r, [1, 0, true, 'ALLY_DIED', '{"costIn":[2]}'], JSON.stringify(r));
});

test('K-826 BOUNCE_OPP blockedOnly returns only the blocked attacker (BS06-044)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const a = BS.mkInst('BS01-001'), b = BS.mkInst('BS01-002'); a.cores = 1; b.cores = 1; O.spirits = [a, b]; O.hand = [];
    const act = { do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', blockedOnly: true };
    const ok = BS.FX_ACTIONS.BOUNCE_OPP.chk(act);
    await BS.FX_ACTIONS.BOUNCE_OPP.run({ p: P, opp: O, src: BS.mkInst('BS06-044'), ctx: { attacker: b } }, act);
    return [ok, O.spirits.length, O.spirits[0] === a, O.hand[0] === b, BS.CARDS['BS06-044'].effects.some(e => e.trigger === 'BLOCKS')]; })()`);
  assert.deepEqual(r, [true, 1, true, true, true], JSON.stringify(r));
});

test('K-827 RETURN_TRASH toBottom puts picked Spirits on the deckbottom (BS04-105)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    P.trash = [1, 2, 3].map(() => BS.mkInst('BS01-001')); P.hand = []; const d0 = P.deck.length;
    const act = BS.CARDS['BS04-105'].magic.by.MAIN.actions[0];
    await BS.FX_ACTIONS.RETURN_TRASH.run({ p: P, opp: O, src: BS.mkInst('BS04-105'), ctx: {} }, act);
    return [BS.FX_ACTIONS.RETURN_TRASH.chk(act), P.trash.length, P.hand.length, P.deck.length - d0]; })()`);
  assert.deepEqual(r, [true, 0, 0, 3], JSON.stringify(r));
});

test('K-828 OPP_CORES_TO_TRASH untilOne leaves one core (BS09-012); BS06-018 untilOne to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS01-002'); s.cores = 4; O.spirits = [s]; const t0 = O.trashCores.n;
    const act = BS.CARDS['BS09-012'].effects[0].actions[0]; const ok = BS.FX_ACTIONS.OPP_CORES_TO_TRASH.chk(act);
    await BS.FX_ACTIONS.OPP_CORES_TO_TRASH.run({ p: P, opp: O, src: BS.mkInst('BS09-012'), ctx: {} }, act);
    return [ok, s.cores, O.trashCores.n - t0, BS.CARDS['BS06-018'].effects[0].actions[0].untilOne]; })()`);
  assert.deepEqual(r, [true, 1, 3, true], JSON.stringify(r));
});

test('K-829 BS09-048 destroys a Cost 2 or less opposing Spirit only with a Green Spirit on the Field', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const e = BS.CARDS['BS09-048'].effects[0];
    return [e.trigger, JSON.stringify(e.if), e.actions[0].do, e.actions[0].costLe]; })()`);
  assert.deepEqual(r, ['SUMMONED', '{"ctrl":{"n":1,"type":"Spirit","colors":["green"]}}', 'DESTROY', 2], JSON.stringify(r));
});

test('K-830 VOID_TO_CARD perLv puts cores equal to the Spirit level (BS14-026)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const s = BS.mkInst('BS14-026'); s.cores = 3; P.spirits = [s]; P.void = 5; const lv = BS.lvNo(s);
    const act = BS.CARDS['BS14-026'].effects[0].actions[0]; const ok = BS.FX_ACTIONS.VOID_TO_CARD.chk(act);
    const before = s.cores; await BS.FX_ACTIONS.VOID_TO_CARD.run({ p: P, opp: O, src: s, ctx: {} }, act);
    return [ok, s.cores - before === lv, lv >= 1]; })()`);
  assert.deepEqual(r, [true, true, true], JSON.stringify(r));
});

test('K-831 BS14-075 draws when its Spirit destroys an opposing Spirit by attack (data shape)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const e = BS.CARDS['BS14-075'].effects[0];
    return [e.trigger, JSON.stringify(e.if), e.actions[0].do, e.actions[0].n]; })()`);
  assert.equal(r[0], 'OPP_DIED'); assert.equal(r[2], 'DRAW');
});

test('K-832 DESTROY_OPP_OWN: the opponent loses its weakest Spirit (BS13-051)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const a = BS.mkInst('BS01-002'), b = BS.mkInst('BS01-003'); a.cores = 1; b.cores = 1; O.spirits = [a, b]; const n0 = O.spirits.length;
    const act = { do: 'DESTROY_OPP_OWN' }; const ok = BS.FX_ACTIONS.DESTROY_OPP_OWN.chk(act); const c = { p: P, opp: O, src: BS.mkInst('BS13-051'), ctx: {} };
    await BS.FX_ACTIONS.DESTROY_OPP_OWN.run(c, act); const k = O.spirits.length;
    O.spirits = []; await BS.FX_ACTIONS.DESTROY_OPP_OWN.run(c, act);
    return [ok, n0, k, c.ctx.did]; })()`);
  assert.deepEqual(r, [true, 2, 1, false], JSON.stringify(r));
});

test('K-833 OWN_LIFE_TO_VOID moves a Life core to the Void and fails with only a Soul Core (BS16-008)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    P.life = 5; P.lifeSoul = false; const v0 = P.void; const act = { do: 'OWN_LIFE_TO_VOID', n: 1 }; const ok = BS.FX_ACTIONS.OWN_LIFE_TO_VOID.chk(act);
    const c = { p: P, opp: O, src: BS.mkInst('BS16-008'), ctx: {} };
    await BS.FX_ACTIONS.OWN_LIFE_TO_VOID.run(c, act); const after = [P.life, P.void - v0];
    P.life = 1; P.lifeSoul = true; const c2 = { p: P, opp: O, src: BS.mkInst('BS16-008'), ctx: {} };
    await BS.FX_ACTIONS.OWN_LIFE_TO_VOID.run(c2, act);
    return [ok, after, P.life, c2.ctx.did]; })()`);
  assert.deepEqual(r, [true, [4, 1], 1, false], JSON.stringify(r));
});

test('K-834 BS17-013 reacts to Cost 3 allies destroyed (not depleted) by the opponent (data shape)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const e = BS.CARDS['BS17-013'].effects[0];
    return [e.trigger, JSON.stringify(e.match), JSON.stringify(e.if), e.actions[0].do, e.actions[0].costLe, !!e.optional]; })()`);
  assert.deepEqual(r, ['ALLY_LOST', '{"costIn":[3],"type":"Spirit"}', '{"byOpp":true,"depleted":false}', 'DESTROY', 3, true], JSON.stringify(r));
});
