// v0.169.0 new engine pieces: END_STEP trigger ("(Your End Step)"), REFRESH_SPIRIT n / all, BP_TARGET coreFromSelf (the Gaim Arms
// Flash), OPP_CORES_TO_RESERVE upgrade (If three or more cores are in the opposing Reserve / If summoned via Form Change),
// ctrl.family as a list. Rules: ETR:effects.activation, Standard manual "Examples on Activation Timings" (End Step).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 5;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 0; q.reserve.soul = false; q.onceUsed = {}; q.void = 10; q.life = 5; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const plain = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && !BS.CARDS[id].effects && BS.CARDS[id].levels[0].cores === 1 && BS.CARDS[id].levels[0].bp <= 3000);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V169-01 END_STEP: Stellouse (Lv2) refreshes up to two exhausted Leucomyst Spirits at the End Step, not other Spirits', async () => {
  const r = await ev(`const st = sp('26RBS01-053', P, 2);
    const leu = Object.keys(BS.CARDS).filter(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].families || []).includes('Leucomyst') && id !== '26RBS01-053' && !BS.CARDS[id].effects);
    const a = sp(leu[0], P, 1), b = sp(leu[0], P, 1), c = sp(leu[0], P, 1), other = sp(plain, P, 1);
    for (const x of [a, b, c, other]) x.exhausted = true;
    G.active = 'player'; await BS.endStep('player');
    return [a.exhausted, b.exhausted, c.exhausted, other.exhausted];`);
  assert.equal(r.filter(x => x === false).length, 2, 'exactly two Leucomyst Spirits were refreshed');
  assert.equal(r[3], true, 'a non-Leucomyst Spirit stays exhausted');
});

test('V169-02 END_STEP fires only for the player whose turn ends', async () => {
  const r = await ev(`const st = sp('26RBS01-053', O, 2); const leu = Object.keys(BS.CARDS).find(id => (BS.CARDS[id].families || []).includes('Leucomyst') && BS.CARDS[id].type === 'Spirit' && !BS.CARDS[id].effects);
    const a = sp(leu, O, 1); a.exhausted = true; G.active = 'player'; await BS.endStep('player'); return a.exhausted;`);
  assert.equal(r, true);
});

test('V169-03 Flustle: needs three Wailwraith/Hexcraft family Spirits (a family list condition), then refreshes one Spirit', async () => {
  const r = await ev(`const fl = sp('26RBS03-057', P, 2);
    const wl = Object.keys(BS.CARDS).filter(id => BS.CARDS[id].type === 'Spirit' && ((BS.CARDS[id].families || []).includes('Wailwraith') || (BS.CARDS[id].families || []).includes('Hexcraft')) && id !== '26RBS03-057' && !BS.CARDS[id].effects);
    const x = sp(plain, P, 1); x.exhausted = true;
    G.active = 'player'; await BS.endStep('player'); const none = x.exhausted;
    sp(wl[0], P, 1); sp(wl[0], P, 1);      // Flustle itself counts: three in all
    G.active = 'player'; await BS.endStep('player'); return [none, x.exhausted, fl.exhausted];`);
  assert.equal(r[0], true, 'with one family Spirit the effect does nothing');
  assert.equal(r[1], false, 'with three it refreshes the exhausted Spirit');
});

test('V169-04 Pepper\'s Beast: "This Spirit can refresh" at the End Step; Amplify adds +1000 BP per Leucomyst Spirit (itself counts)', async () => {
  const r = await ev(`const pb = sp("26RBS01-054", P, 3); pb.exhausted = true;
    G.active = 'player'; await BS.endStep('player');
    const idx = BS.CARDS['26RBS01-054'].effects.findIndex(e => e.invoke);
    const foe = sp(plain, O, 1); G.attacker = pb; G.blocker = foe; G.battleNo = 1; P.reserve.n = 5;
    const bp0 = BS.bpOf(pb); const ok = await BS.activateFx(P, pb, idx);
    return [pb.exhausted, ok, BS.bpOf(pb) - bp0, BS.CARDS['26RBS01-054'].keywords];`);
  assert.equal(r[0], false);
  assert.equal(r[1], true);
  assert.equal(r[2], 1000, 'one Leucomyst Spirit (itself) x 1000');
  assert.deepEqual(r[3], ['AMPLIFY']);      // the parser upper-cases keywords
});

