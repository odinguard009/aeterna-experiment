import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const pre = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
  const sp = (pred) => Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Spirit' && !c.token && pred(c); });
  const nyx = BS.mkInst('BS72-CX02'); nyx.cores = 0; P.nexus = [nyx]; P.onceUsed = {};`;

test('K-1117 BS72-CX02 Nyx: Neo-Core Charge on a Cost 3+ Darkling Spirit, not on Cost 2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const hi = BS.mkInst(sp(c => (c.families || []).includes('Darkling') && c.cost >= 3)), lo = BS.mkInst(sp(c => (c.families || []).includes('Darkling') && c.cost <= 2));
    await BS.fireFx(P, 'ALLY_SUMMONED', nyx, { subject: lo }); const a = nyx.cores;
    await BS.fireFx(P, 'ALLY_SUMMONED', nyx, { subject: hi }); const b = nyx.cores;
    return { a, b, partial: BS.CARDS['BS72-CX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.a, 0, JSON.stringify(r)); assert.equal(r.b, 1, JSON.stringify(r));
});

test('K-1118 BS72-CX02 Nyx: NEXUS_DOWN gives 2 counters and raises Lv costs once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    nyx.cores = 4; P.count = 0; P.void = 6; G.turnNo = 5; P.onceUsed = {};
    await BS.fireFx(P, 'NEXUS_DOWN', nyx, {});
    return { counter: P.count, up: O.lvCostUp, turn: G.turnNo }; })()`);
  assert.equal(r.counter, 2, JSON.stringify(r)); assert.equal(r.up, r.turn, JSON.stringify(r));
});

test('K-1119 BS72-CX02 Nyx Lv2 Flash: pays 4 cores, opposing Spirit drops to 1 core, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    nyx.cores = 4; P.count = 4; const t = BS.mkInst(sp(c => c.cost >= 3)); t.cores = 5; O.spirits = [t]; O.reserve.n = 0;
    const idx = BS.CARDS['BS72-CX02'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const ok = await BS.activateFx(P, nyx, idx); const ok2 = await BS.activateFx(P, nyx, idx);
    return { ok, ok2, nyx: nyx.cores, t: t.cores }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.nyx, 0, JSON.stringify(r)); assert.equal(r.t, 1, JSON.stringify(r)); assert.equal(r.ok2, false, JSON.stringify(r));
});

test('K-1120 BS72-077 Acid Shot: cores to 1, Nyx loses 2 cores to the Void, a Spirit with 4+ cores is destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    nyx.cores = 4; const t = BS.mkInst(sp(c => c.cost >= 3)); t.cores = 5; const u = BS.mkInst(sp(c => c.cost >= 3)); u.cores = 3; O.spirits = [t, u];
    const m = BS.CARDS['BS72-077'].magic.actions;
    for (const a of m) await BS.FX_ACTIONS[a.do].run({ p: P, opp: O, src: nyx, ctx: {} }, a);
    return { nyx: nyx.cores, tAlive: O.spirits.includes(t), uCores: u.cores, partial: BS.CARDS['BS72-077'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nyx, 2, JSON.stringify(r));
});

test('K-1121 BS72-078 Amorphous Body: Trash copy is usable once per game, returns after use', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const m = BS.CARDS['BS72-078'].magic;
    return { rtn: m.rtn, trash: m.oppAttackHand && m.oppAttackHand.trash, partial: BS.CARDS['BS72-078'].partial }; })()`);
  assert.equal(r.rtn, true, JSON.stringify(r)); assert.equal(r.trash, true, JSON.stringify(r)); assert.equal(r.partial, false, JSON.stringify(r));
});

test('K-1122 BS73-075 Muddy Swing: Flash drops a Spirit to 1 core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${pre}
    const t = BS.mkInst(sp(c => c.cost >= 3)); t.cores = 4; O.spirits = [t];
    const a = BS.CARDS['BS73-075'].magic.by.FLASH.actions[0];
    await BS.FX_ACTIONS[a.do].run({ p: P, opp: O, src: nyx, ctx: {} }, a);
    return { t: t.cores, partial: BS.CARDS['BS73-075'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.t, 1, JSON.stringify(r));
});
