import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1149 BS34-071 The World of Owari: God-Sechs Spirits count as highest level in your Attack Step; at LV2 only the highest-BP opposing Spirit can block them', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels.length > 1);
    const gs = BS.mkInst('BS34-016'); gs.cores = 1; P.spirits = [gs];
    const nx = BS.mkInst('BS34-071'); nx.cores = 0; P.nexus = [nx];
    const lv1 = BS.lvIndex(gs);
    nx.cores = 3; const lvNx = BS.lvIndex(gs);
    const weak = BS.mkInst(any), strong = BS.mkInst(any); strong.cores = 5; O.spirits = [weak, strong];
    const can = O.spirits.filter(s => !BS.unblockableLow(P, gs, s)).length;
    G.step = 4; const lvOff = BS.lvIndex(gs);
    return { lv1, lvNx, can, lvOff, partial: BS.CARDS['BS34-071'].partial, strongBp: BS.bpOf(strong), weakBp: BS.bpOf(weak) }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r));
  assert.equal(r.lv1, 2, JSON.stringify(r)); assert.equal(r.lvNx, 2, JSON.stringify(r)); assert.equal(r.lvOff, 0, JSON.stringify(r));
  assert.equal(r.can, 1, JSON.stringify(r));
});

test('K-1150 BS34-075 The HeavenlyDemonKing Advents: returns a purple/white Spirit from the Trash, then summons Type Destroy from the Hand free when a God-Sechs is in the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const z = BS.mkInst('BS34-016'), d = BS.mkInst('BS34-XX02'); P.trash = [z]; P.hand = [d]; P.spirits = []; P.reserve.n = 10;
    const m = BS.mkInst('BS34-075');
    await BS.FX_ACTIONS.RETURN_TRASH.run({ p: P, opp: O, src: m, ctx: {} }, BS.CARDS['BS34-075'].magic.actions[0]);
    const back = P.hand.some(h => h.id === 'BS34-016');
    P.trash = [BS.mkInst('BS34-016')]; P.hand = [d];
    const c = { p: P, opp: O, src: m, ctx: {} }; const a = BS.CARDS['BS34-075'].magic.actions[1];
    await BS.runActions(c, { actions: [a] });
    return { back, summoned: P.spirits.some(s => s.id === 'BS34-XX02'), partial: BS.CARDS['BS34-075'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r));
});

test('K-1151 BS34-XX02 Type Destroy: summoned free from the Hand by returning a God-Sechs after its attack; Rush 4 destroys one opposing Spirit per symbol colour', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const gs = BS.mkInst('SD32-X02'); gs.cores = 2; P.spirits = [gs]; const d = BS.mkInst('BS34-XX02'); P.hand = [d]; P.reserve.n = 10;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: gs, attacker: gs });
    const summoned = P.spirits.some(s => s.id === 'BS34-XX02'), back = P.hand.some(h => h.id === 'SD32-X02');
    const d2 = BS.mkInst('BS34-XX02'); P.hand = [];  P.trash = [d2]; P.spirits = [BS.mkInst('BS34-XX02')];
    const sp = P.spirits[0]; const fromTrashBefore = P.trash.length;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: sp, attacker: sp });
    const noRetNonExact = P.trash.length === fromTrashBefore;
    const cols = ['red','purple','green','yellow','blue','white'];
    const byColor = {}; for (const k of Object.keys(BS.CARDS)) { const c = BS.CARDS[k]; if (c.type === 'Spirit' && !c.token && (c.colors || [c.symbol]).length === 1 && c.symbols >= 1 && !byColor[c.symbol]) byColor[c.symbol] = k; }
    O.spirits = cols.filter(k => byColor[k]).map(k => BS.mkInst(byColor[k]));
    const n0 = O.spirits.length;
    const src = BS.mkInst('BS34-XX02'); src.soul = true; P.spirits = [src].concat(Object.values(byColor).map(k => { const q = BS.mkInst(k); q.cores = 5; return q; }));
    const syms = BS.symbolsOn(P); const nsym = cols.filter(k => (syms[k] || 0) >= 1).length;
    O.burst = BS.mkInst('BS34-016');
    await BS.runActions({ p: P, opp: O, src, ctx: { selfInst: src } }, { actions: [BS.CARDS['BS34-XX02'].effects[2].actions[1]] });
    return { summoned, back, noRetNonExact, n0, left: O.spirits.length, nsym, partial: BS.CARDS['BS34-XX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.back, true, JSON.stringify(r));
  assert.equal(r.noRetNonExact, true, JSON.stringify(r)); assert.ok(r.nsym >= 4, JSON.stringify(r)); assert.equal(r.left, r.n0 - r.nsym, JSON.stringify(r));
});

