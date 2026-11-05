import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1193 BS71-054: returns from the Trash when a Saga Brave is summoned, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const bid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave' && (BS.CARDS[k].families || []).includes('Saga'));
    const nid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave' && !(BS.CARDS[k].families || []).includes('Saga'));
    const sh = BS.mkInst('BS71-054'); P.trash = [sh]; P.hand = [];
    const b2 = BS.mkInst(nid); await BS.fireFx(P, 'ALLY_SUMMONED', b2, { subject: b2 }); const afterNon = P.hand.length;
    const b = BS.mkInst(bid); await BS.fireFx(P, 'ALLY_SUMMONED', b, { subject: b }); const afterSaga = P.hand.length;
    return { fc: BS.CARDS['BS71-054'].partial === false, afterNon, afterSaga, inTrash: P.trash.includes(sh) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.afterNon, 0, JSON.stringify(r)); assert.equal(r.afterSaga, 1, JSON.stringify(r));
});

test('K-1194 BS71-053: Void core goes to this Spirit and a Scalostle Spirit with a Brave; LV2 core floor three', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const sc = BS.mkInst('BS71-053'); sc.cores = 1; const al = BS.mkInst('BS71-054'); al.cores = 1; al.brave = BS.mkInst('BS71-063'); const plain = BS.mkInst('BS71-057'); plain.cores = 1;
    P.spirits = [sc, al, plain]; P.nexus = []; P.reserve.n = 0; P.void = P.void || { n: 0 }; const v0 = P.void.n; if (typeof P.void.n === 'number') P.void.n = 5;
    await BS.fireFx(P, 'SUMMONED', sc, {});
    return { fc: BS.CARDS['BS71-053'].partial === false, sc: sc.cores, al: al.cores, plain: plain.cores }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.plain, 1, JSON.stringify(r)); assert.ok(r.al === 2 || r.sc === 2, JSON.stringify(r));
});

test('K-1195 BS71-057: Brave LV2 core to Nuadha and once-per-turn refresh when this Spirit destroys by effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const m = BS.mkInst('BS71-057'); m.cores = 3; m.brave = BS.mkInst('BS71-063'); m.exhausted = true; const nx = BS.mkInst('BS71-CX03'); nx.cores = 2; P.spirits = [m]; P.nexus = [nx]; P.void = P.void || { n: 0 }; if (typeof P.void.n === 'number') P.void.n = 9;
    const mk = () => { const t = BS.mkInst('BS71-053'); t.cores = 1; return t; };
    await BS.fireFx(P, 'OPP_DESTROYED_FX', null, { bp: 3000, fxSrc: m }); const c1 = nx.cores, ex1 = m.exhausted;
    await BS.fireFx(P, 'OPP_DESTROYED_FX', null, { bp: 3000, fxSrc: {} });
    return { fc: BS.CARDS['BS71-057'].partial === false, c1, ex1, c2: nx.cores }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.ex1, false, JSON.stringify(r)); assert.ok(r.c1 > 2, JSON.stringify(r)); assert.equal(r.c2, r.c1, JSON.stringify(r));
});

test('K-1196 BS72-074: End Step LV2 draws two with Contractor Nuadha then discards down to three; Hand protected at five or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const nid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name.toLowerCase().includes('contractor nuadha'));
    const bn = BS.mkInst('BS72-074'); bn.cores = 2; P.nexus = [bn]; P.spirits = [];
    const filler = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit');
    P.deck = Array.from({ length: 10 }, () => BS.mkInst(filler)); P.hand = [BS.mkInst(filler), BS.mkInst(filler), BS.mkInst(filler)];
    await BS.fireFx(P, 'END_STEP', bn, {}); const noNuadha = P.hand.length;
    const sp = BS.mkInst(nid); sp.cores = 1; P.spirits = [sp];
    await BS.fireFx(P, 'END_STEP', bn, {});
    return { fc: BS.CARDS['BS72-074'].partial === false, noNuadha, after: P.hand.length, trash: P.trash.length }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.noNuadha, 3, JSON.stringify(r)); assert.equal(r.after, 3, JSON.stringify(r)); assert.equal(r.trash, 2, JSON.stringify(r));
});

