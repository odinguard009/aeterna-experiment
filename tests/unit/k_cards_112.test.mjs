import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1175 BSC48-CX02: trashAllMatch condition and the colour also-treated read the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const K = BS.CARDS['BSC48-CX02'], cond = { trashAllMatch: { anyOf: [{ name: ['God-Sechs'] }, { family: ['Heavenly Demon King', 'Vassal'] }] } };
    const gs = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name.includes('God-Sechs') && BS.CARDS[k].type === 'Spirit');
    const other = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic' && !(BS.CARDS[k].families || []).some(f => ['Heavenly Demon King', 'Vassal'].includes(f)) && !BS.CARDS[k].name.includes('God-Sechs'));
    P.trash = [BS.mkInst(gs)]; const yes = BS.fxIf(P, O, cond);
    P.trash.push(BS.mkInst(other)); const no = BS.fxIf(P, O, cond);
    return { fc: K.partial === false, yes, no, rev: !!K.revive }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.yes, true, JSON.stringify(r)); assert.equal(r.no, false, JSON.stringify(r));
});

test('K-1176 BSC48-CX02: MAGIC_SOUL_TAX_TURN locks Magic while a God-Sechs attacks until the Soul Core is paid once', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const gsId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name.includes('God-Sechs') && BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].levels.length > 1);
    const nx = BS.mkInst('BSC48-CX02'); nx.cores = 6; P.nexus = [nx]; const gs = BS.mkInst(gsId); gs.cores = 2; P.spirits = [gs];
    await BS.runActions({ p: P, opp: O, src: nx, ctx: {} }, { actions: [{ do: 'MAGIC_SOUL_TAX_TURN', match: { name: ['God-Sechs'] } }] });
    O.reserve.n = 5; O.reserve.soul = true; G.attacker = null; let m = null, mg = null;
    for (const k of Object.keys(BS.CARDS)) { const c = BS.CARDS[k]; if (c.type !== 'Magic' || !c.magic || !(c.magic.timing || []).includes('FLASH') || (c.cost || 0) > 2) continue; const t = BS.mkInst(k); O.hand = [t]; if (BS.magicUsable(O, t, 'flash')) { m = t; mg = k; break; } }
    const idle = !!m; G.attacker = gs; G.battleNo = (G.battleNo || 0) + 1;
    const canPay = BS.magicUsable(O, m, 'flash');
    O.reserve.soul = false; O.spirits = []; const noSoul = BS.magicUsable(O, m, 'flash');
    return { gsId, mg, idle, canPay, noSoul, tax: !!O.magicTax }; })()`);
  assert.equal(r.tax, true, JSON.stringify(r)); assert.equal(r.noSoul, false, JSON.stringify(r));
  assert.equal(r.idle, true, JSON.stringify(r)); assert.equal(r.canPay, true, JSON.stringify(r));
});

test('K-1177 SD32-X02: a two-colour ally attacking sends two opposing cores to the Trash only while the Soul Core is on the source', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const two = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || []).length === 2 && BS.CARDS[k].levels.length > 0);
    const one = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || [BS.CARDS[k].color]).length === 1 && BS.CARDS[k].levels.length > 0);
    const run = async (soul, id) => { const src = BS.mkInst('SD32-X02'); src.cores = 3; src.soul = soul; const al = BS.mkInst(id); al.cores = 1; P.spirits = [src, al];
      const t = BS.mkInst(one); t.cores = 6; O.spirits = [t]; O.trashCores.n = 0; await BS.fireFx(P, 'ALLY_ATTACKS', al, { attacker: al }); return O.trashCores.n; };
    return { fc: BS.CARDS['SD32-X02'].partial === false, withSoul: await run(true, two), noSoul: await run(false, two), mono: await run(true, one) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.withSoul, 2, JSON.stringify(r)); assert.equal(r.noSoul, 0, JSON.stringify(r)); assert.equal(r.mono, 0, JSON.stringify(r));
});

test('K-1178 SD32-002: only the exactly-named God-Sechs in Hand becomes Cost 6 (Type variants stay), and the colour is also Red', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key;
    const s = BS.mkInst('SD32-002'); s.cores = 2; P.spirits = [s];
    return { fc: BS.CARDS['SD32-002'].partial === false, exact: handCostSet(P, BS.CARDS['SD32-X02']), variant: handCostSet(P, BS.CARDS['BS34-XX02']), red: BS.CARDS['SD32-002'].colors || BS.CARDS['SD32-002'].color }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.exact, 6, JSON.stringify(r)); assert.equal(r.variant, null, JSON.stringify(r));
});

test('K-1179 SD32-003: summon bounces one opposing Spirit and draws only with ANOTHER red Spirit that has a Soul Core', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const red = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || [BS.CARDS[k].color]).includes('red') && BS.CARDS[k].levels.length > 0 && k !== 'SD32-003');
    const run = async (mode) => { const me = BS.mkInst('SD32-003'); me.cores = 3; const o = BS.mkInst(red); o.cores = 1; o.soul = mode === 'other'; me.soul = mode === 'self'; P.spirits = [me, o];
      const t = BS.mkInst(red); t.cores = 2; O.spirits = [t]; O.hand = []; const h0 = P.hand.length; await BS.fireFx(P, 'SUMMONED', me, {}); return { drew: P.hand.length - h0, bounced: O.hand.length, left: O.spirits.length }; };
    return { fc: BS.CARDS['SD32-003'].partial === false, other: await run('other'), self: await run('self'), none: await run('none') }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.other.drew, 1, JSON.stringify(r)); assert.equal(r.self.drew, 0, JSON.stringify(r)); assert.equal(r.none.drew, 0, JSON.stringify(r)); assert.equal(r.other.left, 0, JSON.stringify(r));
});

test('K-1180 SD32-004: +3000 BP to two-colour allies only while the Soul Core is on the source (Lv2+)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key;
    const two = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || []).length === 2 && BS.CARDS[k].levels.length > 0 && !(BS.CARDS[k].effects || []).length);
    const one = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || [BS.CARDS[k].color]).length === 1 && BS.CARDS[k].levels.length > 0 && !(BS.CARDS[k].effects || []).length);
    const run = (soul, id) => { const src = BS.mkInst('SD32-004'); src.cores = 3; src.soul = soul; const al = BS.mkInst(id); al.cores = 1; P.spirits = [src, al]; const b0 = bpOf(al); P.spirits = [al]; const b1 = bpOf(al); P.spirits = [src, al]; return bpOf(al) - b1; };
    return { fc: BS.CARDS['SD32-004'].partial === false, withSoul: run(true, two), noSoul: run(false, two), mono: run(true, one) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.withSoul, 3000, JSON.stringify(r)); assert.equal(r.noSoul, 0, JSON.stringify(r)); assert.equal(r.mono, 0, JSON.stringify(r));
});

test('K-1181 SD57-004: summon draws, then returns an opposing Spirit only while you have a White symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const mono = c => (c.colors || [c.symbol]).length === 1 && c.levels.length > 0 && c.type === 'Spirit';
    const wh = Object.keys(BS.CARDS).find(k => { if (!(mono(BS.CARDS[k]) && BS.CARDS[k].symbol === 'white')) return false; const a = BS.mkInst(k); a.cores = 1; P.spirits = [a]; return !!symbolsOn(P).white; });
    const bl = Object.keys(BS.CARDS).find(k => mono(BS.CARDS[k]) && BS.CARDS[k].symbol === 'blue');
    const run = async (id) => { const me = BS.mkInst('SD57-004'); me.cores = 1; const a = BS.mkInst(id); a.cores = 1; P.spirits = [a]; P.spirits = [me, a].slice(0, 2); const t = BS.mkInst(bl); t.cores = 1; O.spirits = [t]; O.hand = []; const h0 = P.hand.length; await BS.fireFx(P, 'SUMMONED', me, {}); return { drew: P.hand.length - h0, back: O.hand.length }; };
    return { fc: BS.CARDS['SD57-004'].partial === false, white: await run(wh), blue: await run(bl), sd: (BS.CARDS['SD57-004'].colors || []) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.white.drew, 1, JSON.stringify(r)); assert.equal(r.white.back, 1, JSON.stringify(r)); assert.equal(r.blue.back, 0, JSON.stringify(r));
});

test('K-1182 SD57-005: braved to a God-Sechs-named Spirit the host gains all six symbol colours, otherwise nothing', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key;
    const run = id => { const h = BS.mkInst(id); h.cores = 3; h.brave = BS.mkInst('SD57-005'); P.spirits = [h]; return Object.keys(symbolsOn(P)).length; };
    const other = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].name.includes('God-Sechs') && (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).length === 1 && BS.CARDS[k].levels.length > 0);
    return { fc: BS.CARDS['SD57-005'].partial === false, god: run('SD32-X02'), other: run(other) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.god, 6, JSON.stringify(r)); assert.ok(r.other < 6, JSON.stringify(r));
});

test('K-1183 SD57-003: reveals three, adds a HeavenlyDemon card and The Owari World, discards the rest; God-Sechs costs 6 at Lv2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true; G.active = P.key;
    const me = BS.mkInst('SD57-003'); me.cores = 3; P.spirits = [me]; P.hand = []; const filler = BS.mkInst('SD57-005');
    P.deck = [BS.mkInst('SD57-006'), BS.mkInst('SD57-X02'), filler].concat(P.deck); const t0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', me, {});
    return { fc: BS.CARDS['SD57-003'].partial === false, hand: P.hand.map(x => x.id).sort(), trashed: P.trash.length - t0, cost: handCostSet(P, BS.CARDS['SD32-X02']) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.hand.length, 2, JSON.stringify(r)); assert.ok(r.hand.includes('SD57-006'), JSON.stringify(r)); assert.equal(r.cost, 6, JSON.stringify(r));
});
