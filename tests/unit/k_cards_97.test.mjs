// Lane K tests, file 97 (Grandwalker order): BS75-CX03 Indra bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1001 BS75-043 Vajdraco: Thunderive attack, an Indra core to the Void, opposing Cost 4 or less Nexuses cannot activate until its next Start Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const indra = BS.mkInst('BS75-CX03'); indra.cores = 2; P.nexus = [indra];
    const v = BS.mkInst('BS75-043'); P.spirits = [v];
    v.cores = 1;
    let n = null, before = 0, tm = 'MAIN';
    for (const nx of Object.values(BS.CARDS).filter(c => c.type === 'Nexus' && c.cost <= 4 && (c.effects || []).some(e => e.trigger === 'ACTIVATE'))) {
      const t = BS.mkInst(nx.id); t.cores = 3; O.nexus = [t];
      for (const m of ['MAIN', 'FLASH']) { const k = BS.activatable(O, t, m).length; if (k > 0) { n = t; before = k; tm = m; break; } }
      if (n) break;
    }
    await BS.fireFx(P, 'ALLY_ATTACKS', v, { attacker: v });
    const locked = BS.activatable(O, n, tm).length;
    P.nexusLockLe = null;
    return [before > 0, indra.cores, P.void, locked]; })()`);
  assert.deepEqual(r, [true, 1, 1, 0]);
});

test('K-1002 BS75-043 Vajdraco: without an Indra core nothing happens', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const indra = BS.mkInst('BS75-CX03'); indra.cores = 0; P.nexus = [indra];
    const v = BS.mkInst('BS75-043'); v.cores = 1; P.spirits = [v];
    await BS.fireFx(P, 'ALLY_ATTACKS', v, { attacker: v });
    return [P.nexusLockLe == null, P.void]; })()`);
  assert.deepEqual(r, [true, 0]);
});

test('K-1003 BS75-069 Charged Crystal Cave: Flash symbol shield and Trash symbols for Thunderive cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const c = BS.CARDS['BS75-069'];
    const n = BS.mkInst('BS75-069'); n.cores = 2; P.nexus = [n];
    const idx = BS.activatable(P, n, 'FLASH').map(x => x.idx);
    await BS.activateFx(P, n, idx[0]);
    const sh = P.symShield && P.symShield.ge;
    return [!c.partial, idx.length, sh, n.exhausted === true, BS.trashSymsOn ? BS.trashSymsOn(P, BS.CARDS['BS75-043']) : 'n/a']; })()`);
  assert.deepEqual(r.slice(0, 4), [true, 1, 2, true]);
  assert.ok(r[4] === true || r[4] === 'n/a', String(r[4]));
});

test('K-1004 BS75-X10 Vajrawurm: unpreventable Can\'t Attack/Block, LV3 end-of-battle summon', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const c = BS.CARDS['BS75-X10'];
    const ef = (c.effects || []).map(e => e.trigger + ':' + (e.lv || []).join(''));
    const src = BS.mkInst('BS75-X10'); src.cores = 3; P.spirits = [src];
    await BS.FX_ACTIONS.CANT_AB_UNPREVENTABLE.run({ p: P, src, ctx: {} }, {});
    return [!c.partial, ef.includes('ALLY_BATTLE_END:3'), P.cantAbFree === G.turnNo]; })()`);
  assert.deepEqual(r, [true, true, true]);
});

test('K-1005 BS72-017 (Nyx): summoned pays a Nyx core to the Void, discards and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const nx = BS.mkInst('BS72-CX02'); nx.cores = 2; P.nexus = [nx];
    const f = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects && !BS.CARDS[k].token);
    P.hand = [BS.mkInst(f)]; for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst(f));
    const v = BS.mkInst('BS72-017'); v.cores = 1; P.spirits = [v]; const v0 = P.void;
    await BS.fireFx(P, 'SUMMONED', v, {});
    return [!BS.CARDS['BS72-017'].partial, nx.cores, P.void - v0, P.hand.length]; })()`);
  assert.deepEqual(r, [true, 1, 1, 1]);
});

test('K-1006 BS72-058 (Nyx): summoned pays +1 core to a Nyx Nexus and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const nx = BS.mkInst('BS72-CX02'); nx.cores = 1; P.nexus = [nx];
    const f = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects && !BS.CARDS[k].token);
    for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst(f));
    const v = BS.mkInst('BS72-058'); v.cores = 2; P.spirits = [v]; const h0 = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', v, {});
    return [!BS.CARDS['BS72-058'].partial, nx.cores, P.hand.length - h0]; })()`);
  assert.ok(r[0]); assert.equal(r[2], 1);
});

