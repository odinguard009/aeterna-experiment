// v0.195.0 Lane K: condition viaLegacy and BOUNCE_OPP bpLe/n (Lycao-Culus 26RBS02-046).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { quietBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

async function run(legacyN) {
  const { page } = await quietBoard();
  return page.evaluate(async legacyN => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;   // CPU seat auto-picks targets
    const small = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && c.levels[0].bp <= 3000 && !(c.effects && c.effects.length)).slice(0, 2);
    const foes = small.map(c => { const s = BS.mkInst(c.id); s.cores = 1; O.spirits.push(s); return s; });
    const src = BS.mkInst('26RBS02-046'); src.cores = 1; src.legacyN = legacyN; P.spirits.push(src);
    const deck0 = O.deck.length, hand0 = O.hand.length;
    await BS.fireFx(P, 'SUMMONED', src, {});
    return { gone: foes.filter(f => !O.spirits.includes(f)).length, deck: O.deck.length - deck0, hand: O.hand.length - hand0 };
  }, legacyN);
}

test('K-01 Lycao-Culus: with Legacy two small Spirits go to the deck bottom, without they go to the hand', async () => {
  const a = await run(1), b = await run(0);
  assert.deepEqual(a, { gone: 2, deck: 2, hand: 0 });
  assert.deepEqual(b, { gone: 2, deck: 0, hand: 2 });
});

test('K-02 Hargris counts other Purgatory Wings Spirits only; Pacugna +2000 attacking, +5000 with a Cost 6/8 Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(() => {
    const G = BS.G, P = G.p.player; G.active = P.key;
    const fam = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && (c.families || []).includes('Purgatory Wings') && c.id !== '26RBS03-003' && !(c.effects && c.effects.length)).slice(0, 2);
    const h = BS.mkInst('26RBS03-003'); h.cores = 1; P.spirits.push(h);
    const alone = BS.bpOf(h); fam.forEach(c => { const s = BS.mkInst(c.id); s.cores = 1; P.spirits.push(s); });
    const withTwo = BS.bpOf(h);
    const pac = BS.mkInst('26RBS03-048'); pac.cores = 1; P.spirits.push(pac); G.attacker = pac;
    const lowCost = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && ![6, 8].includes(c.cost) && c.cost !== BS.CARDS['26RBS03-048'].cost);
    const base = BS.CARDS['26RBS03-048'].levels[0].bp, plain = BS.bpOf(pac) - base;
    const big = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost === 6 && !(c.effects && c.effects.length)); const b = BS.mkInst(big.id); b.cores = 1; P.spirits.push(b);
    return { alone, withTwo, plain, withBig: BS.bpOf(pac) - base };
  });
  assert.equal(r.withTwo - r.alone, 2000);
  assert.equal(r.plain, 2000);
  assert.equal(r.withBig, 5000);
});

test('K-03 Sertarius returns a Windfang from the Trash but never another Sertarius; Savatoma sends to the deck bottom with an exhausted Mineroid', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    const wf = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Windfang') && c.name !== 'Sertarius');
    const twin = BS.mkInst('26RSD01-008'); P.trash.push(twin);
    const src = BS.mkInst('26RSD01-008'); src.cores = 1; P.spirits.push(src);
    await BS.fireFx(P, 'SUMMONED', src, {});
    const onlySelfName = !P.hand.includes(twin);
    const w = BS.mkInst(wf.id); P.trash.push(w);
    await BS.fireFx(P, 'SUMMONED', src, {});
    const got = P.hand.includes(w);
    const mine = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Mineroid') && !(c.effects && c.effects.length));
    const m = BS.mkInst(mine.id); m.cores = 1; m.exhausted = true; P.spirits.push(m);
    const foe = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Spirit' && !(c.effects && c.effects.length)).id); foe.cores = 1; O.spirits.push(foe);
    const sav = BS.mkInst('26RSD04-X02'); sav.cores = 1; P.spirits.push(sav);
    await BS.fireFx(P, 'SUMMONED', sav, {});
    return { onlySelfName, got, deckBottom: O.deck[O.deck.length - 1] === foe, hand: O.hand.includes(foe) };
  });
  assert.deepEqual(r, { onlySelfName: true, got: true, deckBottom: true, hand: false });
});