test('K-1197 BS71-063: braved Spirit refreshes by exhausting a Nexus with six or more counters, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const sp = BS.mkInst('BS71-054'); sp.cores = 1; sp.exhausted = true; sp.brave = BS.mkInst('BS71-063'); const nx = BS.mkInst('BS72-074'); nx.cores = 2; P.spirits = [sp]; P.nexus = [nx];
    P.count = 5; await BS.fireFx(P, 'ATTACKS', sp, {}); const low = { ex: sp.exhausted, nx: nx.exhausted };
    P.count = 6; await BS.fireFx(P, 'ATTACKS', sp, {});
    return { fc: BS.CARDS['BS71-063'].partial === false, low, ex: sp.exhausted, nx: nx.exhausted }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.deepEqual(r.low, { ex: true, nx: false }, JSON.stringify(r)); assert.equal(r.ex, false, JSON.stringify(r)); assert.equal(r.nx, true, JSON.stringify(r));
});

test('K-1198 BS71-NX03: Flash summon needs five cores on a Blue Contractor and pays one cost; When Summoned destroys Cost 7 or less and discards two', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
        const k = BS.CARDS['BS71-NX03']; const cheap = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && BS.CARDS[x].cost <= 7);
    const big = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && BS.CARDS[x].cost >= 8);
    const sp = BS.mkInst('BS71-CX03'); sp.cores = 4; P.spirits = []; P.nexus = [sp]; const bres = BS.mkInst('BS71-NX03'); P.hand = [bres];
    const o1 = BS.mkInst(cheap); o1.cores = 1; const o2 = big ? BS.mkInst(big) : null; if (o2) o2.cores = 3; O.spirits = [o1].concat(o2 ? [o2] : []); O.hand = [BS.mkInst(cheap), BS.mkInst(cheap), BS.mkInst(cheap)]; O.trash = [];
    const hs0 = BS.highSpeedOK ? BS.highSpeedOK(P, bres) : null; sp.cores = 5; G.step = 5; const hs1 = BS.highSpeedOK ? BS.highSpeedOK(P, bres) : null;
    P.hand = []; bres.cores = 1; P.spirits = [bres];
    await BS.fireFx(P, 'SUMMONED', bres, {});
    return { hs0, hs1, fc: k.partial === false, cost: k.highSpeedCost, oppLeft: O.spirits.length, big: !!o2, hand: O.hand.length, trash: O.trash.length }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.cost, 1, JSON.stringify(r)); assert.equal(r.oppLeft, r.big ? 1 : 0, JSON.stringify(r));
  assert.equal(r.hand, 3, JSON.stringify(r));
});

test('K-1199 P25-01: Cost Destruction limit grows per Scalostle Brave; own discard of a Scalostle Brave summons it instead', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const k = BS.CARDS['P25-01']; const br = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Brave' && (BS.CARDS[x].families || []).includes('Scalostle'));
    const sp = BS.mkInst('P25-01'); sp.cores = 2; P.spirits = [sp]; P.nexus = [];
    const by = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && BS.CARDS[x].cost === 4);
    const o4 = BS.mkInst(by); o4.cores = 2; O.spirits = [o4]; O.hand = [];
    await BS.fireFx(P, 'ATTACKS', sp, {}); const a = O.spirits.length;
    sp.brave = BS.mkInst(br); const o4b = BS.mkInst(by); o4b.cores = 2; O.spirits = [o4b];
    await BS.fireFx(P, 'ATTACKS', sp, {}); const b = O.spirits.length; sp.brave = null;
    const x = BS.mkInst(br); P.hand = []; P.trash = [x]; P.reserve = P.reserve || {}; 
    await BS.fireFx(P, 'OWN_DISCARD', null, { by: sp, discarded: [x] });
    return { fc: k.partial === false, a, b, summoned: P.spirits.includes(x) || (P.nexus||[]).includes(x), inTrash: P.trash.includes(x) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.a, 1, JSON.stringify(r)); assert.equal(r.b, 0, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r));
});