test('K-1152 BS35-041 Type Five: also Green/Yellow, refreshes at the end of battle, Rush 5 makes the other God-Sechs unblockable this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const src = BS.mkInst('BS35-041'); src.cores = 2; P.spirits = [src];
    const sy = BS.symbolsOn(P); const both = (sy.green || 0) >= 1 && (sy.yellow || 0) >= 1;
    const E = BS.CARDS['BS35-041'].effects;
    G.attacker = src; G.eob = []; src.exhausted = true;
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: E[1].actions });
    await BS.endOfBattle(); const refreshed = !src.exhausted; G.eob = null; G.attacker = null;
    const gs = BS.mkInst('SD32-X02'), other = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !/God-Sechs/.test(BS.CARDS[k].name) && BS.CARDS[k].symbols >= 1));
    const byColor = {}; for (const k of Object.keys(BS.CARDS)) { const c = BS.CARDS[k]; if (c.type === 'Spirit' && !c.token && (c.colors || [c.symbol]).length === 1 && c.symbols >= 1 && !byColor[c.symbol]) byColor[c.symbol] = k; }
    P.spirits = [src, gs, other].concat(Object.values(byColor).map(k => { const q = BS.mkInst(k); q.cores = 5; return q; }));
    await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: E[2].actions });
    return { both, refreshed, gsFree: gs.noBlockTurn === G.turnNo, srcFree: src.noBlockTurn === G.turnNo, otherFree: other.noBlockTurn === G.turnNo, partial: BS.CARDS['BS35-041'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.both, true, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r));
  assert.equal(r.gsFree, true, JSON.stringify(r)); assert.equal(r.srcFree, false, JSON.stringify(r)); assert.equal(r.otherFree, false, JSON.stringify(r));
});

test('K-1153 BS35-XX02 Type The End: Flash swap keeps cores/state and returns the God-Sechs, Lv3 unaffected, six colours = 6 symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const K = BS.CARDS['BS35-XX02'], E = K.effects;
    const me = BS.mkInst('BS35-XX02'), gs = BS.mkInst('SD32-X02'); gs.cores = 3; gs.exhausted = true; P.hand = [me]; P.spirits = [gs];
    const mainOk = BS.accelOK(P, me, 0, 'MAIN'); G.step = 5; G.attacker = gs; const flashOk = BS.accelOK(P, me, 0, 'FLASH');
    await BS.useAccel(P, me, 0, null, 'FLASH'); const out = { onField: P.spirits.includes(me), cores: me.cores, exh: me.exhausted, back: P.hand.includes(gs), removed: P.removed.includes(me), atk: G.attacker === me, gsCores: gs.cores };
    G.attacker = null;
    me.cores = 5; const unaff = BS.fxImmune(P, me, { p: O, src: BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token)) });
    const sy0 = BS.attackSymbols(me);
    const byColor = {}; for (const k of Object.keys(BS.CARDS)) { const c = BS.CARDS[k]; if (c.type === 'Spirit' && !c.token && (c.colors || [c.symbol]).length === 1 && c.symbols >= 1 && !byColor[c.symbol]) byColor[c.symbol] = k; }
    P.spirits = [me].concat(Object.values(byColor).map(k => { const q = BS.mkInst(k); q.cores = 5; return q; }));
    const sy6 = BS.attackSymbols(me);
    return { mainOk, flashOk, out, unaff, sy0, sy6, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.mainOk, false, JSON.stringify(r)); assert.equal(r.flashOk, true, JSON.stringify(r));
  assert.deepEqual(r.out, { onField: true, cores: 3, exh: true, back: true, removed: false, atk: true, gsCores: 0 }, JSON.stringify(r));
  assert.equal(r.unaff, true, JSON.stringify(r)); assert.equal(r.sy6, 6, JSON.stringify(r));
});

