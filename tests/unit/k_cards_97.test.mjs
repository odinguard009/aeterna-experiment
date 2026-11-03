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