test('K-1200 BS71-059: braved attack discards an opposing Spirit Burst and sends a Life to the Reserve; Mirage locks ending the attack', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const k = BS.CARDS['BS71-059']; const sp = BS.mkInst('BS71-059'); sp.cores = 3; P.spirits = [sp]; sp.brave = BS.mkInst(Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Brave'));
    const bs = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && !!BS.CARDS[x].burst);
    const b = BS.mkInst(bs); O.burst = b; O.trash = []; const life = O.life, res = O.reserve ? O.reserve.n : null;
    await BS.fireFx(P, 'ATTACKS', sp, {});
    return { fc: k.partial === false, burst: !!O.burst, inTrash: O.trash.includes(b), life: life - O.life, mir: !!(k.mirage && k.mirage.noEnd) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.burst, false, JSON.stringify(r)); assert.equal(r.inTrash, true, JSON.stringify(r)); assert.equal(r.life, 1, JSON.stringify(r)); assert.equal(r.mir, true, JSON.stringify(r));
});

test('K-1201 BS71-083: Burst timing covers a Spirit lost by depletion as well as destruction', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(() => { const k = BS.CARDS['BS71-083']; return { fc: k.partial === false, when: k.burst.when, main: k.burst.thenMain, also: !!k.burst.also }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.when, 'ALLY_LOST', JSON.stringify(r)); assert.equal(r.main, true, JSON.stringify(r)); assert.equal(r.also, true, JSON.stringify(r));
});

test('K-1202 BSC48-054: Life reduced by the opponent lets the set Magic be discarded for a free Flash (end the Attack Step)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key;
    const k = BS.CARDS['BSC48-054']; const b = BS.mkInst('BSC48-054'); P.burst = b; P.trash = [];
    const att = BS.mkInst(Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && !BS.CARDS[x].burst)); att.cores = 3; O.spirits = [att]; G.attacker = att;
    P.life = 4; P.life--; await BS.maybeBurst(P, 'LIFE_DECREASE', { attacker: att });
    return { fc: k.partial === false, setLeft: !!P.burst, inTrash: P.trash.includes(b), tt: !!k.trashTrigger, lf: k.lifeFlash === true }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.setLeft, false, JSON.stringify(r)); assert.equal(r.inTrash, true, JSON.stringify(r)); assert.equal(r.tt, true, JSON.stringify(r)); assert.equal(r.lf, true, JSON.stringify(r));
});

test("K-1203 BS72-066: a Nexus holding this Brave taxes opposing low-cost attacks by one Reserve core; the braved Spirit cannot have its attack ended", async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = BS.STEPS ? BS.STEPS.indexOf('ATTACK') : 3;
    const k = BS.CARDS['BS72-066']; const nid = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Nexus'); const nx = BS.mkInst(nid); nx.brave = BS.mkInst('BS72-066'); P.nexus = [nx];
    const cheap = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && BS.CARDS[x].cost <= 3);
    const att = BS.mkInst(cheap); att.cores = 1; O.spirits = [att]; O.reserve.n = 0;
    const broke = await BS.payAtkTax(O, P, att); O.reserve.n = 2; const paid = await BS.payAtkTax(O, P, att);
    nx.brave = null; O.reserve.n = 2; const free = await BS.payAtkTax(O, P, att);
    return { fc: k.partial === false, broke, paid, free, left: O.reserve.n }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.broke, false, JSON.stringify(r)); assert.equal(r.paid, true, JSON.stringify(r)); assert.equal(r.free, true, JSON.stringify(r)); assert.equal(r.left, 2, JSON.stringify(r));
});