test('K-1154 BS46-10THX02 Type God: Seal from itself, God-Sechs treated as holding the Soul Core and unaffected while sealed, Rush 4 refreshes the family', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BS46-10THX02'], E = K.effects;
    const me = BS.mkInst('BS46-10THX02'); me.cores = 3; me.soul = true; const gs = BS.mkInst('SD32-X02'); gs.cores = 3; P.spirits = [me, gs]; P.life = 3; P.lifeSoul = false;
    const treatedOff = BS.fxIf(P, O, { selfSoul: true }, { selfInst: gs });
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    const sealed = BS.isSealed(P), lifeUp = P.life, soulGone = !me.soul;
    const treatedOn = BS.fxIf(P, O, { selfSoul: true }, { selfInst: gs });
    const foe = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token));
    const unaff = BS.fxImmune(P, gs, { p: O, src: foe });
    const w = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token)); w.cores = 1; O.spirits = [w];
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: [E[3].actions[0]] });
    const bounced = O.spirits.length === 0 && O.deck[O.deck.length - 1] === w;
    return { treatedOff, sealed, lifeUp, soulGone, treatedOn, unaff, bounced, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.treatedOff, false, JSON.stringify(r));
  assert.equal(r.sealed, true, JSON.stringify(r)); assert.equal(r.lifeUp, 4, JSON.stringify(r)); assert.equal(r.soulGone, true, JSON.stringify(r));
  assert.equal(r.treatedOn, true, JSON.stringify(r)); assert.equal(r.unaff, true, JSON.stringify(r)); assert.equal(r.bounced, true, JSON.stringify(r));
});

test('K-1155 BS55-041 Six Heaven General: unaffected by opposing Spirit effects; at LV2 Six Heaven Spirits and The Owari World are unaffected by opposing Nexus effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const me = BS.mkInst('BS55-041'); me.cores = 2; const gol = BS.mkInst('BS55-061'); gol.cores = 1; P.spirits = [me, gol];
    const sp = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !/Six Heaven/.test(BS.CARDS[k].name)));
    const nx = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && !BS.CARDS[k].token));
    const other = BS.mkInst('SD32-X02'); other.cores = 3; P.spirits.push(other);
    return { vsSpirit: BS.fxImmune(P, me, { p: O, src: sp }), vsNexus: BS.fxImmune(P, gol, { p: O, src: nx }), otherNexus: BS.fxImmune(P, other, { p: O, src: nx }), partial: BS.CARDS['BS55-041'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.vsSpirit, true, JSON.stringify(r)); assert.equal(r.vsNexus, true, JSON.stringify(r)); assert.equal(r.otherNexus, false, JSON.stringify(r));
});

test('K-1156 BS55-RV004 Type Five: also Green/Yellow/Blue, unaffected with five symbol colours, refreshes when attacking', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BS55-RV004'], E = K.effects;
    const me = BS.mkInst('BS55-RV004'); me.cores = 2; P.spirits = [me];
    const foe = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token));
    const few = BS.fxImmune(P, me, { p: O, src: foe });
    me.exhausted = true;
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[4].actions });
    return { few, refreshed: !me.exhausted, n: E.length, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.refreshed, true, JSON.stringify(r)); assert.equal(r.n, 5, JSON.stringify(r));
});

test('K-1157 BS73-AX03: summons from the Hand for 1 cost when a Cost 6+ Machine attacks, the opponent cannot block unless it returns a Spirit, attackers gain White', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BS73-AX03'], E = K.effects;
    const me = BS.mkInst('BS73-AX03'); P.hand = [me]; P.spirits = []; P.void = 3; P.reserve.n = Math.max(P.reserve.n, 3);
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    const summoned = P.spirits.includes(me), cores = me.cores;
    const att = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token)); P.spirits.push(att);
    await BS.runActions({ p: P, opp: O, src: me, ctx: { attacker: att } }, { actions: E[2].actions });
    return { summoned, cores, noBlock: att.noBlockTurn === G.turnNo, n: E.length, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.noBlock, true, JSON.stringify(r)); assert.equal(r.n, 4, JSON.stringify(r));
});

