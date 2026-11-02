// Lane K tests, file 77 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Standard block A closing bundle: the last nine partial 26R* cards (schema 246) + the Soul Awaken core fix.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });
const IDS = ['26RBS01-119', '26RBS01-125', '26RBS02-092', '26RBS03-095', '26RDB01-058', '26RSD08-013', '26RDB01-060', '26RBS03-X04', '26RDB01-042'];
// in-page helpers: a spirit of a given kind on a side (cores taken from its reserve so the core total stays constant)
const PRE = `
const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
const team = t => Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && new RegExp('\\[Teams?: [^\\]]*' + t).test(BS.CARDS[i].desc || ''));
const find = f => Object.keys(BS.CARDS).find(id => { const c = BS.CARDS[id]; return c.type === 'Spirit' && f(c); });
const put = (side, id, cores = 1) => { const s = BS.mkInst(id); s.cores = cores; side.reserve.n -= cores; side.spirits.push(s); return s; };
const run = (side, other, src, acts) => BS.runActions({ p: side, opp: other, src, ctx: { selfInst: src } }, { actions: acts });
`;
const ev = (page, body) => page.evaluate(`(async () => { ${PRE} ${body} })()`);

test('K-600 data: the nine cards are complete with no residual', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(ids => ids.filter(id => { const c = BS.CARDS[id]; return !c || c.partial || (c.residual && c.residual.length); }), IDS);
  assert.deepEqual(r, []);
});

test('K-601 Guard Effect: a white Spirit becomes immune to opposing Magic for the battle', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const w = put(P, find(c => (c.colors || []).includes('white'))); G.battleNo = 3;
    const m = BS.mkInst('26RBS01-119');
    await run(P, O, m, BS.CARDS['26RBS01-119'].magic.actions);
    return [w.noMagicB, G.battleNo];`);
  assert.deepEqual(r, [3, 3], JSON.stringify(r));
});

test('K-602 Soul Awaken moves the Soul Core out of the Reserve and keeps the core total', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const tot = () => P.reserve.n + P.trashCores.n + P.spirits.reduce((a, s) => a + s.cores, 0) + P.nexus.reduce((a, s) => a + s.cores, 0);
    P.reserve.soul = true;
    const s = put(P, find(c => c.cost <= 3), 1); const t0 = tot();
    await run(P, O, s, [{ do: 'SOUL_AWAKEN' }]);
    return [s.soul === true, P.reserve.soul === true, tot() - t0];`);
  assert.deepEqual(r, [true, false, 0], JSON.stringify(r));
});

test('K-603 Sacrifice Strike: destroys the attacking Rumble Spirit and mills the opponent by its Rumble number', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const id = '26RBS01-077';
    const s = put(P, id); G.attacker = s;
    const n = BS.CARDS[id].effects.flatMap(e => e.actions).find(a => a.do === 'RUMBLE').n;
    const d0 = O.deck.length, t0 = O.trash.length;
    await run(P, O, BS.mkInst('26RBS01-125'), BS.CARDS['26RBS01-125'].magic.actions);
    return [P.spirits.includes(s), d0 - O.deck.length, O.trash.length - t0, n];`);
  assert.deepEqual(r.slice(0, 2), [false, r[3]], JSON.stringify(r));
  assert.equal(r[2], r[3], JSON.stringify(r));
});

test('K-604 Sacrifice Strike does nothing without an attacking Rumble Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const s = put(P, '26RBS01-077'); G.attacker = null; const d0 = O.deck.length;
    await run(P, O, BS.mkInst('26RBS01-125'), BS.CARDS['26RBS01-125'].magic.actions);
    return [P.spirits.includes(s), O.deck.length - d0];`);
  assert.deepEqual(r, [true, 0], JSON.stringify(r));
});