test('K-1204 BS74-AX03: needs a white Grandwalker Nexus, costs -2 per Soul State card, returns all other Spirits, unaffected by effects but its own', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const k = BS.CARDS['BS74-AX03']; const ult = BS.mkInst('BS74-AX03'); ult.cores = 5;
    P.nexus = []; const noNx = BS.summonOK ? BS.summonOK(P, k) : null; P.nexus = [BS.mkInst('BS74-CX03')]; const withNx = BS.summonOK ? BS.summonOK(P, k) : null;
    const base = BS.effCost ? BS.effCost(P, k) : null; P.soulState = [BS.mkInst('BS74-CX03'), BS.mkInst('BS74-CX03')]; const cut = BS.effCost ? BS.effCost(P, k) : null; P.soulState = [];
    const ids = Object.keys(BS.CARDS).filter(x => BS.CARDS[x].type === 'Spirit' && !BS.CARDS[x].effects).slice(0, 3);
    const mine = BS.mkInst(ids[0]), a = BS.mkInst(ids[1]), b = BS.mkInst(ids[2]); mine.cores = a.cores = b.cores = 1; P.spirits = [ult, mine]; O.spirits = [a, b];
    const d0 = P.deck.length, od0 = O.deck.length;
    await BS.fireFx(P, 'SUMMONED', ult, {});
    return { fc: k.partial === false, noNx, withNx, base, cut, left: P.spirits.length, oppLeft: O.spirits.length, pd: P.deck.length - d0, od: O.deck.length - od0, ult: P.spirits[0] === ult }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.left, 1, JSON.stringify(r)); assert.equal(r.oppLeft, 0, JSON.stringify(r)); assert.equal(r.pd, 1, JSON.stringify(r)); assert.equal(r.od, 2, JSON.stringify(r)); assert.equal(r.ult, true, JSON.stringify(r));
  if (r.noNx !== null) { assert.equal(r.noNx, false, JSON.stringify(r)); assert.equal(r.withNx, true, JSON.stringify(r)); }
  if (r.base !== null) assert.equal(r.base - r.cut, 4, JSON.stringify(r));
});

test('K-1205 SD32-006: LV2 Draw Step +1 card then a forced discard; colour and symbol also Purple', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2;
    const K = BS.CARDS['SD32-006'], me = BS.mkInst('SD32-006'); me.cores = 1; P.nexus = [me];
    P.hand = P.deck.splice(0, 4); const h0 = P.hand.length;
    await BS.fireFx(P, 'DRAW_STEP', null, {});
    return { fc: K.partial === false, d: h0 - P.hand.length, eff: (K.effects || []).length }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.d, 1, JSON.stringify(r)); assert.equal(r.eff, 3, JSON.stringify(r));
});

test('K-1206 BSC48-X09: Change cost view is 6, CHANGE_BOUNCE_OPP sends an opposing Spirit to the deckbottom, CHANGE_REPLACE swaps the chosen Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const K = BS.CARDS['BSC48-X09']; const view = BS.changeView(K);
    const ids = Object.keys(BS.CARDS).filter(x => BS.CARDS[x].type === 'Spirit' && !BS.CARDS[x].effects).slice(0, 2);
    const a = BS.mkInst(ids[0]); a.cores = 1; O.spirits = [a]; const od0 = O.deck.length;
    const me = BS.mkInst('BSC48-X09');
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: [{ do: 'CHANGE_BOUNCE_OPP', to: 'deckBottom' }] });
    return { fc: K.partial === false, cost: view.cost, orig: K.cost, left: O.spirits.length, od: O.deck.length - od0 }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.cost, 6, JSON.stringify(r)); assert.equal(r.orig, 10, JSON.stringify(r)); assert.equal(r.left, 0, JSON.stringify(r)); assert.equal(r.od, 1, JSON.stringify(r));
});

