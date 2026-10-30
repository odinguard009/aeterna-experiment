// Lane K tests, shard 2 of 4 (split from k_legacy_bounce.test.mjs; one shared page per shard, see sharedBoard in lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
// Magic bases are staged with an allHave gate; these tests drop it and check the new shapes.
const MAGIC_RUN = `const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
  const run = (id, lg) => { const m = BS.mkInst(id); m.legacyN = lg || 0; const acts = BS.CARDS[id].magic.actions.map(a => { const b = { ...a }; if (b.if) { b.if = { ...b.if }; delete b.if.allHave; if (!Object.keys(b.if).length) delete b.if; } return b; }); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: acts }); };
  const opp = (cost, bp, team) => { const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost === cost && c.levels[0].bp === bp && !(c.effects && c.effects.length)); const f = BS.mkInst(c.id); f.cores = 1; O.spirits.push(f); return f; };`;

test('K-25 Rush Out: a Leucomyst Spirit gets the turn mark', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const k = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Leucomyst'));
    const a = BS.mkInst(k.id); a.cores = 1; P.spirits.push(a);
    const A = { do: 'UNBLOCKABLE_PICK', match: { family: ['Leucomyst'] } };
    const ok = BS.FX_ACTIONS.UNBLOCKABLE_PICK.chk(A);
    await BS.FX_ACTIONS.UNBLOCKABLE_PICK.run({ p: P, opp: O, src: a, ctx: {} }, A);
    return [ok, a.noBlockTurn === G.turnNo]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-26 Lasslake: NO_BP_DESTROY marks the Spirit for this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const s = BS.mkInst('26RBS03-036'); s.cores = 2; P.spirits.push(s); G.attacker = s;
    await BS.FX_ACTIONS.NO_BP_DESTROY.run({ p: P, opp: O, src: s, ctx: {} }, { do: 'NO_BP_DESTROY' });
    return [BS.FX_ACTIONS.NO_BP_DESTROY.chk({}), s.noBpDestroy === G.battleNo]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-27 Breakam Slash: draws only when the picked Spirit has Form Change', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const ks = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && (c.families || []).includes('ZEZTZ'));
    const fc = ks.find(c => (c.desc || '').includes('{{F Change|')), nf = ks.find(c => !(c.desc || '').includes('{{F Change|'));
    const res = [];
    for (const k of [fc, nf]) { P.spirits.length = 0; P.spirits.push(Object.assign(BS.mkInst(k.id), { cores: 1 })); const h = P.hand.length; await run('26RSD07-014'); res.push(P.hand.length - h); }
    return res; })()`);
  assert.deepEqual(r, [1, 0]);
});

test('K-28 Gigan Song: cost 4 or less, 6 or less when used using Legacy', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(6, 3000); await run('26RDB01-063', 0); const k0 = O.spirits.includes(a);
    await run('26RDB01-063', 1); return [k0, !O.spirits.includes(a)]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-29 Crawdia exhausted-only void cores; Gate Open, Release adds up to two Legacy Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true;
    const bb = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && (c.text || c.desc || '').includes('[Team: Blue Beat]')).slice(0, 3);
    P.spirits.length = 0; const ins = bb.map((c, i) => { const s = BS.mkInst(c.id); s.cores = 1; s.exhausted = i < 2; P.spirits.push(s); return s; });
    P.void = P.void || 0; const before = ins.map(s => s.cores);
    await BS.runActions({ p: P, opp: G.p.opponent, src: BS.mkInst('26RDB01-047'), ctx: {} }, { actions: BS.CARDS['26RDB01-047'].effects[0].actions });
    const cores = ins.map(s => s.cores - 1);
    const lg = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && (c.desc || c.text || '').includes('(Legacy)')).slice(0, 3);
    P.deck.splice(0, 4, ...lg.concat(Object.values(BS.CARDS).filter(c => c.type === 'Spirit').slice(0, 1)).map(c => BS.mkInst(c.id))); const h = P.hand.length;
    await BS.runActions({ p: P, opp: G.p.opponent, src: BS.mkInst('26RBS02-CP01'), ctx: {} }, { actions: BS.CARDS['26RBS02-CP01'].magic.by.MAIN.actions });
    return [cores, P.hand.length - h]; })()`);
  assert.equal(r[0][2], 0);
  assert.equal(r[1], 2);
});