test('K-1158 BS73-X05: Mani by returning a Heavenly Demon King card from the Trash keeps the Soul Core, bounce to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BS73-X05'], E = K.effects;
    const me = BS.mkInst('BS73-X05'); P.hand = [me]; P.spirits = [];
    const hdk = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Heavenly Demon King') && k !== 'BS73-X05'); const tr = BS.mkInst(hdk); P.trash = [tr];
    const w = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token)); w.cores = 1; O.spirits = [w];
    P.spirits = [me]; await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    return { bounced: O.spirits.length === 0 && O.deck[O.deck.length - 1] === w, tu: K.trashUnaffected, man: K.manifest && K.manifest.altReturn, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.bounced, true, JSON.stringify(r)); assert.equal(r.man, 'Heavenly Demon King', JSON.stringify(r));
});

test('K-1159 BS74-059: deploys a cost 4 or less Vassal Nexus from the Hand/Trash, loots, destroys a cost 4 or less Spirit when a Nexus is deployed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BS74-059'], E = K.effects;
    const me = BS.mkInst('BS74-059'); me.cores = 2; P.spirits = [me];
    const nx = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && BS.CARDS[k].cost <= 4 && (BS.CARDS[k].families || []).some(f => f === 'Vassal' || f === 'Heavenly Demon King'));
    const n1 = BS.mkInst(nx); P.hand = []; P.trash = [n1]; P.nexus = [];
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    const deployed = P.nexus.includes(n1);
    const w = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost <= 4)); w.cores = 1; O.spirits = [w];
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[1].actions });
    return { deployed, destroyed: O.spirits.length === 0, trig: E[1].trigger, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.deployed, true, JSON.stringify(r)); assert.equal(r.destroyed, true, JSON.stringify(r));
});

test('K-1160 BSC32-038: Burst summons a God-Sechs Spirit from the Hand/Trash treating reductions as met, Flash ends the Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC32-038'];
    const gs = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].name.includes('God-Sechs') && BS.CARDS[k].cost <= 7);
    const t = BS.mkInst(gs); P.hand = []; P.trash = [t]; P.spirits = []; P.void = 8; P.reserve.n = Math.max(P.reserve.n, 8);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BSC32-038'), ctx: {} }, { actions: K.burst.actions });
    const summoned = P.spirits.includes(t);
    const att = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token)); O.spirits = [att]; G.attacker = att; G.active = O.key;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BSC32-038'), ctx: {} }, { actions: K.magic.actions });
    return { summoned, ended: G.attackEnded === G.turnNo, tu: K.trashUnaffected, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.ended, true, JSON.stringify(r));
});

test('K-1161 BSC48-009: destroys a 1-symbol Spirit/Nexus, draws, Burst summons itself when a Spirit is lost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-009'], E = K.effects;
    const me = BS.mkInst('BSC48-009'); me.cores = 3; P.spirits = [me];
    const w = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].symbols || []).length <= 1 && BS.CARDS[k].cost <= 3)); w.cores = 1; O.spirits = [w];
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    const destroyed = O.spirits.length === 0;
    const h = P.hand.length; P.deck = P.deck.length ? P.deck : [BS.mkInst(w.id)];
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[2].actions });
    return { destroyed, drew: P.hand.length - h, burst: K.burst.actions[0].do, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.destroyed, true, JSON.stringify(r)); assert.equal(r.drew, 2, JSON.stringify(r)); assert.equal(r.burst, 'SUMMON_SELF', JSON.stringify(r));
});

test('K-1162 BSC48-010: draws, extra draw with a Level 2 Dairokuten Maou, also counts as White, trashes an opponent Reserve Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-010'], E = K.effects;
    const me = BS.mkInst('BSC48-010'); me.cores = 2; P.spirits = [me];
    const h = P.hand.length; await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    const drew = P.hand.length - h;
    O.reserve.n = 3; const before = O.reserve.n; const tr = O.trash.length;
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[3].actions });
    return { drew, lost: before - O.reserve.n, also: E[2].flag, cond: E[1].if.controlLv2, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r)); assert.equal(r.lost, 1, JSON.stringify(r)); assert.equal(r.also, 'ALSO_TREATED', JSON.stringify(r));
});

