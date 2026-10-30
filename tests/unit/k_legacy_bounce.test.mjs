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
  const run = (id, lg) => { const m = BS.mkInst(id); m.legacyN = lg || 0; const acts = BS.CARDS[id].magic.actions.map(a => { const b = { ...a }; if (b.if) { b.if = { ...b.if }; delete b.if.allHave; if (!Object.keys(b.if).length) delete b.if; } return b; }); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: acts }); };
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

test('K-25 Rush Out: a Leucomyst Spirit gets the turn mark', async () => {
  const { page } = await quietBoard();
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
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const s = BS.mkInst('26RBS03-036'); s.cores = 2; P.spirits.push(s); G.attacker = s;
    await BS.FX_ACTIONS.NO_BP_DESTROY.run({ p: P, opp: O, src: s, ctx: {} }, { do: 'NO_BP_DESTROY' });
    return [BS.FX_ACTIONS.NO_BP_DESTROY.chk({}), s.noBpDestroy === G.battleNo]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-27 Breakam Slash: draws only when the picked Spirit has Form Change', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const ks = Object.values(BS.CARDS).filter(c => c.type === 'Spirit' && (c.families || []).includes('ZEZTZ'));
    const fc = ks.find(c => (c.desc || '').includes('{{F Change|')), nf = ks.find(c => !(c.desc || '').includes('{{F Change|'));
    const res = [];
    for (const k of [fc, nf]) { P.spirits.length = 0; P.spirits.push(Object.assign(BS.mkInst(k.id), { cores: 1 })); const h = P.hand.length; await run('26RSD07-014'); res.push(P.hand.length - h); }
    return res; })()`);
  assert.deepEqual(r, [1, 0]);
});

test('K-28 Gigan Song: cost 4 or less, 6 or less when used using Legacy', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(6, 3000); await run('26RDB01-063', 0); const k0 = O.spirits.includes(a);
    await run('26RDB01-063', 1); return [k0, !O.spirits.includes(a)]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-29 Crawdia exhausted-only void cores; Gate Open, Release adds up to two Legacy Spirits', async () => {
  const { page } = await quietBoard();
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
  const { page } = await quietBoard();
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
  const { page } = await quietBoard();
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
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const nx = Object.values(BS.CARDS).filter(c => c.type === 'Nexus' && c.cost <= 3).slice(0, 2);
    O.nexus.length = 0; nx.forEach(c => O.nexus.push(BS.mkInst(c.id)));
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-094'), ctx: {} }, { actions: BS.CARDS['26RBS03-094'].magic.by.MAIN.actions });
    return O.nexus.length; })()`);
  assert.equal(r, 0);
});

test('K-33 Salvador: TREAT_LV2 makes a Cyantree Spirit LV2 for the turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Cyantree') && c.levels.length > 1);
    P.spirits.length = 0; const s = BS.mkInst(c.id); s.cores = c.levels[0].cores; P.spirits.push(s);
    const lv0 = BS.lvNo(s);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-X14'), ctx: {} }, { actions: BS.CARDS['26RBS03-X14'].effects.find(e => e.trigger === 'START_ATTACK').actions });
    return [lv0, BS.lvNo(s)]; })()`);
  assert.deepEqual(r, [1, 2]);
});

test('K-34 Wyll-Gale: sends two cores from the opposing attacking Spirit only', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(4, 3000), b = opp(4, 3000); a.cores = 3; b.cores = 3; BS.G.attacker = a;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS02-019'), ctx: {} }, { actions: BS.CARDS['26RBS02-019'].effects[0].actions });
    return [a.cores, b.cores]; })()`);
  assert.deepEqual(r, [1, 3]);
});