test('K-30 Break Claw: destroys a Nexus, then Trash core to Reserve only with an exhausted Red Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const nx = Object.values(BS.CARDS).find(c => c.type === 'Nexus' && !c.trueRelease && !(c.effects && c.effects.length));
    const red = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.symbol === 'red');
    const out = [];
    for (const ex of [false, true]) {
      O.nexus.length = 0; O.nexus.push(BS.mkInst(nx.id)); P.spirits.length = 0; const s = BS.mkInst(red.id); s.cores = 1; s.exhausted = ex; P.spirits.push(s);
      P.trashCores.n = 1; const r0 = P.reserve.n; await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RSD01-012'), ctx: {} }, { actions: BS.CARDS['26RSD01-012'].magic.by.MAIN.actions }); out.push([O.nexus.length, P.reserve.n - r0]); }
    return out; })()`);
  assert.deepEqual(r, [[0, 0], [0, 1]]);
});

test('K-31 Carneliath: CPU destroys two 3000 BP Spirits when it can, else one 5000 BP Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const out = [];
    for (const bps of [[3000, 3000, 5000], [5000]]) {
      O.spirits.length = 0; bps.forEach(bp => opp(bp === 3000 ? 3 : 5, bp));
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS01-X02'), ctx: {} }, { actions: BS.CARDS['26RBS01-X02'].effects[0].actions });
      out.push(O.spirits.length); }
    return out; })()`);
  assert.deepEqual(r, [1, 0]);
});

test('K-32 Hallucination: returns up to three opposing Cost 3 or less Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const nx = Object.values(BS.CARDS).filter(c => c.type === 'Nexus' && c.cost <= 3).slice(0, 2);
    O.nexus.length = 0; nx.forEach(c => O.nexus.push(BS.mkInst(c.id)));
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-094'), ctx: {} }, { actions: BS.CARDS['26RBS03-094'].magic.by.MAIN.actions });
    return O.nexus.length; })()`);
  assert.equal(r, 0);
});

test('K-33 Salvador: TREAT_LV2 makes a Cyantree Spirit LV2 for the turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Cyantree') && c.levels.length > 1);
    P.spirits.length = 0; const s = BS.mkInst(c.id); s.cores = c.levels[0].cores; P.spirits.push(s);
    const lv0 = BS.lvNo(s);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-X14'), ctx: {} }, { actions: BS.CARDS['26RBS03-X14'].effects.find(e => e.trigger === 'START_ATTACK').actions });
    return [lv0, BS.lvNo(s)]; })()`);
  assert.deepEqual(r, [1, 2]);
});

test('K-34 Wyll-Gale: sends two cores from the opposing attacking Spirit only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(4, 3000), b = opp(4, 3000); a.cores = 3; b.cores = 3; BS.G.attacker = a;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS02-019'), ctx: {} }, { actions: BS.CARDS['26RBS02-019'].effects[0].actions });
    return [a.cores, b.cores]; })()`);
  assert.deepEqual(r, [1, 3]);
});

test('K-35 Collet: refreshes a Wollaguard Spirit that then cannot attack this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Wollaguard'));
    P.spirits.length = 0; const s = BS.mkInst(c.id); s.cores = 1; s.exhausted = true; P.spirits.push(s);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-032'), ctx: {} }, { actions: BS.CARDS['26RBS03-032'].effects[0].actions });
    return [s.exhausted, s.noAtkTurn === BS.G.turnNo]; })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-36 Level Up: TREAT_LV2 self+battle lasts only while that battle runs; firstBlock counts blocks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const id = '26RCB01-039', c = BS.CARDS[id];
    P.spirits.length = 0; const s = BS.mkInst(id); s.cores = c.levels[0].cores; P.spirits.push(s);
    const fx = c.effects.find(e => e.trigger === 'ATTACKS');
    BS.G.battleNo = 5; BS.G.attacker = s;
    await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: fx.actions });
    const during = BS.lvNo(s); BS.G.battleNo = 6; const next = BS.lvNo(s); BS.G.battleNo = 5; BS.G.attacker = null; const after = BS.lvNo(s);
    return [during, next, after, !!c.effects.find(e => e.trigger === 'BLOCKS' && e.if && e.if.firstBlock)]; })()`);
  assert.deepEqual(r, [2, 1, 1, true]);
});