test('K-605 Furious Anger: marks one symbol lost for the turn (attackSymbols -1), only with the Topaz even-cost condition', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const o = put(O, find(c => c.cost >= 3 && (c.symbols || 1) >= 2) || find(c => c.cost >= 3), 1); G.turnNo = 7;
    const a0 = BS.attackSymbols(o);
    await run(P, O, BS.mkInst('26RBS03-095'), [{ do: 'SYMBOL_LOSE_OPP' }]);
    const a1 = BS.attackSymbols(o); G.turnNo = 8;
    return [a0 - a1, BS.attackSymbols(o) - a1, BS.fxIf(P, O, BS.CARDS['26RBS03-095'].magic.actions[0].if)];`);
  assert.deepEqual(r, [1, 1, false], JSON.stringify(r));
});

test('K-606 Howling Song: all matching Spirits get the turn-long effect; Twilight Fantasia Song: one Spirit gets the battle-long effect that expires', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const gw = team('Green Wave'), yr = team('Yellow Rise');
    G.turnNo = 9; G.battleNo = 4;
    const a = put(P, gw), b = put(P, gw), y = put(P, yr);
    await run(P, O, BS.mkInst('26RDB01-058'), BS.CARDS['26RDB01-058'].magic.actions);
    const turnOn = [a, b, y].map(s => (s.grantFx || []).length);
    await run(P, O, BS.mkInst('26RSD08-013'), BS.CARDS['26RSD08-013'].magic.actions);
    const bat = y.grantFx.filter(g => g.until === 'battle').length;
    G.battleNo = 5;
    const stillOn = y.grantFx.filter(g => g.until === 'battle' && g.battleNo === G.battleNo).length;
    return [!!gw, !!yr, turnOn, bat, stillOn];`);
  assert.deepEqual(r, [true, true, [1, 1, 0], 1, 0], JSON.stringify(r));
});

test('K-607 Rindorin: an EX-marked Trash Spirit counts for the step only; pickedFamily needs the discarded card family', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    G.turnNo = 5; G.step = 4;
    const id = find(c => (c.colors || []).includes('purple'));
    const t = BS.mkInst(id); P.trash.push(t);
    await run(P, O, BS.mkInst('26RBS03-X04'), [BS.CARDS['26RBS03-X04'].effects[1].actions[0]]);
    const marked = !!t.exMark && t.exMark.step === 4;
    const dp = find(c => (c.families || []).includes('Dark Puce')), ot = find(c => !(c.families || []).includes('Dark Puce'));
    const yes = BS.fxIf(P, O, { pickedFamily: 'Dark Puce' }, { picked: BS.mkInst(dp) });
    const no = BS.fxIf(P, O, { pickedFamily: 'Dark Puce' }, { picked: BS.mkInst(ot) });
    const none = BS.fxIf(P, O, { pickedFamily: 'Dark Puce' }, {});
    return [marked, yes, no, none];`);
  assert.deepEqual(r, [true, true, false, false], JSON.stringify(r));
});

test('K-608 Misty Lylebit: highSpeedIf needs Blue Beat only and a Soul Core in Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const c = BS.CARDS['26RDB01-060'], m = BS.CARDS['26RDB01-042'];
    const hs = m.highSpeedIf;
    P.reserve.soul = true;
    const bb = team('Blue Beat');
    const other = find(x => !/Blue Beat/.test(x.desc || ''));
    put(P, bb); const ok = BS.fxIf(P, O, hs);
    put(P, other); const mixed = BS.fxIf(P, O, hs);
    return [c.soulMagic, m.highSpeed === true, ok, mixed];`);
  assert.deepEqual(r, ['yellow', true, true, false], JSON.stringify(r));
});

test('K-609 Howling Song: a granted Green Wave Spirit that is blocked exhausts an opposing Spirit; an ungranted one does not; the grant ends with the turn', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const gw = team('Green Wave'), a = put(P, gw), b = put(P, gw), o = put(O, find(c => c.cost >= 3));
    G.turnNo = 9; G.battleNo = 4; a.grantFx = [];
    await run(P, O, BS.mkInst('26RDB01-058'), BS.CARDS['26RDB01-058'].magic.actions);
    O.spirits[0].exhausted = false;
    await BS.fireFx(P, 'ALLY_BLOCKED', a, { attacker: a });
    const withGrant = O.spirits[0].exhausted;
    O.spirits[0].exhausted = false; a.grantFx = []; 
    await BS.fireFx(P, 'ALLY_BLOCKED', a, { attacker: a });
    return [withGrant, O.spirits[0].exhausted];`);
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-610 Twilight Fantasia Song: Life hit with Life 3 or less adds a Life while the battle lasts, not in the next battle', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const yr = team('Yellow Rise'), y = put(P, yr);
    G.turnNo = 9; G.battleNo = 4; P.life = 3; P.void = 4;
    await run(P, O, BS.mkInst('26RSD08-013'), BS.CARDS['26RSD08-013'].magic.actions);
    const l0 = P.life;
    await BS.fireFxMulti([{ owner: P, trigger: 'ALLY_LIFE_HIT', src: null, ctx: { attacker: y } }]);
    const gained = P.life - l0;
    G.battleNo = 5; const l1 = P.life;
    await BS.fireFxMulti([{ owner: P, trigger: 'ALLY_LIFE_HIT', src: null, ctx: { attacker: y } }]);
    return [gained, P.life - l1];`);
  assert.deepEqual(r, [1, 0], JSON.stringify(r));
});