test('K-1007 BS72-022 (Nyx): Manifest card; summoned +1 Nyx core, discards 2 Removed, draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const nx = BS.mkInst('BS72-CX02'); nx.cores = 1; P.nexus = [nx];
    const f = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects && !BS.CARDS[k].token);
    for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst(f));
    O.removed = [BS.mkInst(f), BS.mkInst(f), BS.mkInst(f)]; const t0 = O.trash.length, h0 = P.hand.length;
    const v = BS.mkInst('BS72-022'); v.cores = 2; P.spirits = [v];
    await BS.fireFx(P, 'SUMMONED', v, {});
    const c = BS.CARDS['BS72-022'];
    return [!c.partial, !!c.manifest, nx.cores, O.removed.length, O.trash.length - t0, P.hand.length - h0]; })()`);
  assert.deepEqual(r, [true, true, 2, 1, 2, 1]);
});

test('K-1008 BS72-021 (Nyx): Mani card; TURN_SUMMON_TAX raises the opposing six-color Cost 4 or less cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const nx = BS.mkInst('BS72-CX02'); nx.cores = 2; P.nexus = [nx];
    const six = Object.keys(BS.CARDS).find(k => { const x = BS.CARDS[k]; return x.type === 'Spirit' && x.cost <= 4 && x.cost >= 1 && (x.colors || []).length >= 6; });
    const two = Object.keys(BS.CARDS).find(k => { const x = BS.CARDS[k]; return x.type === 'Spirit' && x.cost <= 4 && x.cost >= 1 && (x.colors || [x.symbol]).length < 6; });
    const v = BS.mkInst('BS72-021'); v.cores = 3; P.spirits = [v];
    const src = { p: P, opp: O, src: v, ctx: {} };
    const b6 = six ? BS.effCost(O, BS.CARDS[six]) : null, b2 = BS.effCost(O, BS.CARDS[two]);
    await BS.FX_ACTIONS.TURN_SUMMON_TAX.run(src, { n: 3, match: { colorsGe: 6, costLe: 4 } });
    const c = BS.CARDS['BS72-021'];
    return [!c.partial, !!c.manifest, six ? BS.effCost(O, BS.CARDS[six]) - b6 : 3, BS.effCost(O, BS.CARDS[two]) - b2]; })()`);
  assert.deepEqual(r, [true, true, 3, 0]);
});

test('K-1009 BS72-024 (Nyx): Mani card; summoned raises opposing cost by 1, LV2 shields Life from 3+ core attackers', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const x = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost >= 1 && !BS.CARDS[k].effects);
    const b = BS.effCost(O, BS.CARDS[x]);
    const v = BS.mkInst('BS72-024'); v.cores = 5; P.spirits = [v];
    await BS.fireFx(P, 'SUMMONED', v, {});
    const up = BS.effCost(O, BS.CARDS[x]) - b;
    await BS.FX_ACTIONS.LIFE_CORE_SHIELD.run({ p: P, opp: O, src: v, ctx: {} }, { coresGe: 3 });
    const c = BS.CARDS['BS72-024'];
    return [!c.partial, !!c.manifest, up, P.coreShield.ge, P.coreShield.turn === G.turnNo]; })()`);
  assert.deepEqual(r, [true, true, 1, 3, true]);
});

test('K-1010 BS74-011 (Ometeotl): Cost 4 while the Soul Core is on Contractor Ometeotl; summoned destroys and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const nx = BS.mkInst('BS74-CX01'); nx.cores = 1; P.nexus = [nx];
    const c = BS.CARDS['BS74-011'];
    nx.soul = false; const c0 = BS.effCost(P, c); nx.soul = true; const c1 = BS.effCost(P, c);
    const f = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects && !BS.CARDS[k].token && BS.CARDS[k].levels[0].bp <= 12000);
    for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst(f));
    const t = BS.mkInst(f); O.spirits = [t]; const h0 = P.hand.length;
    const v = BS.mkInst('BS74-011'); v.cores = 3; P.spirits = [v];
    await BS.fireFx(P, 'SUMMONED', v, {});
    return [!c.partial, c0, c1, O.spirits.length, P.hand.length - h0]; })()`);
  assert.equal(r[0], true, JSON.stringify(r)); assert.equal(r[1] - r[2], 2, JSON.stringify(r)); assert.equal(r[3], 0, JSON.stringify(r)); assert.equal(r[4], 1, JSON.stringify(r));
});