test('K-35 Collet: refreshes a Wollaguard Spirit that then cannot attack this turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('Wollaguard'));
    P.spirits.length = 0; const s = BS.mkInst(c.id); s.cores = 1; s.exhausted = true; P.spirits.push(s);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-032'), ctx: {} }, { actions: BS.CARDS['26RBS03-032'].effects[0].actions });
    return [s.exhausted, s.noAtkTurn === BS.G.turnNo]; })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-36 Level Up: TREAT_LV2 self+battle lasts only while that battle runs; firstBlock counts blocks', async () => {
  const { page } = await quietBoard();
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
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit');
    P.spirits.length = 0; const a = BS.mkInst('26RBS01-066'), b = BS.mkInst(c.id); a.exhausted = b.exhausted = true; P.spirits.push(b, a);
    const fx = BS.CARDS['26RBS01-066'].effects.find(e => e.trigger === 'END_STEP');
    await BS.runActions({ p: P, opp: O, src: a, ctx: {} }, { actions: fx.actions });
    return [a.exhausted, b.exhausted]; })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-38 Lupes: REVEAL_PICK discard sends the picked card to the Trash, not the Hand', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const fam = Object.values(BS.CARDS).find(c => (c.families || []).includes('Beastleptic'));
    P.deck.unshift(BS.mkInst(fam.id)); const h = P.hand.length, t = P.trash.length;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-015'), ctx: {} }, { actions: BS.CARDS['26RBS03-015'].effects.find(e => e.trigger === 'DESTROYED').actions });
    return [P.hand.length - h, P.trash.length - t]; })()`);
  assert.deepEqual(r, [0, 1]);
});

test('K-39 Galesion: EXHAUST_OPP heavy+oppChooses heavy exhausts a refreshed opposing Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(4, 3000); a.exhausted = false;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-028'), ctx: {} }, { actions: BS.CARDS['26RBS03-028'].effects[0].actions });
    return [a.exhausted, !!a.heavy]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-40 Mandia: CRUSH n:6 discards six opposing decktop cards', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const n = O.deck.length, t = O.trash.length;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS02-070'), ctx: {} }, { actions: BS.CARDS['26RBS02-070'].effects.find(e => e.trigger === 'ALLY_LIFE_HIT').actions });
    return [n - O.deck.length, O.trash.length - t]; })()`);
  assert.deepEqual(r, [6, 6]);
});

test('K-41 Deep Strike: BY(PAY_COST) then heavy exhaust an exhausted opposing Spirit', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = opp(4, 3000); a.exhausted = true; const before = BS.coresAvailable(P);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RDB01-059'), ctx: {} }, { actions: [{ do: 'BY', cost: { do: 'PAY_COST', n: 1 }, then: [{ do: 'HEAVY_EXHAUST_OPP', n: 1, exhaustedOnly: true }] }] });
    return [before - BS.coresAvailable(P), !!a.heavy]; })()`);
  assert.deepEqual(r, [1, true]);
});

test('K-42 Aloe Toll: BP_TARGET match.tr only boosts a Spirit in True Release state', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const t = BS.mkInst('26RDB01-X03'); t.cores = 4; const n = BS.mkInst('26RDB01-015'); n.cores = 2; P.spirits.push(t, n);
    const e = BS.CARDS['26RDB01-016'].effects.find(x => x.invoke);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RDB01-016'), ctx: {} }, { actions: e.actions });
    return [t.bpMod || 0, n.bpMod || 0]; })()`);
  assert.deepEqual(r, [2000, 0]);
});

test('K-43 Marie Dog: BP_PLUS pick:3 boosts only three of four own Spirits', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const L = ['26RDB01-015', '26RDB01-016', '26RDB01-017', '26RDB01-015'].map(id => { const s = BS.mkInst(id); s.cores = 2; P.spirits.push(s); return s; });
    P.cpu = true;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RDB01-037'), ctx: {} }, { actions: BS.CARDS['26RDB01-037'].effects.find(e => e.trigger === 'START_ATTACK').actions });
    return L.filter(s => s.bpMod === 2000).length; })()`);
  assert.equal(r, 3);
});

test('K-44 Allurement: REVEAL_PICK peek sets prev only for a matching card and returns it', async () => {
  const { page } = await quietBoard();
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
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const f = Object.keys(BS.CARDS).filter(k => (BS.CARDS[k].families || []).includes('Wollaguard'));
    const out = [];
    for (const ty of ['Spirit', 'Magic']) { P.deck.unshift(BS.mkInst(f.find(k => BS.CARDS[k].type === ty))); const c = { p: P, opp: O, src: BS.mkInst('26RBS03-040'), ctx: {} };
      await BS.runActions(c, { actions: [{ do: 'REVEAL_PICK', n: 1, match: { family: ['Wollaguard'], typeAny: ['Spirit', 'Nexus'] }, rest: 'bottom' }] }); out.push(P.hand.length); }
    return out; })()`);
  assert.deepEqual(r, [1, 1]);
});