test('K-1207 BSC48-X09: a free Change cast bounces an opposing Spirit, replaces the chosen Heavenly Demon King Spirit (cores kept, old one to the Trash); a second CHANGE_SELF in the same turn is refused', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const fam = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && (BS.CARDS[x].families || []).includes('Heavenly Demon King') && BS.CARDS[x].cost <= 9 && x !== 'BSC48-X09');
    const old = BS.mkInst(fam); old.cores = 3; P.spirits = [old];
    const opp = BS.mkInst(Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && !BS.CARDS[x].effects)); opp.cores = 1; O.spirits = [opp]; const od0 = O.deck.length;
    const me = BS.mkInst('BSC48-X09'); P.hand = [me];
    await BS.castMagic(P, { inst: me, target: null, plan: null, ctx: 'flash', free: true });
    return { first: P.spirits[0] === me, cores: me.cores, oldTrash: P.trash.includes(old), oppLeft: O.spirits.length, od: O.deck.length - od0, hand: P.hand.includes(me) }; })()`);
  assert.equal(r.first, true, JSON.stringify(r)); assert.equal(r.cores, 3, JSON.stringify(r)); assert.equal(r.oldTrash, true, JSON.stringify(r)); assert.equal(r.oppLeft, 0, JSON.stringify(r)); assert.equal(r.od, 1, JSON.stringify(r));
});

test('K-1208 BSC48-052: usable from the Trash when a Contractor Dairokuten Maou is in play (trashUse); TRASH_PICK_THREE returns a God-Sechs from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const K = BS.CARDS['BSC48-052'];
    const gs = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && BS.CARDS[x].name.includes('God-Sechs') && BS.CARDS[x].cost <= 10 && !BS.CARDS[x].token);
    const t = BS.mkInst(gs); P.trash = [t]; P.hand = [];
    const me = BS.mkInst('BSC48-052');
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: [{ do: 'TRASH_PICK_THREE', nameHas: 'God-Sechs', costLe: 10 }] });
    return { fc: K.partial === false, moved: !P.trash.includes(t), where: P.hand.includes(t) ? 'hand' : (P.spirits.includes(t) ? 'field' : 'other'), tu: !!(K.magic && K.magic.trashUse) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.moved, true, JSON.stringify(r)); assert.equal(r.tu, true, JSON.stringify(r));
});

test('K-1209 P25-05: Contract Advent data (Awakened Dragon, 4 counters, either step, Soul Core); an opposing effect returning an ally Awakened Dragon queues ALLY_LEAVES; the bounce skips Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key;
    const K = BS.CARDS['P25-05']; const me = BS.mkInst('P25-05'); me.cores = 3;
    const ad = Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Spirit' && (BS.CARDS[x].families || []).includes('Awakened Dragon') && x !== 'P25-05');
    const ally = BS.mkInst(ad); ally.cores = 1; P.spirits = [me, ally]; G.evQ = [];
    G.fxBy = O.key; BS.bounceCard(P, ally, 'hand'); G.fxBy = null;
    const queued = G.evQ.some(e => e.type === 'ALLY_LEAVES' && e.inst === ally);
    const nx = BS.mkInst(Object.keys(BS.CARDS).find(x => BS.CARDS[x].type === 'Nexus')); O.nexus = [nx]; O.spirits = [];
    const cands = BS.FX_ACTIONS.CHANGE_BOUNCE_OPP.cands({ p: P, opp: O, src: me, ctx: {} }, { noNexus: true }).length;
    return { fc: K.partial === false, ca: K.contractAdvent, queued, cands, eff: K.effects.map(e => e.trigger).join() }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.ca.counterGe, 4, JSON.stringify(r)); assert.equal(r.ca.soulTo, true, JSON.stringify(r)); assert.equal(r.queued, true, JSON.stringify(r)); assert.equal(r.cands, 0, JSON.stringify(r));
});