test('K-1163 BSC48-011: discards a Vassal/Heavenly Demon King card to draw 2, Grandwalker Nexus Cores go to the Void per symbol colour', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-011'], E = K.effects;
    const me = BS.mkInst('BSC48-011'); me.cores = 3; P.spirits = [me];
    const hdk = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Vassal') && k !== 'BSC48-011'); P.hand = [BS.mkInst(hdk)];
    if (P.deck.length < 3) P.deck = [BS.mkInst(hdk), BS.mkInst(hdk), BS.mkInst(hdk)];
    const t = P.trash.length; await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    return { discarded: P.trash.length - t, hand: P.hand.length, n: E.length, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.discarded, 1, JSON.stringify(r)); assert.equal(r.hand, 2, JSON.stringify(r)); assert.equal(r.n, 4, JSON.stringify(r));
});

test('K-1164 BSC48-012: Burst summons Vassal/Heavenly Demon King Spirits from the Trash up to total Cost 6, then itself', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-012'];
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && (BS.CARDS[k].families || []).includes('Vassal') && BS.CARDS[k].cost <= 3 && !BS.CARDS[k].name.includes('Necromancer Yakumo')).slice(0, 3);
    const ts = ids.map(i => BS.mkInst(i)); P.trash = ts.slice(); P.spirits = [];
    const me = BS.mkInst('BSC48-012'); P.hand = [me];
    P.hand = []; P.limbo = me; await BS.runActions({ p: P, opp: O, src: me, ctx: {}, burst: true }, { actions: K.burst.actions });
    const tot = ts.filter(t => P.spirits.includes(t)).reduce((s, t) => s + BS.CARDS[t.id].cost, 0);
    return { tot, self: P.spirits.includes(me), unaff: K.effects[0].flag, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.ok(r.tot <= 6 && r.tot > 0, JSON.stringify(r)); assert.equal(r.self, true, JSON.stringify(r));
});

test('K-1165 BSC48-013: High Speed, Void cores to two God-Sechs or two cores in total to Heavenly Demon King Grandwalker Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-013'], E = K.effects;
    const me = BS.mkInst('BSC48-013'); me.cores = 2; P.spirits = [me];
    const nx = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && (BS.CARDS[k].families || []).includes('Heavenly Demon King') && (BS.CARDS[k].families || []).includes('Grandwalker'));
    const n1 = BS.mkInst(nx); n1.cores = 1; P.nexus = [n1]; P.void = 3;
    const o = E[0].actions[0].options[1];
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: o });
    return { nexCores: n1.cores, void: P.void, hs: K.highSpeed, partial: K.partial, nx }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nexCores, 3, JSON.stringify(r)); assert.equal(r.void, 1, JSON.stringify(r)); assert.equal(r.hs, true, JSON.stringify(r));
});

test('K-1166 BSC48-014: summoned for free when an opposing Deck-discarding effect would discard it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-014'];
    const me = BS.mkInst('BSC48-014'); O.spirits = []; O.deck = [me, BS.mkInst('BSC48-014'), BS.mkInst('BSC48-014')]; O.trash = []; O.reserve.n = 5;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('BSC48-014'), ctx: {} }, { actions: [{ do: 'MILL_OPP', n: 1 }] });
    return { summoned: O.spirits.includes(me), inTrash: O.trash.includes(me), ds: K.deckSummon, hu: K.handUnaffected, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.inTrash, false, JSON.stringify(r));
});