test('V169-05 Knuckle Kurumi Arms: sends a core to a "Kamen Rider Baron" Spirit and gives it +3000 BP this battle; never to itself', async () => {
  const r = await ev(`const bar = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].name.includes('Kamen Rider Baron') && !BS.CARDS[id].effects) || Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].name.includes('Kamen Rider Baron'));
    const k = sp('26RCB01-003', P, 2), b = sp(bar, P, 1), foe = sp(plain, O, 1);
    G.attacker = b; G.blocker = foe; G.battleNo = 1; P.reserve.n = 5;
    const idx = BS.CARDS['26RCB01-003'].effects.findIndex(e => e.invoke);
    const bp0 = BS.bpOf(b); const ok = await BS.activateFx(P, k, idx);
    return [ok, k.cores, b.cores, BS.bpOf(b) - bp0];`);
  assert.deepEqual(r, [true, 1, 2, 3000]);
});

test('V169-06 Knuckle with no Baron on the Field: the Flash cannot be used (no legal target), no core moves', async () => {
  const r = await ev(`const k = sp('26RCB01-003', P, 2), foe = sp(plain, O, 1), me = sp(plain, P, 1);
    G.attacker = me; G.blocker = foe; G.battleNo = 1; P.reserve.n = 5;
    const idx = BS.CARDS['26RCB01-003'].effects.findIndex(e => e.invoke);
    const ok = await BS.activateFx(P, k, idx); return [ok, k.cores, me.cores];`);
  assert.equal(r[1], 2);
  assert.equal(r[2], 1);
});

test('V169-07 Menotera: with three or more cores in the opposing Reserve it may send the Soul Core of a Spirit that has no other core', async () => {
  const r = await ev(`const m = sp('26RBS03-020', P, 3), t = sp(plain, O, 0); t.soul = true; O.reserve.n = 0;
    await BS.fireFx(P, 'SUMMONED', m);
    const noUp = [O.spirits.includes(t), O.reserve.soul];
    O.reserve.n = 3; await BS.fireFx(P, 'SUMMONED', m);
    return [noUp, O.spirits.includes(t), O.reserve.soul];`);
  assert.deepEqual(r[0], [true, false], 'below three cores in the Reserve the Soul Core stays');
  assert.equal(r[1], false, 'the Spirit lost its Soul Core and was depleted');
  assert.equal(r[2], true, 'the Soul Core went to the opposing Reserve');
});

test('V169-08 Menotera: a Spirit with a normal core and the Soul Core loses the normal core first', async () => {
  const r = await ev(`const m = sp('26RBS03-020', P, 3), t = sp(plain, O, 1); t.soul = true; O.reserve.n = 4;
    await BS.fireFx(P, 'SUMMONED', m); return [t.cores, t.soul, O.reserve.soul];`);
  assert.deepEqual(r, [0, true, false]);
});

test('V169-09 Pienetta: only an exhausted Spirit, or any Spirit once the opposing Reserve holds three cores', async () => {
  const r = await ev(`const pi = sp('26RBS03-016', P, 3), t = sp(plain, O, 2); O.reserve.n = 0;
    await BS.fireFx(P, 'SUMMONED', pi); const fresh = t.cores;
    O.reserve.n = 3; await BS.fireFx(P, 'SUMMONED', pi); const upgraded = t.cores;
    t.cores = 2; t.exhausted = true; O.reserve.n = 0; await BS.fireFx(P, 'SUMMONED', pi);
    return [fresh, upgraded, t.cores];`);
  assert.deepEqual(r, [2, 1, 1]);
});

test('V169-10 Zeztz Plasma Booster: the Soul Core goes too only when it was summoned via Form Change', async () => {
  const r = await ev(`const z = sp('26RCB01-023', P, 3), t = sp(plain, O, 0); t.soul = true;
    await BS.fireFx(P, 'SUMMONED', z); const plainSummon = O.spirits.includes(t);
    z.viaFC = true; await BS.fireFx(P, 'SUMMONED', z); return [plainSummon, O.spirits.includes(t)];`);
  assert.deepEqual(r, [true, false]);
});

test('V169-11 Nexus "Refresh all your Green Spirits" (REFRESH_SPIRIT all) refreshes every exhausted Green Spirit', async () => {
  const r = await ev(`const nx = BS.mkInst('BS19-086'); nx.cores = 3; P.nexus.push(nx);
    const greens = Object.keys(BS.CARDS).filter(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].colors || [BS.CARDS[id].color]).includes('green') && BS.CARDS[id].levels[0].cores === 1 && !BS.CARDS[id].effects);
    const a = sp(greens[0]), b = sp(greens[1] || greens[0]), red = sp(Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].colors || [BS.CARDS[id].color]).includes('red') && !BS.CARDS[id].effects));
    for (const x of [a, b, red]) x.exhausted = true;
    G.active = 'player'; await BS.endStep('player'); return [a.exhausted, b.exhausted, red.exhausted];`);
  assert.deepEqual(r, [false, false, true]);
});