test('K-46 Kolulu: peek + pickedCostIn branches on the revealed cost', async () => {
  const { page } = await quietBoard();
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
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const id = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Beastleptic') && BS.CARDS[k].type === 'Spirit');
    P.trash.push(BS.mkInst(id)); const out = [];
    for (const fam of [false, true]) { if (fam) P.deck.unshift(BS.mkInst(id), BS.mkInst(id)); const h = P.hand.length;
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS02-016'), ctx: {} }, { actions: [{ do: 'MILL', n: fam ? 2 : 1 }, { do: 'RETURN_TRASH', match: { family: ['Beastleptic'] }, anyType: true, milled: true }] }); out.push(P.hand.length - h); }
    return out; })()`);
  assert.deepEqual(r, [0, 1]);
});

test('K-48 Balaculus: costPer lowers the Hand cost by 2 per Abyssen Spirit, capped at 8', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const card = BS.CARDS['26RSD10-009'], ab = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Abyssen') && BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].reduction.length), out = [BS.effCost(P, card)];
    for (let i = 0; i < 5; i++) { P.spirits.push(BS.mkInst(ab)); out.push(BS.effCost(P, card)); }
    return out; })()`);
  assert.equal(r[0] - r[1], 2);
  assert.equal(r[0] - r[5], 8);
});

test('K-49 Gnutarius/Roaspis: perLegacy / nLegacy scale with the EX Symbols banished', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const out = [];
    for (const n of [0, 2]) { const src = BS.mkInst('26RBS02-072'); src.legacyN = n; P.spirits.push(src);
      const nx = [BS.mkInst('26RBS01-105'), BS.mkInst('26RBS01-105'), BS.mkInst('26RBS01-105')]; P.nexus.push(...nx);
      const before = nx.map(x => x.cores);
      await BS.runActions({ p: P, opp: O, src, ctx: {} }, { actions: [{ do: 'VOID_TO_CARD', n: 1, to: 'anyNexus', perLegacy: true }] });
      out.push(nx.filter((x, i) => x.cores > before[i]).length); P.nexus.length = 0; P.spirits.length = 0; }
    const r = BS.mkInst('26RBS02-018'); r.legacyN = 3; P.spirits.push(r); const d0 = P.deck.length, t0 = P.trash.length;
    await BS.runActions({ p: P, opp: O, src: r, ctx: {} }, { actions: [{ do: 'REVEAL_PICK', n: 1, nLegacy: true, match: { typeAny: ['Spirit', 'Nexus', 'Magic'] }, rest: 'bottom', discard: true }] });
    out.push([P.deck.length - d0, P.trash.length - t0]); return out; })()`);
  assert.deepEqual(r.slice(0, 2), [0, 2]); assert.deepEqual(r[2], [-1, 1]);
});

test('K-50 Diagram Dragon / Etaina: OPP_DESTROYED_FX filters on the destroying source and 0 BP', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    G.step = 5; const td = Object.keys(BS.CARDS).find(k => (BS.CARDS[k].families || []).includes('Thunder Dragon') && BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost <= 4 && !BS.CARDS[k].effects);
    const out = [];
    for (const src of ['26RBS02-055', '26RBS02-087']) {      // a Spirit source, then a Magic source
      const dd = BS.mkInst('26RBS02-055'); dd.cores = 5; const x = BS.mkInst(td); x.cores = 1; x.exhausted = true; P.spirits.push(dd, x); const t = opp(3, 2000);
      const s = src === '26RBS02-055' ? dd : BS.mkInst(src);
      await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'DESTROY', bpLe: 3000 }] }); await BS.flushBursts();
      out.push(x.exhausted); P.spirits.length = 0; O.spirits.length = 0; }
    return out; })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-51 Charging Pyramid: a Thunder Dragon Magic kill gives the Nexus one extra Yellow symbol this turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    G.step = 5; const out = [];
    for (const src of ['26RSD05-011', '26RBS02-087']) {      // Thunder Dragon Magic, then another Magic
      const pyr = BS.mkInst('26RBS01-105'); pyr.cores = 3; P.nexus.push(pyr); const t = opp(3, 2000); const t2 = opp(3, 2000);
      await BS.runActions({ p: P, opp: O, src: BS.mkInst(src), ctx: {} }, { actions: [{ do: 'DESTROY', bpLe: 3000 }] }); await BS.flushBursts();
      out.push(pyr.symTurn ? pyr.symTurn.cols.join() : ''); P.nexus.length = 0; O.spirits.length = 0; }
    return out; })()`);
  assert.deepEqual(r, ['yellow', '']);
});