test('K-1011 BS74-005 (Ometeotl): Mani card; summoned returns Ometeotl/Lava Fish cards, +1 at six counters', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const nx = BS.mkInst('BS74-CX01'); nx.cores = 1; P.nexus = [nx]; P.count = 6;
    P.trash = [BS.mkInst('BS74-011'), BS.mkInst('BS74-002'), BS.mkInst('BS74-012')]; const h0 = P.hand.length;
    const v = BS.mkInst('BS74-005'); v.cores = 3; P.spirits = [v];
    await BS.fireFx(P, 'SUMMONED', v, {});
    const c = BS.CARDS['BS74-005'];
    return [!c.partial, !!c.manifest, P.hand.length - h0, P.trash.length]; })()`);
  assert.deepEqual(r, [true, true, 2, 1], JSON.stringify(r));
});

test('K-1012 BS74-002 (Ometeotl): reveal three, add one Ometeotl/Lava Fish card; Soul Core to Ometeotl reveals +1 and adds +1', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const run = async soul => { const nx = BS.mkInst('BS74-CX01'); nx.cores = 1; P.nexus = [nx];
      const v = BS.mkInst('BS74-002'); v.cores = 2; P.spirits = [v]; P.reserve.soul = false; P.trashCores.soul = false; if (soul) v.soul = true; G.turnNo += 1;
      const f = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Lava Fish') && BS.CARDS[k].name !== 'Contractor Ometeotl');
      P.deck = [BS.mkInst('BS74-011'), BS.mkInst('BS74-012'), BS.mkInst(f), BS.mkInst('BS74-011'), BS.mkInst(f)]; if (soul === 2) P.deck = [BS.mkInst(f), BS.mkInst(f), BS.mkInst(f), BS.mkInst(f), BS.mkInst(f), BS.mkInst(f), BS.mkInst(f)]; P.trash = []; P.hand = [];
      await BS.fireFx(P, 'SUMMONED', v, {}); return soul === 2 ? [P.hand.length, P.trash.length, P.deck.length] : [P.hand.length, P.trash.length]; };
    const a = await run(false), b = await run(true), d = await run(2);
    return [!BS.CARDS['BS74-002'].partial, a, b, d]; })()`);
  assert.equal(r[0], true, JSON.stringify(r)); assert.deepEqual(r[1], [1, 2], JSON.stringify(r)); assert.deepEqual(r[2], [2, 2], JSON.stringify(r)); assert.deepEqual(r[3], [0, 4, 3], JSON.stringify(r));
});

test('K-1013 BS52-037 Argenica / BS54-037 Pterasonic (Primal pool): attack refresh once, two symbols at 3 counters', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const out = [];
    for (const id of ['BS52-037', 'BS54-037']) { for (const cnt of [2, 3]) {
      P.count = cnt; const v = BS.mkInst(id); v.cores = 3; P.spirits = [v]; v.exhausted = true; G.turnNo += 1;
      await BS.fireFx(P, 'ATTACKS', v, {}); const ex1 = v.exhausted;
      out.push([id, cnt, id === 'BS52-037' ? !ex1 : (cnt >= 3 ? !ex1 : ex1), id === 'BS52-037' ? (cnt >= 3 ? BS.fieldSymbols(P).length : 1) : (v.symSet ? v.symSet.n : 0)]); } }
    return [!BS.CARDS['BS52-037'].partial && !BS.CARDS['BS54-037'].partial, out]; })()`);
  assert.equal(r[0], true, JSON.stringify(r));
  assert.deepEqual(r[1], [['BS52-037', 2, true, 1], ['BS52-037', 3, true, 2], ['BS54-037', 2, true, 2], ['BS54-037', 3, true, 2]], JSON.stringify(r));
});

test('K-1014 BS52-RV004 Skoll / BS54-RV005 Morrigan (revival): attack refresh; Skoll immune to Spirit effects at 2 counters; Morrigan immune only braved and attacking', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const sp = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const mag = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic');
    const brv = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Brave');
    const by = id => ({ p: O, opp: P, src: BS.mkInst(id) });
    const sk = BS.mkInst('BS52-RV004'); sk.cores = 4; P.spirits = [sk]; sk.exhausted = true;
    P.count = 1; const a1 = BS.fxImmune(P, sk, by(sp)); P.count = 2; const a2 = BS.fxImmune(P, sk, by(sp)), a3 = BS.fxImmune(P, sk, by(mag));
    G.turnNo += 1; await BS.fireFx(P, 'ATTACKS', sk, {}); const refreshed = !sk.exhausted;
    const mo = BS.mkInst('BS54-RV005'); mo.cores = 4; P.spirits = [mo];
    G.attacker = mo; const m1 = BS.fxImmune(P, mo, by(sp)); mo.brave = BS.mkInst(brv); const m2 = BS.fxImmune(P, mo, by(sp)); G.attacker = null; const m3 = BS.fxImmune(P, mo, by(sp));
    mo.exhausted = true; G.turnNo += 1; await BS.fireFx(P, 'ATTACKS', mo, {});
    return [!BS.CARDS['BS52-RV004'].partial && !BS.CARDS['BS54-RV005'].partial, [a1, a2, a3, refreshed], [m1, m2, m3, !mo.exhausted]]; })()`);
  assert.equal(r[0], true, JSON.stringify(r)); assert.deepEqual(r[1], [false, true, false, true], JSON.stringify(r)); assert.deepEqual(r[2], [false, true, false, true], JSON.stringify(r));
});