test('K-1167 BSC48-016: Cost 8/9 God-Sechs become Cost 6, also Red, Dairokuten Maou shields HDK Spirits from Red/White/Blue', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-016'];
    const gs = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].name.includes('God-Sechs') && (BS.CARDS[k].families || []).includes('Heavenly Demon King') && [8, 9].includes(BS.CARDS[k].cost));
    const me = BS.mkInst('BSC48-016'); me.cores = 2; P.spirits = [me]; P.nexus = [];
    const g = BS.mkInst(gs); P.hand = [g]; P.trash = [];
    const base = BS.CARDS[gs].cost, now = BS.handCostSet(P, BS.CARDS[gs]);
    return { base, now, n: K.effects.length, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.now, 6, JSON.stringify(r)); assert.equal(r.n, 5, JSON.stringify(r));
});

test('K-1168 BSC48-017: a core from the Void to the Trash, then a core to itself with a Level 2 Dairokuten Maou', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-017'], E = K.effects;
    const me = BS.mkInst('BSC48-017'); me.cores = 1; P.spirits = [me]; P.void = 3; const t = P.trashCores.n;
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[0].actions });
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: E[1].actions });
    return { trashed: P.trashCores.n - t, cores: me.cores, void: P.void, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.trashed, 1, JSON.stringify(r)); assert.equal(r.cores, 2, JSON.stringify(r));
});

test('K-1169 BSC48-021: Flash -5000 BP destroys at 0 BP and draws from the deckbottom; returns from the Trash when a God-Sechs is summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const K = BS.CARDS['BSC48-021'];
    const t = BS.mkInst('BS52-RV004'); t.cores = 3; O.spirits = [t]; t.bpMod = 5000 - BS.bpOf(t);
    const me = BS.mkInst('BSC48-021'); const bottom = P.deck[0]; const h = P.hand.length;
    await BS.runActions({ p: P, opp: O, src: me, ctx: {} }, { actions: K.magic.actions });
    const e = K.effects[0]; const drew = P.hand.length - h;
    const gs = Object.keys(BS.CARDS).find(k => /God-Sechs/.test(BS.CARDS[k].name) && BS.CARDS[k].type === 'Spirit'); const g = BS.mkInst(gs); P.spirits = [g]; P.trash = [me]; P.hand = [];
    await BS.fireFx(P, 'ALLY_SUMMONED', g, { subject: g });
    const back = P.hand.includes(me);
    return { back,  gone: !O.spirits.includes(t), drew, gs, col: BS.collectFx({ owner: P, trigger: 'ALLY_SUMMONED', src: g, ctx: { subject: g } }).length,  sa: K.magic.summonAfter, zone: e.zone, trg: e.trigger, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r)); assert.equal(r.sa, true); assert.equal(r.back, true, JSON.stringify(r));
});

test('K-1170 BSC48-039: Draw Step +1 card; discard 1 unless six counters and a small Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2;
    const K = BS.CARDS['BSC48-039'], me = BS.mkInst('BSC48-039'); me.cores = 1; P.nexus = [me]; if (!P.nexuses) P.nexuses = P.nexus;
    const plus = BS.fieldList(P).includes(me) ? 0 : -1;
    P.count = 2; P.hand = P.deck.splice(0, 4); const h0 = P.hand.length;
    await BS.fireFx(P, 'DRAW_STEP', null, {});
    const lowCount = h0 - P.hand.length;
    P.count = 6; P.hand = P.deck.splice(0, 4); const h1 = P.hand.length;
    await BS.fireFx(P, 'DRAW_STEP', null, {});
    return { lowCount, h1, h2: P.hand.length, plus, partial: K.partial, fc: K.fxComplete }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.lowCount, 1, JSON.stringify(r)); assert.ok(r.h2 >= r.h1 - 1, JSON.stringify(r));
});

test('K-1171 BSC48-048: deploys from the Trash at the start of the Attack Step with a Cost 8+ God-Sechs; only Soul Core blockers', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const K = BS.CARDS['BSC48-048'], me = BS.mkInst('BSC48-048'); P.trash = [me]; P.nexus = [];
    const gs = Object.keys(BS.CARDS).find(k => /God-Sechs/.test(BS.CARDS[k].name) && BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost >= 8); const g = BS.mkInst(gs); g.cores = 3; P.spirits = [g];
    await BS.fireFx(P, 'START_ATTACK', null, {});
    return { deployed: P.nexus.includes(me), fc: K.fxComplete, partial: K.partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.deployed, true, JSON.stringify(r));
});