test('K-52 SUMMON_SYMBOL: Quarry Plain / War Feat give extra Field symbols only while paying for a matching card at LV2', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const cost = id => BS.effCost(P, BS.CARDS[id]);
    const out = [];
    const q = BS.mkInst('26RSD04-009'); P.nexus.push(q);
    for (const cores of [0, 2]) { q.cores = cores; out.push(cost('26RBS02-049'), cost('26RBS03-042'), cost('26RBS01-070')); }
    P.nexus.length = 0;
    const w = BS.mkInst('26RBS03-082'); P.nexus.push(w);
    const two = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost === 2 && BS.CARDS[k].symbol === 'blue').slice(0, 2);
    for (const k of two) P.spirits.push(BS.mkInst(k));
    for (const cores of [0, 2]) { w.cores = cores; out.push(cost('26RBS01-070')); }
    return out; })()`);
  assert.equal(r[0], 7, 'Quarry Plain (LV1-2): its own white symbol plus the extra one pay two of the Cost 9 Mineroid');
  assert.equal(r[2], 6, 'a non-Mineroid gets no extra symbol');
  assert.ok(r[7] < r[6], 'War Feat LV2 makes a Cost 6+ Topaz cheaper');
});

test('K-53 Algodon: block refresh and the LV2 blocker-win core', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const a = BS.mkInst('26RBS03-033'); a.cores = 3; a.exhausted = true; P.spirits.push(a);
    const fx = BS.CARDS['26RBS03-033'].effects;
    await BS.runActions({ p: P, opp: O, src: a, ctx: {} }, { actions: fx[0].actions });
    P.void = 2; const rs = P.reserve.n;
    await BS.runActions({ p: P, opp: O, src: a, ctx: {} }, { actions: fx[1].actions });
    return [a.exhausted, fx[0].trigger, fx[1].blockingOnly, P.void, P.reserve.n - rs]; })()`);
  assert.deepEqual(r.slice(0, 3), [false, 'BLOCKS', true]);
  assert.deepEqual(r.slice(3), [1, 1], 'one Void core moved to the Reserve');
});

test('K-54 Borzo-Inu: draws two only after an opposing Spirit was destroyed by your effect this turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const acts = BS.CARDS['26RBS01-026'].effects[0].actions, out = [];
    for (const kill of [false, true]) {
      P.hand = []; P.deck = Array.from({ length: 5 }, () => ({ id: '26RBS01-026' })); P.oppFxLossTurn = null;
      if (kill) { const t = opp(3, 2000); await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS01-026'), ctx: {} }, { actions: [{ do: 'DESTROY', bpLe: 3000 }] }); await BS.flushBursts(); }
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS01-026'), ctx: {} }, { actions: acts }); out.push(P.hand.length); }
    return out; })()`);
  assert.deepEqual(r, [1, 2]);
});

test('K-55 trashGe: counts matching cards in your own Trash (Angelic Feather Song refresh gate)', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const mg = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Magic' && (BS.CARDS[k].families || []).includes('Sword Eye')).slice(0, 2);
    const c = { if: { trashGe: { n: 2, match: { family: ['Sword Eye'], type: 'Magic' } } } };
    const out = [];
    const chk = () => BS.fxIf(P, O, c.if);
    P.trash = []; out.push(chk()); P.trash = mg.map(id => ({ id })); out.push(chk());
    return [mg.length, ...out]; })()`);
  assert.deepEqual(r, [2, false, true]);
});