test('K-37 Velocirant: REFRESH_SPIRIT self refreshes only the source Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit');
    P.spirits.length = 0; const a = BS.mkInst('26RBS01-066'), b = BS.mkInst(c.id); a.exhausted = b.exhausted = true; P.spirits.push(b, a);
    const fx = BS.CARDS['26RBS01-066'].effects.find(e => e.trigger === 'END_STEP');
    await BS.runActions({ p: P, opp: O, src: a, ctx: {} }, { actions: fx.actions });
    return [a.exhausted, b.exhausted]; })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-38 Lupes: REVEAL_PICK discard sends the picked card to the Trash, not the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const fam = Object.values(BS.CARDS).find(c => (c.families || []).includes('Beastleptic'));
    P.deck.unshift(BS.mkInst(fam.id)); const h = P.hand.length, t = P.trash.length;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-015'), ctx: {} }, { actions: BS.CARDS['26RBS03-015'].effects.find(e => e.trigger === 'DESTROYED').actions });
    return [P.hand.length - h, P.trash.length - t]; })()`);
  assert.deepEqual(r, [0, 1]);
});

test('K-39 Galesion: EXHAUST_OPP heavy+oppChooses heavy exhausts a refreshed opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(4, 3000); a.exhausted = false;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-028'), ctx: {} }, { actions: BS.CARDS['26RBS03-028'].effects[0].actions });
    return [a.exhausted, !!a.heavy]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-40 Mandia: CRUSH n:6 discards six opposing decktop cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const n = O.deck.length, t = O.trash.length;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS02-070'), ctx: {} }, { actions: BS.CARDS['26RBS02-070'].effects.find(e => e.trigger === 'ALLY_LIFE_HIT').actions });
    return [n - O.deck.length, O.trash.length - t]; })()`);
  assert.deepEqual(r, [6, 6]);
});

test('K-41 Deep Strike: BY(PAY_COST) then heavy exhaust an exhausted opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(4, 3000); a.exhausted = true; const before = BS.coresAvailable(P);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RDB01-059'), ctx: {} }, { actions: [{ do: 'BY', cost: { do: 'PAY_COST', n: 1 }, then: [{ do: 'HEAVY_EXHAUST_OPP', n: 1, exhaustedOnly: true }] }] });
    return [before - BS.coresAvailable(P), !!a.heavy]; })()`);
  assert.deepEqual(r, [1, true]);
});

test('K-42 Aloe Toll: BP_TARGET match.tr only boosts a Spirit in True Release state', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const t = BS.mkInst('26RDB01-X03'); t.cores = 4; const n = BS.mkInst('26RDB01-015'); n.cores = 2; P.spirits.push(t, n);
    const e = BS.CARDS['26RDB01-016'].effects.find(x => x.invoke);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RDB01-016'), ctx: {} }, { actions: e.actions });
    return [t.bpMod || 0, n.bpMod || 0]; })()`);
  assert.deepEqual(r, [2000, 0]);
});