test('K-04 Spinard destroys two opposing 3000 BP or less Spirits with a Purgatory Wings Spirit, otherwise one', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    const small = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels[0].bp <= 3000 && !(c.effects && c.effects.length));
    const mk = () => { const f = BS.mkInst(small.id); f.cores = 1; O.spirits.push(f); return f; };
    const [a, b, c3] = [mk(), mk(), mk()];
    const src = BS.mkInst('26RSD09-008'); src.cores = 1; P.spirits.push(src);
    await BS.fireFx(P, 'SUMMONED', src, {});
    const one = O.spirits.length;
    const pw = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Purgatory Wings') && !(c.effects && c.effects.length));
    const w = BS.mkInst(pw.id); w.cores = 1; P.spirits.push(w);
    await BS.fireFx(P, 'SUMMONED', src, {});
    return { one, two: O.spirits.length };
  });
  assert.deepEqual(r, { one: 2, two: 0 });
});

test('K-05 Lumius widens its BP with the Soul Core; Hanoki is LV2 with eight opposing Trash cards; Urumsipha is LV2 attacking with only Purgatory Wings/Bladessom Spirits', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    const mid = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels[0].bp === 4000 && !(c.effects && c.effects.length));
    const f = BS.mkInst(mid.id); f.cores = 1; O.spirits.push(f);
    const src = BS.mkInst('26RBS03-004'); src.cores = 1; P.spirits.push(src);
    src.soulPaid = false; await BS.fireFx(P, 'SUMMONED', src, {});
    const keptNoSoul = O.spirits.includes(f);
    src.soulPaid = true; await BS.fireFx(P, 'SUMMONED', src, {});
    const goneSoul = !O.spirits.includes(f);
    const h = BS.mkInst('26RBS02-071'); h.cores = 1; P.spirits.push(h);
    const lv1 = BS.lvNo ? BS.lvNo(h) : null;
    for (let i = 0; i < 8; i++) O.trash.push(BS.mkInst(mid.id));
    const lv2 = BS.lvNo ? BS.lvNo(h) : null;
    const u = BS.mkInst('26RBS03-006'); u.cores = 1; P.spirits.push(u);
    const wings = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Purgatory Wings'));
    P.spirits.length = 0; P.spirits.push(u, BS.mkInst(wings.id));
    const idle = BS.lvNo(u); G.attacker = u; const atk = BS.lvNo(u);
    P.spirits.push(BS.mkInst(mid.id)); const mixed = BS.lvNo(u);
    return { keptNoSoul, goneSoul, lv1, lv2, urum: [idle, atk, mixed] };
  });
  assert.deepEqual(r, { keptNoSoul: true, goneSoul: true, lv1: 1, lv2: 2, urum: [1, 2, 1] });
});

test('K-06 Lalyre can attack only with a Soul Core on it', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(() => {
    const P = BS.G.p.player; const l = BS.mkInst('26RSD09-001'); l.cores = 1; P.spirits.push(l);
    l.soul = null; const bare = BS.flagActive(P, 'CANT_ATTACK', l);
    l.soul = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Spirit').id); const held = BS.flagActive(P, 'CANT_ATTACK', l);
    return [bare, held];
  });
  assert.deepEqual(r, [true, false]);
});

test('K-07 Squidina heavy exhausts only an opposing exhausted Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    const mid = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && !(c.effects && c.effects.length));
    const a = BS.mkInst(mid.id), b = BS.mkInst(mid.id); a.cores = 1; b.cores = 1; b.exhausted = true; O.spirits.push(a, b);
    const src = BS.mkInst('26RDB01-022'); src.cores = 1; src.lostLv = 0; P.trash.push(src);      // a (When Destroyed) source sits in the Trash
    await BS.fireFx(P, 'DESTROYED', src, {});
    return [!!a.heavy, !!b.heavy];
  });
  assert.deepEqual(r, [false, true]);
});

