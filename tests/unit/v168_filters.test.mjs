// v0.168.0 new engine pieces: condition symbolsOnGe, DESTROY costIn / blockingSelf, BOUNCE_OPP notAttacking,
// STATIC fightingOnly + noStack, RETURN_TRASH with any match shape, match.costIn (Cost 6/8).
// rules: ETR:battle.block@d20adf64, ETR:battle.destruction@698b8d5e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 10; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);
const find = (pred) => `(() => { const k = Object.keys(BS.CARDS).filter(id => { const c = BS.CARDS[id]; return c.type === 'Spirit' && ${pred}; }); return k; })()`;

test('V168-01 Nonril: +5000 BP while blocking with three White symbols, not with two', async () => {
  const r = await ev(`const n = sp('26RSD04-002', O, 3), a = sp('BS01-042', P, 1);
    const base = BS.bpOf(n); G.attacker = a; G.blocker = n; G.battleNo = 1;
    const two = BS.bpOf(n);
    for (let i = 0; i < 2; i++) sp('26RSD04-002', O, 1);
    const three = BS.bpOf(n);
    G.blocker = null; return [base, two, three, BS.bpOf(n)];`);
  assert.equal(r[0], r[1]);      // one White symbol on the Field: the condition is not met
  assert.equal(r[2] - r[1], 5000);      // three White symbols: +5000 while blocking
  assert.equal(r[3], r[0]);      // not blocking any more
});

test('V168-02 Dane-Grey: destroys an exhausted Cost 1/2 Spirit, not a Cost 3 one or a refreshed one', async () => {
  const r = await ev(`const d = sp('26RBS02-017', P, 3);
    const lowCost = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].cost === 2 && !BS.CARDS[id].effects);
    const hiCost = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].cost === 5 && !BS.CARDS[id].effects);
    const a = sp(lowCost, O, 1), b = sp(hiCost, O, 1), c = sp(lowCost, O, 1);
    a.exhausted = true; b.exhausted = true;
    BS.removeSpirit(P, d, 'destroyed', true); await BS.flushBursts();
    return [O.spirits.includes(a), O.spirits.includes(b), O.spirits.includes(c)];`);
  assert.deepEqual(r, [false, true, true]);
});

test('V168-03 Lassrea: returns a non-attacking opposing Spirit (2000 BP or less) to the deckbottom, never the attacker', async () => {
  const r = await ev(`const l = sp('26RBS02-038', P, 1);
    const weak = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].levels[0].bp <= 2000 && !BS.CARDS[id].effects);
    const att = sp(weak, O, 1), idle = sp(weak, O, 1);
    G.attacker = att; G.blocker = l; G.battleNo = 1;
    await BS.fireFx(P, 'BLOCKS', l);
    return [O.spirits.includes(att), O.spirits.includes(idle)];`);
  assert.deepEqual(r, [true, false]);
});

test('V168-04 Nidree: destroys the Spirit that blocked it, not another opposing Spirit', async () => {
  const r = await ev(`const nid = sp('26RBS03-009', P, 3);
    const cheap = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].cost <= 4 && !BS.CARDS[id].effects);
    const blk = sp(cheap, O, 1), other = sp(cheap, O, 1);
    G.attacker = nid; G.blocker = blk; G.battleNo = 1;
    BS.removeSpirit(P, nid, 'destroyed', true); await BS.flushBursts();
    const first = [O.spirits.includes(blk), O.spirits.includes(other)];
    const nid2 = sp('26RBS03-009', P, 3); G.attacker = nid2; G.blocker = null; BS.removeSpirit(P, nid2, 'destroyed', true); await BS.flushBursts();
    return [first, O.spirits.includes(other)];`);
  assert.deepEqual(r, [[false, true], true]);      // the blocker is destroyed; with no blocker nothing else is
});

test('V168-05 Genm Action Gamer Lv0: +2000 BP for attacking/blocking Level Up Spirits only, and two copies do not stack', async () => {
  const r = await ev(`const lu = '26RCB01-039';      // Kamen Rider Snipe Shoot: has Level Up
    const gen = sp('26RCB01-042', P, 1), a = sp(lu, P, 1), idleLu = sp(lu, P, 1);
    const b0 = BS.bpOf(a), i0 = BS.bpOf(idleLu);
    G.step = 5; G.attacker = a; G.battleNo = 1;
    const b1 = BS.bpOf(a), i1 = BS.bpOf(idleLu);
    sp('26RCB01-042', P, 1);
    const b2 = BS.bpOf(a);
    return [b1 - b0, i1 - i0, b2 - b0];`);
  assert.deepEqual(r, [2000, 0, 2000]);
});

test('V168-06 Kukulakatol / Rostache / Floating Stone: a matching Spirit card returns from the Trash, a non-matching one stays', async () => {
  const r = await ev(`const clash = '26RBS02-006', plain = 'TRAIN-02';      // The Shackler Chainel has Clash
    const k = sp('26RBS01-004', P, 1);
    P.trash.push(BS.mkInst(plain), BS.mkInst(clash));
    await BS.fireFx(P, 'SUMMONED', k);
    const hand = P.hand.map(x => x.id);
    const spirits = Object.keys(BS.CARDS).filter(id => BS.CARDS[id] && BS.CARDS[id].type === 'Spirit' && BS.CARDS[id].cost <= 5);
    const red = spirits.find(id => BS.CARDS[id].symbol === 'red'), blue = spirits.find(id => BS.CARDS[id].symbol === 'blue');
    P.hand = []; P.trash = [BS.mkInst(blue)]; const rs = sp('26RBS01-014', P, 1); await BS.fireFx(P, 'SUMMONED', rs); const none = P.hand.length;
    P.trash = [BS.mkInst(blue), BS.mkInst(red)]; await BS.fireFx(P, 'SUMMONED', rs);
    return [hand, clash, P.hand.map(x => x.id), red, none];`);
  assert.deepEqual(r[0], [r[1]]);
  assert.equal(r[4], 0);
  assert.deepEqual(r[2], [r[3]]);
});

test('V168-07 Plasmaru: refreshes only an exhausted Cost 6/8 "Topaz" Spirit', async () => {
  const r = await ev(`const pl = sp('26RBS03-053', P, 1);
    const topaz = Object.keys(BS.CARDS).filter(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].families || []).includes('Topaz'));
    const c6 = topaz.find(id => BS.CARDS[id].cost === 6), c3 = topaz.find(id => BS.CARDS[id].cost <= 4);
    if (!c6 || !c3) return null;
    const a = sp(c6, P, 1), b = sp(c3, P, 1); a.exhausted = true; b.exhausted = true;
    await BS.fireFx(P, 'SUMMONED', pl);
    return [a.exhausted, b.exhausted];`);
  assert.deepEqual(r, [false, true]);
});

test('V168-08 Baron Ringo Arms: draws only with another "GAIM" family Spirit on the Field', async () => {
  const r = await ev(`const b = sp('26RCB01-016', P, 3);
    for (let i = 0; i < 3; i++) P.deck.push(BS.mkInst('BS75-004'));
    const gaim = Object.keys(BS.CARDS).find(id => BS.CARDS[id].type === 'Spirit' && (BS.CARDS[id].families || []).includes('GAIM') && id !== '26RCB01-016');
    P.hand = []; await BS.fireFx(P, 'BATTLE_WIN', b, { attacking: true }); const alone = P.hand.length;
    sp(gaim, P, 1); await BS.fireFx(P, 'BATTLE_WIN', b, { attacking: true });
    return [alone, P.hand.length];`);
  assert.deepEqual(r, [0, 1]);
});