test('K-56 Angelic Feather Song: -2000 BP kills a 2000 BP Spirit and refreshes exactly one Cost 5+ Sword Eye Spirit when two Sword Eye Magic are in the Trash', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const id = k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Sword Eye') && BS.CARDS[k].cost >= 5;
    const sp = Object.keys(BS.CARDS).filter(id).slice(0, 2);
    const mg = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Magic' && (BS.CARDS[k].families || []).includes('Sword Eye')).slice(0, 2);
    const out = [];
    for (const n of [1, 2]) {
      P.spirits.length = 0; O.spirits.length = 0; P.trash = mg.slice(0, n).map(i => ({ id: i }));
      const a = sp.map(k => { const s = BS.mkInst(k); s.exhausted = true; P.spirits.push(s); return s; });
      opp(3, 2000);
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RSD08-012'), ctx: {} }, { actions: BS.CARDS['26RSD08-012'].magic.actions }); await BS.flushBursts();
      out.push(O.spirits.length, a.filter(s => !s.exhausted).length); }
    return [sp.length, mg.length, ...out]; })()`);
  assert.deepEqual(r, [2, 2, 0, 0, 0, 1]);
});

test('K-57 Blackshar: sends a core only after one of your Spirits was destroyed this turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const act = () => BS.CARDS['26RBS02-014'].effects[0].actions;
    const out = [];
    for (const lost of [false, true]) {
      O.spirits.length = 0; P.lostSpiritTurn = lost ? G.turnNo : -1; opp(3, 2000);
      O.spirits[0].cores = 2; const before = O.spirits[0].cores;
      await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS02-014'), ctx: {} }, { actions: act() }); await BS.flushBursts();
      out.push(before - O.spirits[0].cores); }
    return out; })()`);
  assert.deepEqual(r, [0, 1]);
});

test('K-58 Hammergrau: EXHAUST_OPP noSoul skips a Spirit holding the Soul Core', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    O.spirits.length = 0; opp(3, 2000); opp(3, 2000);
    O.spirits[0].soul = true;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS01-039'), ctx: {} }, { actions: [{ do: 'EXHAUST_OPP', n: 1, noSoul: true }] }); await BS.flushBursts();
    return O.spirits.map(s => !!s.exhausted); })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-59 Vitality Woods: NEXUS_EXHAUST draws only in your Attack Step with four or fewer cards in hand', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const card = BS.CARDS['26RBS01-108']; card.effects.push({ trigger: 'ACTIVATE', once: false, cost: { exhaustSelf: true }, actions: [{ do: 'DRAW', n: 1 }] });
    const out = [];
    for (const [step, hand] of [[5, 2], [5, 5], [3, 2]]) {
      P.nexus.length = 0; const nx = BS.mkInst('26RBS01-108'); nx.cores = 6; P.nexus.push(nx);
      G.step = step; P.hand = P.hand.slice(0, 0); for (let i = 0; i < hand; i++) P.hand.push(BS.mkInst(Object.keys(BS.CARDS)[0]));
      const idx = card.effects.length - 1; await BS.activateFx(P, nx, idx);
      out.push(P.hand.length - hand); }
    card.effects.pop(); return out; })()`);
  assert.deepEqual(r, [2, 1, 1]);
});

test('K-60 Argentoll: AMPLIFY trigger puts a core from the Void into the Reserve once per turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; O.spirits.length = 0; P.void = 3; G.step = 5; G.active = P.key;
    const arg = BS.mkInst('26RBS02-041'); arg.cores = 6; P.spirits.push(arg);
    const amp = BS.mkInst('26RBS01-048'); amp.cores = 6; P.spirits.push(amp); G.attacker = amp;
    const ei = BS.CARDS['26RBS01-048'].effects.findIndex(e => e.invoke); const before = P.void;
    const ok = await BS.activateFx(P, amp, ei); const one = before - P.void; if (!ok) return ['act-false', BS.activatable(P, amp).length, G.step, G.attacker === amp];
    return [ei >= 0, one]; })()`);
  assert.deepEqual(r, [true, 1]);
});

