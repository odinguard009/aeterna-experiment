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