test('K-08 Sertis-style DESTROY.bpPer widens the BP limit per own Clash Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    const big = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels[0].bp === 4000 && !(c.effects && c.effects.length));
    const f = BS.mkInst(big.id); f.cores = 1; O.spirits.push(f);
    const src = BS.mkInst('26RBS01-008'); src.cores = 1; P.spirits.push(src);
    await BS.fireFx(P, 'SUMMONED', src, {}); const kept = O.spirits.includes(f);
    P.spirits.push(BS.mkInst('26RBS02-009')); await BS.fireFx(P, 'SUMMONED', src, {});
    return [kept, !O.spirits.includes(f)];
  });
  assert.deepEqual(r, [true, true]);
});

// Magic bases are staged with an allHave gate; these tests drop it and check the new shapes.
const MAGIC_RUN = `const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
  const run = (id) => { const m = BS.mkInst(id); const acts = BS.CARDS[id].magic.actions.map(a => { const b = { ...a }; if (b.if) { b.if = { ...b.if }; delete b.if.allHave; if (!Object.keys(b.if).length) delete b.if; } return b; }); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: acts }); };
  const opp = (cost, bp, team) => { const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost === cost && c.levels[0].bp === bp && !(c.effects && c.effects.length)); const f = BS.mkInst(c.id); f.cores = 1; O.spirits.push(f); return f; };`;

test('K-09 DESTROY.costPerOwn adds +1 cost per own Spirit/Nexus', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const t = opp(4, 3000); await run('26RCB01-071'); const kept = O.spirits.includes(t);
    P.spirits.push(BS.mkInst('26RBS02-009')); await run('26RCB01-071');
    return [kept, !O.spirits.includes(t)]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-10 BP_MINUS.nPer grows per own team Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const yr = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && /\\[Teams?:[^\\]]*Yellow Rise/.test(c.desc || c.text || ''));
    const t = opp(3, 4000); const b0 = BS.bpOf(t); await run('26RSD08-014'); const d0 = b0 - BS.bpOf(t);
    P.spirits.push(BS.mkInst(yr.id)); const t2 = opp(3, 4000); const b1 = BS.bpOf(t2); await run('26RSD08-014');
    return [d0, b1 - BS.bpOf(t2)]; })()`);
  assert.deepEqual(r, [3000, 4000]);
});

test('K-11 26RDB01-056 widens the BP limit with two exhausted own Spirits', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const t = opp(3, 6000); await run('26RDB01-056'); const kept = O.spirits.includes(t);
    for (let i = 0; i < 2; i++) { const s = BS.mkInst('26RBS02-009'); s.exhausted = true; P.spirits.push(s); }
    await run('26RDB01-056'); return [kept, !O.spirits.includes(t)]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-12 Virgal refreshes an exhausted own Nexus on attack', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const n = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Nexus').id); n.exhausted = true; P.nexus.push(n);
    const src = BS.mkInst('26RBS01-080'); src.cores = 3; P.spirits.push(src);
    await BS.fireFx(P, 'ATTACKS', src, {}); return n.exhausted; })()`);
  assert.equal(r, false);
});

test('K-13 REFRESH_SPIRIT.bp refreshes a Clash Spirit and adds BP; oppAttackStep gates it', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const t = BS.mkInst('26RBS02-009'); t.cores = 1; t.exhausted = true; P.spirits.push(t);
    const b0 = BS.bpOf(t); await BS.fireFx(P, 'SUMMONED', t, {}); const a = [t.exhausted, BS.bpOf(t) - b0];
    const w = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.colors || [c.symbol]).includes('white')).id); w.cores = 1; w.exhausted = true; P.spirits.push(w);
    const w0 = BS.bpOf(w); await run('26RBS01-118'); return [a, w.exhausted, BS.bpOf(w) - w0]; })()`);
  assert.deepEqual(r, [[false, 2000], false, 0]);
});

test('K-14 WIN_RIDER: draw / Life core on a BP win, only the stamped turn, no core on the blocker side', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const t = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Spirit').id); P.spirits.push(t);
    const rd = async a => { await BS.FX_ACTIONS.WIN_RIDER.run({ p: P, opp: O, src: t, ctx: { picked: t } }, a); };
    const h0 = P.hand.length; await rd({ do: 'WIN_RIDER', draw: 2 }); winRiderRun({ key: P.key, inst: t, att: true });
    const d = P.hand.length - h0;
    const l0 = O.life; await rd({ do: 'WIN_RIDER', lifeCore: true }); winRiderRun({ key: P.key, inst: t, att: false }); const l1 = O.life;
    winRiderRun({ key: P.key, inst: t, att: true }); const l2 = O.life;
    G.turnNo++; winRiderRun({ key: P.key, inst: t, att: true });
    return [d, l0 - l1, l1 - l2, l2 - O.life]; })()`);
  assert.deepEqual(r, [2, 0, 1, 0]);
});