test('K-61 Poppy: ALLY_LIFE_HIT diffName loots only for an EX-AID Spirit with another name, once per turn', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; const pop = BS.mkInst('26RCB01-046'); pop.cores = 6; P.spirits.push(pop);
    const other = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && (c.families || []).includes('EX-AID') && c.name !== BS.CARDS['26RCB01-046'].name);
    const o = BS.mkInst(other.id); o.cores = 6; P.spirits.push(o);
    const d = () => P.hand.length, out = [];
    let h = d(); await BS.fireFx(P, 'ALLY_LIFE_HIT', pop, { attacker: pop }); out.push(d() - h);
    h = d(); await BS.fireFx(P, 'ALLY_LIFE_HIT', o, { attacker: o }); out.push(d() - h);
    h = d(); await BS.fireFx(P, 'ALLY_LIFE_HIT', o, { attacker: o }); out.push(d() - h);
    return out; })()`);
  assert.deepEqual(r, [0, 1, 0]);
});

test('K-62 Renki: byOwnFx returns it to the Hand only when your Beastleptic/Phantasprite effect destroyed it', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const fam = Object.values(BS.CARDS).find(c => (c.families || []).includes('Beastleptic') && c.id !== '26RBS03-013');
    const out = [];
    for (const src of [fam.id, '26RBS02-009']) {
      P.spirits.length = 0; P.hand.length = 0; P.trash.length = 0;
      const rk = BS.mkInst('26RBS03-013'); rk.cores = 3; P.spirits.push(rk);
      await BS.runActions({ p: P, opp: O, src: BS.mkInst(src), ctx: {} }, { actions: [{ do: 'DESTROY_OWN', match: { name: 'Renki' } }] }); await BS.flushBursts();
      out.push(P.hand.some(h => h.id === '26RBS03-013'), P.trash.some(h => h.id === '26RBS03-013')); }
    return out; })()`);
  assert.deepEqual(r, [true, false, false, true]);
});

test('K-63 Steguman: ACTIVATE_SUMMONED runs a Topaz Spirit\'s When Summoned effect', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; const t = BS.mkInst('26RBS01-073'); t.cores = 3; P.spirits.push(t);
    const a = BS.mkInst('26RBS01-070'); P.life = 1; P.void = 2;
    await BS.runActions({ p: P, opp: O, src: a, ctx: {} }, { actions: [{ do: 'ACTIVATE_SUMMONED', match: { family: ['Topaz'] } }] }); await BS.flushBursts();
    const hit = [P.life, P.void];
    P.spirits.length = 0; P.life = 1; P.void = 2;
    await BS.runActions({ p: P, opp: O, src: a, ctx: {} }, { actions: [{ do: 'ACTIVATE_SUMMONED', match: { family: ['Topaz'] } }] });
    return [hit, [P.life, P.void]]; })()`);
  assert.deepEqual(r, [[2, 1], [1, 2]]);
});

test('K-64 Coela-Canth: VOID_TO_MATCHING other + exhausted ctrl', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const fish = Object.values(BS.CARDS).find(c => (c.families || []).includes('Armored Fish') && c.type === 'Spirit' && c.id !== '26RSD03-006');
    P.spirits.length = 0; const cc = BS.mkInst('26RSD03-006'); cc.cores = 1; const f = BS.mkInst(fish.id); f.cores = 1; P.spirits.push(cc, f); P.void = 2;
    await BS.runActions({ p: P, opp: O, src: cc, ctx: {} }, { actions: [{ do: 'VOID_TO_MATCHING', targets: 1, other: true, match: { family: ['Armored Fish'] } }] });
    const a = [cc.cores, f.cores];
    const cond = { ctrl: { n: 1, type: 'Spirit', family: 'Armored Fish', exhausted: true } };
    const x = BS.fxIf(P, O, cond, {}); f.exhausted = true; const y = BS.fxIf(P, O, cond, {});
    return [a, x, y]; })()`);
  assert.deepEqual(r, [[1, 2], false, true]);
});

