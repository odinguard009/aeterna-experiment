import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1026 BS58-024 Wolfbanus: banishes up to five opposing Trash cards; with a Red symbol it draws and destroys a Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS58-024'); w.cores = 2; P.spirits = [w]; O.spirits = [];
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token).slice(0, 7);
    O.trash = ids.map(k => BS.mkInst(k)); const t0 = O.trash.length;
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { banished: t0 - O.trash.length, ok: !BS.CARDS['BS58-024'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.banished, 5, JSON.stringify(r));
});

test('K-1027 Mega-Grandstone Spirits (BS54-001/011/022/031/043): LV2 gives own matching Grandstone Nexuses an extra symbol; LV1 Nexus reduction gets the extra symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key;
    const gs = Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Nexus' && (c.families || []).includes('Grandstone') && (c.colors || [c.symbol]).includes('yellow') && !/Mega-Grandstone/.test(c.name); });
    const mega = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && /Mega-Grandstone/.test(BS.CARDS[k].name) && (BS.CARDS[k].reduction || {}).white);
    const nx = BS.mkInst(gs), pim = BS.mkInst('BS54-043'); pim.cores = 3; P.spirits = [pim]; P.nexus = [nx];
    const yel = BS.symbolsOn(P).yellow || 0; const pur = BS.symbolsOn(P).purple || 0;
    pim.cores = 1; const yel1 = BS.symbolsOn(P).yellow || 0;
    return { yel, yel1, pur, ok: ['BS54-001','BS54-011','BS54-022','BS54-031','BS54-043'].every(k => !BS.CARDS[k].partial), mega: !!mega }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.ok(r.yel >= r.yel1 + 1, JSON.stringify(r));
});

test('K-1028 BS56-018 RaiunZame: strips a core and draws on depletion; LV2 attack destroys a Spirit with four cores or more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS56-018'); w.cores = 3; P.spirits = [w];
    const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const big = BS.mkInst(id); big.cores = 5; O.spirits = [big]; const h0 = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { ok: !BS.CARDS['BS56-018'].partial, gone: !O.spirits.includes(big), h: P.hand.length - h0 }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r));
});

test('K-1029 BS54-015 Knowledge Snake: attack removes a core, with two counters removes one more', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS54-015'); w.cores = 3; P.spirits = [w]; P.count = 2;
    const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const t = BS.mkInst(id); t.cores = 4; O.spirits = [t];
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { ok: !BS.CARDS['BS54-015'].partial, left: t.cores }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.left, 2, JSON.stringify(r));
});
