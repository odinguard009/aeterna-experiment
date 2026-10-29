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