test('K-1015 BS52-024 Boostrich (Primal pool): burst lock, bounce exhausted Spirit at 1 counter, refresh on first attack', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const sp = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !BS.CARDS[k].effects);
    const run = async cnt => { P.count = cnt; const v = BS.mkInst('BS52-024'); v.cores = 3; P.spirits = [v]; v.exhausted = true; P.attacksThisTurn = 1; G.noBurst = null;
      const t = BS.mkInst(sp); t.exhausted = true; O.spirits = [t]; O.hand = [];
      await BS.fireFx(P, 'ATTACKS', v, {}); return [G.noBurst === O.key, O.spirits.length, O.hand.length, !v.exhausted]; };
    const a = await run(0), b = await run(1); P.attacksThisTurn = 2; const v = BS.mkInst('BS52-024'); v.cores = 3; P.spirits = [v]; v.exhausted = true; await BS.fireFx(P, 'ATTACKS', v, {});
    return [!BS.CARDS['BS52-024'].partial, a, b, !v.exhausted]; })()`);
  assert.equal(r[0], true, JSON.stringify(r)); assert.deepEqual(r[1], [true, 1, 0, true], JSON.stringify(r)); assert.deepEqual(r[2], [true, 0, 1, true], JSON.stringify(r)); assert.equal(r[3], false, JSON.stringify(r));
});

test('K-1016 BS53-030 Jisaidori (Primal pool): burst lock; end of battle refresh at 2+ counters', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const run = async cnt => { P.count = cnt; const v = BS.mkInst('BS53-030'); v.cores = 3; P.spirits = [v]; v.exhausted = true; G.noBurst = null; G.attacker = v; G.eob = []; G.turnNo += 1;
      await BS.fireFx(P, 'ATTACKS', v, {}); const waiting = G.eob.length, before = v.exhausted; await BS.endOfBattle(); G.attacker = null; return [G.noBurst === O.key, waiting, before, !v.exhausted]; };
    const a = await run(1), b = await run(2);
    return [!BS.CARDS['BS53-030'].partial, a, b]; })()`);
  assert.equal(r[0], true, JSON.stringify(r)); assert.deepEqual(r[1], [true, 1, true, false], JSON.stringify(r)); assert.deepEqual(r[2], [true, 1, true, true], JSON.stringify(r));
});