test('K-15 Polar Fox / Stofir exhaust the attacker side; Genm returns; Semarogue draws; Rensis + Sakimiko', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    O.cpu = true; const out = [];
    const cheap = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost <= 3).id, dear = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost >= 5).id;
    const fox = BS.mkInst('26RBS02-030'); fox.cores = 1; P.spirits.push(fox);
    const a = BS.mkInst(cheap), b = BS.mkInst(dear); a.cores = b.cores = 1; O.spirits.push(a, b);
    G.active = O.key; G.step = 5; await BS.fireFx(P, 'OPP_ATTACKS', fox, { attacker: b });
    out.push([a.exhausted, b.exhausted]);
    G.active = P.key; const sto = BS.mkInst('26RBS03-027'); sto.cores = 3; P.spirits.push(sto); a.exhausted = false;
    const fl = BS.mkInst('26RBS03-025'); P.spirits.push(fl);
    await BS.fireFx(P, 'ALLY_BLOCKED', fl, { attacker: fl, subject: fl, blocker: a }); out.push(a.exhausted);
    const g = BS.mkInst('26RCB01-054'); g.cores = 0; g.lostLv = 0; P.trash.push(g); P.spirits.length = 0; P.spirits.push(BS.mkInst('26RCB01-039')); O.spirits.length = 0; O.spirits.push(BS.mkInst(cheap));
    await BS.fireFx(P, 'DESTROYED', g, { subject: g }); out.push([P.hand.includes(g), O.spirits.length]);
    const sem = BS.mkInst('26RSD05-006'); sem.cores = 3; P.spirits.push(sem); G.attacker = sem; G.step = 5; G.active = P.key;
    const td = '26RSD05-011', h0 = P.hand.length;
    await BS.fireFx(P, 'MAGIC_USED', null, { subject: BS.mkInst(td) }); out.push(P.hand.length - h0);
    const ren = BS.mkInst('26RSD01-X01'); ren.cores = 3; P.spirits.push(ren); P.trashCores = P.trashCores || {}; 
    const sk = BS.mkInst('26RBS02-010'); sk.cores = 3; P.spirits.push(sk);
    await BS.fireFx(P, 'START_ATTACK', sk, {}); out.push(!!sk.winRider);
    return out; })()`);
  assert.deepEqual(r, [[true, false], true, [true, 0], 1, true]);
});

test('K-16 dual Main/Flash magic: Burn Out draws then destroys with a family Spirit; Heart Arrow needs an exhausted Red Stella Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const main = (id) => { const m = BS.mkInst(id); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: BS.CARDS[id].magic.by.MAIN.actions }); };
    const t = opp(3, 3000); const h0 = P.hand.length; await main('26RBS03-086'); const alone = [O.spirits.includes(t), P.hand.length - h0];
    const pw = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Purgatory Wings') && !(c.effects && c.effects.length)); const s = BS.mkInst(pw.id); s.cores = 1; P.spirits.push(s);
    await main('26RBS03-086');
    const nx = Object.values(BS.CARDS).find(c => c.type === 'Nexus' && c.cost <= 4); const n = BS.mkInst(nx.id); O.nexus.push(n);
    await main('26RDB01-055'); const kept = O.nexus.includes(n);
    const rs = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && /\\[Teams?:[^\\]]*Red Stella/.test(c.desc || c.text || '')); const e = BS.mkInst(rs.id); e.cores = 1; e.exhausted = true; P.spirits.push(e);
    await main('26RDB01-055'); return [alone, !O.spirits.includes(t), kept, !O.nexus.includes(n)]; })()`);
  assert.deepEqual(r, [[true, 1], true, true, true]);
});