test('K-43 Marie Dog: BP_PLUS pick:3 boosts only three of four own Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const L = ['26RDB01-015', '26RDB01-016', '26RDB01-017', '26RDB01-015'].map(id => { const s = BS.mkInst(id); s.cores = 2; P.spirits.push(s); return s; });
    P.cpu = true;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RDB01-037'), ctx: {} }, { actions: BS.CARDS['26RDB01-037'].effects.find(e => e.trigger === 'START_ATTACK').actions });
    return L.filter(s => s.bpMod === 2000).length; })()`);
  assert.equal(r, 3);
});

test('K-44 Allurement: REVEAL_PICK peek sets prev only for a matching card and returns it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const a = BS.mkInst('26RDB01-015'); a.cores = 2; P.spirits.push(a);
    const hit = '26RDB01-054', miss = '26RDB01-015';
    const out = [];
    for (const id of [hit, miss]) { P.deck.unshift(BS.mkInst(id)); const n = P.deck.length; const c = { p: P, opp: O, src: BS.mkInst('26RDB01-054'), ctx: {} };
      await BS.runActions(c, { actions: [{ do: 'REVEAL_PICK', n: 1, match: { team: 'Red Stella' }, rest: 'either', peek: true }] }); out.push([c.ctx.did, P.deck.length === n]); }
    return out; })()`);
  assert.deepEqual(r, [[true, true], [false, true]]);
});

test('K-45 Heliodon: match.typeAny accepts Spirit/Nexus but not Magic', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const f = Object.keys(BS.CARDS).filter(k => (BS.CARDS[k].families || []).includes('Wollaguard'));
    const out = [];
    for (const ty of ['Spirit', 'Magic']) { P.deck.unshift(BS.mkInst(f.find(k => BS.CARDS[k].type === ty))); const c = { p: P, opp: O, src: BS.mkInst('26RBS03-040'), ctx: {} };
      await BS.runActions(c, { actions: [{ do: 'REVEAL_PICK', n: 1, match: { family: ['Wollaguard'], typeAny: ['Spirit', 'Nexus'] }, rest: 'bottom' }] }); out.push(P.hand.length); }
    return out; })()`);
  assert.deepEqual(r, [1, 1]);
});

test('K-46 Kolulu: peek + pickedCostIn branches on the revealed cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const out = [];
    for (const cost of [3, 4]) { const id = Object.keys(BS.CARDS).find(k => BS.CARDS[k].cost === cost && BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects);
      const src = BS.mkInst('26RBS03-056'); src.cores = 1; P.spirits.push(src); const t = opp(3, 2000); P.deck.unshift(BS.mkInst(id));
      await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: BS.CARDS['26RBS03-056'].effects[0].actions });
      out.push([P.spirits.includes(src), O.spirits.includes(t), BS.bpOf ? 1 : 0]); P.spirits.length = 0; O.spirits.length = 0; }
    return out.map(x => x.slice(0, 2)); })()`);
  assert.deepEqual(r, [[false, true], [true, false]]);
});

test('K-47 Pussybill: RETURN_TRASH.milled only returns a card the MILL just discarded', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const id = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Beastleptic') && BS.CARDS[k].type === 'Spirit');
    P.trash.push(BS.mkInst(id)); const out = [];
    for (const fam of [false, true]) { if (fam) P.deck.unshift(BS.mkInst(id), BS.mkInst(id)); const h = P.hand.length;
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS02-016'), ctx: {} }, { actions: [{ do: 'MILL', n: fam ? 2 : 1 }, { do: 'RETURN_TRASH', match: { family: ['Beastleptic'] }, anyType: true, milled: true }] }); out.push(P.hand.length - h); }
    return out; })()`);
  assert.deepEqual(r, [0, 1]);
});

test('K-48 Balaculus: costPer lowers the Hand cost by 2 per Abyssen Spirit, capped at 8', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const card = BS.CARDS['26RSD10-009'], ab = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Abyssen') && BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].reduction.length), out = [BS.effCost(P, card)];
    for (let i = 0; i < 5; i++) { P.spirits.push(BS.mkInst(ab)); out.push(BS.effCost(P, card)); }
    return out; })()`);
  assert.equal(r[0] - r[1], 2);
  assert.equal(r[0] - r[5], 8);
});