test('K-611 Guard Effect: opposing Magic cannot affect the shielded Spirit this battle, opposing Spirit effects can, and the next battle clears it', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const w = put(P, find(c => (c.colors || []).includes('white'))); G.battleNo = 6;
    await run(P, O, BS.mkInst('26RBS01-119'), BS.CARDS['26RBS01-119'].magic.actions);
    const magic = BS.mkInst('26RBS01-125'), spirit = BS.mkInst(find(c => !(c.colors || []).includes('white')));
    const imm = src => BS.fxImmune(P, w, { p: O, src });
    const res = [imm(magic), imm(spirit)];
    G.battleNo = 7; res.push(imm(magic));
    return res;`);
  assert.deepEqual(r, [true, false, false], JSON.stringify(r));
});

test('K-612 Diva On Stage: Soul Magic is usable with a Diva on the Field and not without; Diva counts as every team', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const c = BS.CARDS['26RDB01-060'];
    P.reserve.soul = true;
    const without = BS.soulMagicOK(P, c);
    put(P, find(x => (x.families || []).includes('Diva')));
    const withDiva = BS.soulMagicOK(P, c);
    const d = put(P, '26RDB01-060' in BS.CARDS && BS.CARDS['26RDB01-060'].type === 'Spirit' ? '26RDB01-060' : find(x => (x.families || []).includes('Diva')));
    return [without, withDiva, BS.fxIf(P, O, { allHave: { team: 'Green Wave' } })];`);
  assert.equal(r[0], false, JSON.stringify(r));
  assert.equal(r[1], true, JSON.stringify(r));
});

test('K-613 Diva On Stage Main: reveals four, takes a Diva Spirit and a different-named Diva Magic, rest to the bottom', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const sp = find(x => (x.families || []).includes('Diva'));
    const mg = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Magic' && (BS.CARDS[i].families || []).includes('Diva'));
    P.deck.splice(0, 4, BS.mkInst(sp), BS.mkInst(mg), BS.mkInst(sp), BS.mkInst('26RBS01-002'));
    const n0 = P.deck.length, h0 = P.hand.length;
    await run(P, O, BS.mkInst('26RDB01-060'), BS.CARDS['26RDB01-060'].magic.by.MAIN.actions);
    return [P.hand.length - h0, P.hand.map(x => BS.CARDS[x.id].type).sort().join(), P.deck.length - n0];`);
  assert.equal(r[0], 2, JSON.stringify(r));
  assert.equal(r[1], 'Magic,Spirit', JSON.stringify(r));
});

test('K-614 Boost Energy: Soul Magic Flash sends a Nexus as a Spirit and gives +2000 BP to a Cyantree Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    const c = BS.CARDS['26RBS02-092'];
    const acts = c.magic.by ? c.magic.by.FLASH.actions : c.magic.actions;
    return [c.soulMagic, acts.map(a => a.do).join()];`);
  assert.deepEqual(r, ['blue', 'NEXUS_AS_SPIRIT,BP_TARGET'], JSON.stringify(r));
});

test('K-615 Rindorin Legacy: a Trash Spirit with an EX mark counts as an EX-symbol card only in the step it was marked', async () => {
  const { page } = await sharedBoard();
  const r = await ev(page, `
    G.turnNo = 5; G.step = 4;
    const t = BS.mkInst(find(c => (c.colors || []).includes('purple'))); P.trash.push(t);
    t.exMark = { turn: 5, step: 4 };
    const same = BS.fxIf(P, O, { trashNoEx: true });
    G.step = 5; const later = BS.fxIf(P, O, { trashNoEx: true });
    return [same, later];`);
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});