test('K-17 show-and-return tails: Nox draws one (two via Form Change), Lemon refreshes at End Step, Genm Zombie returns from the Trash', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const give = (fam) => { const c = Object.values(BS.CARDS).find(c => (c.families || []).includes(fam) && c.type === 'Spirit' && c.cost <= 6 && !['26RCB01-014','26RCB01-022','26RCB01-045'].includes(c.id)); P.hand.push(BS.mkInst(c.id)); return c; };
    const nox = async (fc) => { give('ZEZTZ'); const s = BS.mkInst('26RCB01-022'); s.cores = 1; P.spirits.push(s); const h = P.hand.length, d = P.deck.length; await BS.fireFx(P, 'SUMMONED', s, fc ? { viaFC: true } : {}); return P.hand.length - h + 1; };
    const a = await nox(false), b = await nox(true);
    give('GAIM'); const l = BS.mkInst('26RCB01-014'); l.cores = 4; l.exhausted = true; P.spirits.push(l); await BS.fireFx(P, 'END_STEP', null, {});
    give('EX-AID'); const z = BS.mkInst('26RCB01-045'); z.cores = 0; P.trash.push(z); z.lostLv = 0; const h2 = P.hand.length; await BS.fireFx(P, 'DESTROYED', z, {});
    return [a, b, l.exhausted, P.hand.includes(z)]; })()`);
  assert.deepEqual(r, [1, 2, false, true]);
});

test('K-18 BP_TARGET.alt (Spear Victory +3000, +5000 on Kamen Rider Baron) and EXHAUST_SELF (Laura Byakuran)', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const spear = async (id) => { const s = BS.mkInst(id); s.cores = 1; P.spirits.push(s); const b = BS.bpOf(s); await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RCB01-061'), ctx: {} }, { actions: BS.CARDS['26RCB01-061'].magic.actions }); return BS.bpOf(s) - b; };
    const gaim = Object.values(BS.CARDS).find(c => (c.families || []).includes('GAIM') && c.type === 'Spirit' && !c.name.includes('Baron') && !(c.effects && c.effects.length));
    const baron = Object.values(BS.CARDS).find(c => c.id === '26RCB01-005');
    P.spirits.length = 0; const a = await spear(gaim.id); P.spirits.length = 0; const b = await spear(baron.id);
    P.spirits.length = 0; const rs = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.id !== '26RDB01-005' && /\\[Teams?:[^\\]]*Red Stella/.test(c.desc || c.text || '') && !(c.effects && c.effects.length));
    const t = BS.mkInst(rs.id); t.cores = 1; P.spirits.push(t); const l = BS.mkInst('26RDB01-005'); l.cores = 1; P.spirits.push(l); const b0 = BS.bpOf(t) + BS.bpOf(l);
    await BS.fireFx(P, 'START_ATTACK', l, {});
    return [a, b, l.exhausted, BS.bpOf(t) + BS.bpOf(l) - b0]; })()`);
  assert.deepEqual(r, [3000, 5000, true, 1000]);
});