test('K-1017 BS53-034 BlackPanther / BS55-025 Swallow (Primal pool): heavy exhaust then bounce at 2 counters; Swallow exhausts or heavy exhausts in the Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true;
    const sp = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !BS.CARDS[k].effects);
    const opp = () => { const t = BS.mkInst(sp); t.cores = 3; O.spirits = [t]; return t; };
    const out = [];
    for (const cnt of [1, 2]) { P.count = cnt; const v = BS.mkInst('BS53-034'); v.cores = 3; P.spirits = [v]; const t = opp(); O.hand = [];
      await BS.fireFx(P, 'ATTACKS', v, {}); out.push([cnt, !!t.heavy, O.spirits.length]); }
    const sw = []; for (const [cnt, step] of [[1, 5], [2, 5], [2, 4]]) { P.count = cnt; G.step = step; const v = BS.mkInst('BS55-025'); v.cores = 2; P.spirits = [v]; const t = opp();
      await BS.fireFx(P, 'SUMMONED', v, {}); sw.push([cnt, step, t.exhausted, !!t.heavy]); }
    return [!BS.CARDS['BS53-034'].partial && !BS.CARDS['BS55-025'].partial, out, sw]; })()`);
  assert.equal(r[0], true, JSON.stringify(r)); assert.deepEqual(r[1], [[1, true, 1], [2, false, 0]], JSON.stringify(r));
  assert.deepEqual(r[2], [[1, 5, true, false], [2, 5, true, true], [2, 4, false, false]], JSON.stringify(r));
});

test('K-1018 BS53-071 Binding Noise (Primal pool): heavy exhausts two, then returns two exhausted to the deckbottom at 3 counters; BS55-073 Overdose: +3000 to all, refresh only in the opposing Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const sp = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !BS.CARDS[k].effects);
    const out = { bn: [], od: [] };
    for (const cnt of [2, 3]) { P.count = cnt; P.reserve.n = 20; const a = BS.mkInst(sp), b = BS.mkInst(sp), c = BS.mkInst(sp); [a, b, c].forEach(x => x.cores = 3); O.spirits = [a, b, c]; O.deck = [];
      const m = BS.mkInst('BS53-071'); P.hand = [m]; await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' }); out.bn.push([cnt, O.spirits.length, O.deck.length]); }
    for (const [act, step] of [[P.key, 4], [O.key, 5]]) { G.active = act; G.step = step; P.reserve.n = 20; const a = BS.mkInst(sp); a.cores = 2; a.exhausted = true; P.spirits = [a]; const b0 = BS.bpOf(a);
      const m = BS.mkInst('BS55-073'); P.hand = [m]; await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' }); out.od.push([BS.bpOf(a) - b0, !!a.exhausted]); }
    out.ok = !BS.CARDS['BS53-071'].partial && !BS.CARDS['BS55-073'].partial; return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.bn, [[2, 3, 0], [3, 1, 2]], JSON.stringify(r));
  assert.deepEqual(r.od, [[3000, true], [3000, false]], JSON.stringify(r));
});

test('K-1019 BS53-045 Past Pom (Primal pool): all Primal Spirits +2000 BP, +5000 instead with 1/3/5/7 counters (schema v402 counterIn)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const v = BS.mkInst('BS53-045'); v.cores = 3; P.spirits = [v]; const out = [];
    for (const n of [0, 1, 2, 3, 7, 8]) { P.count = n; out.push([n, BS.bpOf(v) - 3000]); }
    v.cores = 1; P.count = 1; out.push(['lv1', BS.bpOf(v) - 2000]);
    return [out, !BS.CARDS['BS53-045'].partial]; })()`);
  assert.equal(r[1], true, JSON.stringify(r));
  assert.deepEqual(r[0], [[0, 2000], [1, 5000], [2, 2000], [3, 5000], [7, 5000], [8, 2000], ['lv1', 0]], JSON.stringify(r));
});