test('K-65 Banri-Sora: ctrl team exhausted n:2, TRASH_CORES_TO toSelf perDestroyed', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const st = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && /\\[Teams?:[^\\]]*Red Stella/.test(c.desc || c.text || '') && c.id !== '26RDB01-013');
    P.spirits.length = 0; const b = BS.mkInst('26RDB01-013'); b.cores = 1; const s1 = BS.mkInst(st.id), s2 = BS.mkInst(st.id); P.spirits.push(b, s1, s2);
    const cond = { ctrl: { n: 2, type: 'Spirit', team: 'Red Stella', exhausted: true } };
    const x = BS.fxIf(P, O, cond, {}); s1.exhausted = true; const y = BS.fxIf(P, O, cond, {}); s2.exhausted = true; const z = BS.fxIf(P, O, cond, {});
    const cx = {}; P.trashCores.n = 5;
    await BS.runActions({ p: P, opp: O, src: b, ctx: cx }, { actions: [{ do: 'TRASH_CORES_TO', n: 1, toSelf: true, perDestroyed: true }] });
    const none = b.cores; cx.destroyedN = 2;
    await BS.runActions({ p: P, opp: O, src: b, ctx: cx }, { actions: [{ do: 'TRASH_CORES_TO', n: 1, toSelf: true, perDestroyed: true }] });
    return [x, y, z, none, b.cores]; })()`);
  assert.deepEqual(r, [false, false, true, 1, 3]);
});

test('K-66 Gigantocheires: BOUNCE_OPP any bpLe Spirit-only, spiritCore, nexusSymbol', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const g = BS.mkInst('26RBS01-X12'); g.cores = 2; P.spirits.length = 0; P.spirits.push(g); P.void = 3;
    const act = { do: 'BOUNCE_OPP', kind: 'any', to: 'hand', bpLe: 6000, spiritCore: true, nexusSymbol: 'white' };
    O.spirits.length = 0; O.nexus.length = 0; opp(3, 3000);
    await BS.runActions({ p: P, opp: O, src: g, ctx: {} }, { actions: [act] }); await BS.flushBursts();
    const a = [O.spirits.length, g.cores, !!g.symTurn];
    O.spirits.length = 0; const nx = BS.mkInst(Object.values(BS.CARDS).find(c => c.type === 'Nexus').id); O.nexus.push(nx);
    await BS.runActions({ p: P, opp: O, src: g, ctx: {} }, { actions: [act] }); await BS.flushBursts();
    return [a, O.nexus.length, g.cores, g.symTurn && g.symTurn.cols.join()]; })()`);
  assert.deepEqual(r, [[0, 3, false], 0, 3, 'white']);
});

test('K-67 Flame Storm: DESTROY_TOTAL max enforces the number of targets', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    O.spirits.length = 0; for (let i = 0; i < 5; i++) opp(1, 1000);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-087'), ctx: {} }, { actions: [{ do: 'DESTROY_TOTAL', total: 7000, max: 3 }] }); await BS.flushBursts();
    return O.spirits.length; })()`);
  assert.equal(r, 2);
});

test('K-68 Swordish Comes: ctrl refreshed counts only refreshed Swordish', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const T = '26RSD10-T001', c = { ctrl: { type: 'Spirit', name: 'Swordish', refreshed: true, nLe: 0 } };
    P.tokens = { [T]: 10 }; P.reserve.n = 5;
    const a = BS.fxIf(P, O, c, {}); const t = BS.sendToken(P, T);
    const b = BS.fxIf(P, O, c, {}); t.exhausted = true;
    return [a, b, BS.fxIf(P, O, c, {})]; })()`);
  assert.deepEqual(r, [true, false, true]);
});

test('K-69 War Toll: HAND_TO_BOTTOM then SEND_TOKEN (Life 2 sends two)', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const T = '26RSD10-T001'; P.tokens = { [T]: 10 }; P.reserve.n = 8; P.cpu = true; P.life = 2;
    const id = '26RBS03-078', eff = BS.CARDS[id].effects.filter(e => e.trigger === 'END_STEP' && (!e.if || BS.fxIf(P, O, e.if, {})));
    P.hand.length = 0; for (let i = 0; i < 3; i++) P.hand.push(BS.mkInst('26RBS01-037'));
    const d0 = P.deck.length;
    for (const e of eff) await BS.runActions({ p: P, opp: O, src: BS.mkInst(id), ctx: {} }, e, 'END_STEP');
    return [eff.length, P.hand.length, P.deck.length - d0, P.spirits.length]; })()`);
  assert.equal(r[0], 1);
  assert.equal(r[1], 2);
  assert.equal(r[2], 1);
  assert.ok(r[3] >= 1);
});