test('K-19 NO_BLOCK_INFERIOR (Lizardman) and perReserve BP (Gowsilvia static, BlackWind Panther when attacks)', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const liz = BS.mkInst('BS01-018'); liz.cores = 1; O.spirits.push(liz);
    const weak = opp(1, 1000), strong = opp(1, 1000); liz.bpMod = 5000; strong.bpMod = 20000;
    const lo = BS.blockedInferior(O, weak, liz), hi = BS.blockedInferior(O, strong, liz);
    const g = BS.mkInst('BS01-072'); g.cores = 5; P.spirits.push(g); P.reserve.n = 0; const b0 = BS.bpOf(g); P.reserve.n = 3; const b1 = BS.bpOf(g);
    const bp = BS.mkInst('BS03-031'); bp.cores = 3; P.spirits.push(bp); const c0 = BS.bpOf(bp); await BS.fireFx(P, 'ATTACKS', bp, { attacker: bp });
    return [lo, hi, b1 - b0, BS.bpOf(bp) - c0]; })()`);
  assert.deepEqual(r, [true, false, 3000, 3000]);
});

test('K-20 BP_MINUS.nLegacy (Aureole), shared once-per-turn exhaust (Kacomic), Form Change core send (Esprim Barrier)', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const plain = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels[0].bp === 4000 && !(c.effects && c.effects.length));
    const aur = async (n) => { const t = BS.mkInst(plain.id); t.cores = 1; O.spirits.push(t); const s = BS.mkInst('26RBS02-053'); s.cores = 1; s.legacyN = n; P.spirits.push(s); await BS.fireFx(P, 'SUMMONED', s, {}); return O.spirits.includes(t); };
    const keep = await aur(0), gone = !(await aur(2));
    O.spirits.length = 0; const a = BS.mkInst(plain.id), b = BS.mkInst(plain.id); a.cores = b.cores = 1; O.spirits.push(a, b);
    const k = BS.mkInst('BS63-034'); k.cores = 1; P.spirits.push(k);
    await BS.fireFx(P, 'SUMMONED', k, {}); await BS.fireFx(P, 'ATTACKS', k, { attacker: k });
    const ex = O.spirits.filter(x => x.exhausted).length;
    O.spirits.length = 0; const c = BS.mkInst(plain.id), d = BS.mkInst(plain.id); c.cores = d.cores = 3; O.spirits.push(c, d);
    const e = BS.mkInst('26RSD07-008'); e.cores = 1; P.spirits.push(e); await BS.fireFx(P, 'SUMMONED', e, {}); const none = c.cores + d.cores;
    e.viaFC = true; await BS.fireFx(P, 'SUMMONED', e, {});
    return [keep, gone, ex, none, c.cores + d.cores]; })()`);
  assert.deepEqual(r, [true, true, 1, 6, 4]);
});

test('K-21 Zeztz Exdream: destroy 1 exhausted Spirit, 2 via Form Change', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const plain = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels[0].bp === 4000 && !(c.effects && c.effects.length));
    const zrun = async fc => { O.spirits.length = 0; for (let i = 0; i < 3; i++) { const t = BS.mkInst(plain.id); t.cores = 2; t.exhausted = true; O.spirits.push(t); }
      const z = BS.mkInst('26RCB01-X03'); z.cores = 1; z.viaFC = fc; P.spirits.push(z); await BS.fireFx(P, 'SUMMONED', z, {}); return O.spirits.length; };
    return [await zrun(false), await zrun(true)]; })()`);
  assert.deepEqual(r, [2, 1]);
});

test('K-22 Luminous Recovery Main: Void core to Life once per card name per turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const main = id => BS.runActions({ p: P, opp: O, src: BS.mkInst(id), ctx: {} }, { actions: BS.CARDS[id].magic.by.MAIN.actions });
    P.void = 3; const l0 = P.life; await main('26RBS03-093'); const l1 = P.life;
    P.magicTurn = { turn: G.turnNo, cards: ['26RBS03-093'] }; await main('26RBS03-093');
    return [l1 - l0, P.life - l1]; })()`);
  assert.deepEqual(r, [1, 0]);
});

test('K-23 Glitail: when destroyed, destroy an opposing Spirit with the same BP', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const mk = bp => { const k = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.levels[0].bp === bp && !(c.effects && c.effects.length)); const t = BS.mkInst(k.id); t.cores = 1; O.spirits.push(t); return t; };
    const same = mk(3000), other = mk(4000);
    const g = BS.mkInst('26RBS01-007'); g.cores = 1; g.lostLv = 0; P.trash.push(g); await BS.fireFx(P, 'DESTROYED', g, { subject: g });
    return [O.spirits.includes(same), O.spirits.includes(other)]; })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-24 Waltana: CANT_BE_BLOCKED_BY noSoul only on the second attack', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const w = BS.mkInst('26RBS02-057'); w.cores = 2; P.spirits.push(w);
    const A = { do: 'CANT_BE_BLOCKED_BY', noSoul: true, if: { firstAttack: false } };
    const ok = BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.chk(A);
    await BS.FX_ACTIONS.CANT_BE_BLOCKED_BY.run({ p: P, opp: O, src: w, ctx: {} }, A);
    return [ok, !!(w.noBlockBy && w.noBlockBy.noSoul)]; })()`);
  assert.deepEqual(r, [true, true]);
});