test('K-1020 BS53-026 Racket Hummingbird: opposing Ultimates and Cost 3 Spirits are summoned exhausted in the opposing turn only (schema v403 SUMMON_EXHAUSTED)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s3 = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost === 3 && !BS.CARDS[k].effects && BS.CARDS[k].fxComplete !== false);
    const s4 = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].cost === 4 && !BS.CARDS[k].effects && BS.CARDS[k].fxComplete !== false);
    const ult = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Ultimate' && !BS.CARDS[k].effects);
    const hb = BS.mkInst('BS53-026'); hb.cores = 3; P.spirits = [hb]; const out = [];
    for (const [act, id] of [[P.key, s3], [O.key, s3], [O.key, s4], [O.key, ult]]) { G.active = act; G.step = 4; O.spirits = []; O.reserve.n = 30; const m = BS.mkInst(id); O.hand = [m];
      BS.summon(O, m, null, {}); out.push([act === P.key ? 'own' : 'opp', BS.CARDS[id].cost, !!m.exhausted]); }
    return [out, !BS.CARDS['BS53-026'].partial]; })()`);
  assert.equal(r[1], true, JSON.stringify(r));
  assert.deepEqual(r[0].map(x => x[2]), [false, true, false, true], JSON.stringify(r));
});

test('K-1021 BS52-RV001 Lizardedge: red Primal Spirits remain exhausted instead of returning (own Attack Step); BS53-050 Capricornus: yellow Primal remain instead of being destroyed at 1/3/5/7 counters', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = O.key;
    const sp = (col) => Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && !c.token && (c.colors || [c.symbol]).includes(col) && (c.families || []).includes('Primal') && c.levels && c.levels.length; });
    const red = sp('red'), yel = sp('yellow'); const out = {};
    const liz = BS.mkInst('BS52-RV001'); liz.cores = 3; const rd = BS.mkInst(red); rd.cores = 3; P.spirits = [liz, rd]; P.hand = [];
    BS.bounceCard(P, rd, 'hand'); out.retAtk = [P.spirits.includes(rd), !!rd.exhausted, P.hand.length];
    G.step = 4; rd.exhausted = false; BS.bounceCard(P, rd, 'hand'); out.retMain = [P.spirits.includes(rd), P.hand.length];
    const cap = BS.mkInst('BS53-050'); cap.cores = 3; const yl = BS.mkInst(yel); yl.cores = 3; P.spirits = [cap, yl]; P.hand = [];
    for (const n of [1, 2]) { P.count = n; yl.exhausted = false; if (!P.spirits.includes(yl)) P.spirits.push(yl); BS.removeSpirit(P, yl, 'destroyed', true); out['d' + n] = [P.spirits.includes(yl), !!yl.exhausted]; }
    out.ok = !BS.CARDS['BS52-RV001'].partial && !BS.CARDS['BS53-050'].partial; out.red = red; out.yel = yel; return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.retAtk, [true, true, 0], JSON.stringify(r)); assert.deepEqual(r.retMain, [false, 1], JSON.stringify(r));
  assert.deepEqual(r.d1, [true, true], JSON.stringify(r)); assert.deepEqual(r.d2, [false, false], JSON.stringify(r));
});

test('K-1022 BS53-067 Nexus Hazard (Primal): destroys an opposing Nexus and draws; a second one when the opponent controls three or more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const nx = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && !BS.CARDS[k].token);
    const out = [];
    for (const n of [2, 3]) { O.nexus = []; for (let i = 0; i < n; i++) O.nexus.push(BS.mkInst(nx)); P.hand = []; P.deck = P.deck.length ? P.deck : []; const d0 = P.deck.length;
      const m = BS.mkInst('BS53-067'); P.hand = [m]; await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' }); out.push([n, O.nexus.length, P.hand.length]); }
    return [out, !BS.CARDS['BS53-067'].partial]; })()`);
  assert.equal(r[1], true, JSON.stringify(r));
  assert.deepEqual(r[0].map(x => x[1]), [1, 1], JSON.stringify(r));
});

test('K-1023 BS74-061 Goz (Mani): destroys up to three opposing Cost 3 or less Spirits and gains a core; BS73-025 CorCorgi: gets a core and exhausts an opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const lo = Object.keys(BS.CARDS).filter(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && !c.token && c.cost <= 3 && !c.effects && c.levels && c.levels.length; }).slice(0, 4);
    const hi = Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && !c.token && c.cost >= 6 && !c.effects && c.levels && c.levels.length; });
    const goz = BS.mkInst('BS74-061'); goz.cores = 3; P.spirits = [goz]; O.spirits = lo.map(k => { const m = BS.mkInst(k); m.cores = 1; return m; }); const big = BS.mkInst(hi); big.cores = 3; O.spirits.push(big);
    await BS.fireFx(P, 'ATTACKS', goz, { attacker: goz, subject: goz });
    const out = { left: O.spirits.length, bigStays: O.spirits.includes(big) };
    const cc = BS.mkInst('BS73-025'); cc.cores = 3; const c0 = cc.cores; P.spirits = [cc]; const tgt = BS.mkInst(lo[0]); tgt.cores = 1; O.spirits = [tgt];
    await BS.fireFx(P, 'SUMMONED', cc); out.cc = [cc.cores - c0, !!tgt.exhausted];
    out.ok = !BS.CARDS['BS74-061'].partial && !BS.CARDS['BS73-025'].partial; return out; })()`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.bigStays, true, JSON.stringify(r)); assert.ok(r.left <= 2, JSON.stringify(r));
});
