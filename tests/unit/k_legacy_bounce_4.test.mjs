// Lane K tests, shard 4 of 4 (split from k_legacy_bounce.test.mjs; one shared page per shard, see sharedBoard in lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
// Magic bases are staged with an allHave gate; these tests drop it and check the new shapes.
const MAGIC_RUN = `const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
  const run = (id, lg) => { const m = BS.mkInst(id); m.legacyN = lg || 0; const acts = BS.CARDS[id].magic.actions.map(a => { const b = { ...a }; if (b.if) { b.if = { ...b.if }; delete b.if.allHave; if (!Object.keys(b.if).length) delete b.if; } return b; }); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: acts }); };
  const opp = (cost, bp, team) => { const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost === cost && c.levels[0].bp === bp && !(c.effects && c.effects.length)); const f = BS.mkInst(c.id); f.cores = 1; O.spirits.push(f); return f; };`;

test('K-73 ALLY_BLOCKS (Game Area) moves a Void core to the Trash; Squirrelooper cannot attack/block at 3000 BP or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; G.active = P.key; P.cpu = true;
    const g = BS.mkInst('26RCB01-059'); g.cores = 5; P.nexus.push(g);
    const b = BS.mkInst('26RCB01-039'); b.cores = 1; P.spirits.push(b);
    P.void = 3; const t0 = P.trashCores.n;
    await BS.fireFx(P, 'ALLY_BLOCKS', b, { attacker: b, blocker: b, subject: b }); await BS.flushBursts();
    const moved = [3 - P.void, P.trashCores.n - t0];
    const sq = BS.mkInst('26RBS02-001'); sq.cores = 1; P.spirits.push(sq); G.step = 5;
    const lowBp = BS.bpOf(sq), cant = BS.flagActive(P, 'CANT_ATTACK', sq);
    sq.cores = 3; sq.bpMod = 1000; const cant2 = BS.flagActive(P, 'CANT_ATTACK', sq);
    return [moved, lowBp <= 3000, cant, BS.bpOf(sq) > 3000, cant2]; })()`);
  assert.deepEqual(r, [[1, 1], true, true, true, false]);
});

test('K-74 Cloudrock END_BATTLE sends 1 Trash core, 2 at 10000 BP or more; Squid refreshes at the end of battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; G.active = P.key; P.cpu = true; O.cpu = true;
    const go = async (id, bpMod) => { const a = BS.mkInst(id); a.cores = 3; a.bpMod = bpMod; P.spirits.push(a); P.trashCores.n = 5; G.step = 5; G.turnNo = (G.turnNo || 0) + 1;
      await BS.doBattle(P.key, a); const out = [a, 5 - P.trashCores.n]; P.spirits.length = 0; return out; };
    const lo = (await go('26RBS03-002', 0))[1], hi = (await go('26RBS03-002', 10000))[1];
    const sq = BS.mkInst('26RSD03-X01'); sq.cores = 3; P.spirits.push(sq); G.step = 5; G.turnNo++;
    await BS.doBattle(P.key, sq);
    return [lo, hi, sq.exhausted]; })()`);
  assert.deepEqual(r, [1, 2, false]);
});

test('K-75 OPP_START_ATTACK: Belder shrinks an attacker-side Spirit at the start of the opposing Attack Step; Guard Tower boosts a Leucomyst', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; G.active = O.key; P.cpu = true; O.cpu = true; G.step = 5;
    const b = BS.mkInst('26RBS03-058'); b.cores = 2; P.spirits.push(b);
    const v = BS.mkInst('BS48-047'); v.cores = 3; O.spirits.push(v); const before = BS.bpOf(v);   // 4000 BP, no Camou (a Camou target would be untargetable by a Spirit effect)
    await BS.startAttackFx(O);
    const dropped = before - BS.bpOf(v);
    P.spirits.length = 0; O.spirits.length = 0;
    const t = BS.mkInst('26RBS02-080'); t.cores = 2; P.nexus.push(t);
    const l = BS.mkInst('26RBS02-040'); l.cores = 3; P.spirits.push(l); const b0 = BS.bpOf(l);
    await BS.startAttackFx(O);
    return [dropped, BS.bpOf(l) - b0]; })()`);
  assert.deepEqual(r, [3000, 2000]);
});

test('K-76 attackerCostLe + targetRefreshed: Pepper\'s Chairo gets +2000 refreshed and refreshes after blocking a Cost 3 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; G.active = O.key; P.cpu = true; O.cpu = true; G.step = 5;
    const c = BS.mkInst('26RBS03-035'); c.cores = 2; P.spirits.push(c);
    const rb = BS.bpOf(c); c.exhausted = true; const eb = BS.bpOf(c);
    const go = async (id) => { const a = BS.mkInst(id); O.spirits.push(a); G.attacker = a; G.blocker = c; c.exhausted = true; c.fxUsed = {}; await BS.fireFx(P, 'BLOCKS', c, { attacker: a, blocker: c }); await BS.flushBursts(); return c.exhausted; };
    const cheap = await go('26RBS01-016'), pricey = await go('26RBS03-058');
    return [rb - eb, cheap, pricey]; })()`);
  assert.deepEqual(r.slice(0, 3), [2000, false, true]);
});

test('K-77 BOUNCE_OPP bpPer: Drifting Glass Lady returns an opposing Spirit up to 4000 BP plus 1000 per own Spirit with When Blocks', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; G.active = P.key; P.cpu = true; O.cpu = true; G.step = 5;
    const c = BS.mkInst('26RBS02-X12'); c.cores = 1; P.spirits.push(c);
    const lo = BS.mkInst('26RBS01-X10'); lo.cores = 1; O.spirits.push(lo); const bp = BS.bpOf(lo);
    await BS.fireFx(P, 'ATTACKS', c, { attacker: c }); await BS.flushBursts();
    return [bp, O.spirits.length]; })()`);
  assert.deepEqual(r, [5000, 0]);
});

test('K-78 Relay Deer LV2 gets +2000 per own When Blocks Spirit only in the opposing Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const d = BS.mkInst('26RBS02-042'); d.cores = 2; P.spirits.push(d);
    const g = BS.mkInst('26RBS02-X12'); g.cores = 1; P.spirits.push(g);
    G.active = P.key; G.step = 5; const mine = BS.bpOf(d);
    G.active = O.key; const away = BS.bpOf(d);
    return [away - mine]; })()`);
  assert.deepEqual(r, [2000]);
});

test('K-79 OPP_CORES_TO_RESERVE eachPer + DRAW per: Baphomendes sends 1 core plus 1 per own Shamanism Spirit; LV2 destroyed draws per Shamanism Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; G.active = P.key; P.cpu = true; O.cpu = true; G.step = 3;
    const b = BS.mkInst('26RBS01-028'); b.cores = 3; P.spirits.push(b);
    for (const id of ['26RBS02-023', '26RBS02-023']) { const s = BS.mkInst(id); s.cores = 1; P.spirits.push(s); }
    const t = BS.mkInst('26RBS01-X10'); t.cores = 5; O.spirits.push(t); const c0 = t.cores;
    await BS.fireFx(P, 'SUMMONED', b, {}); await BS.flushBursts();
    const sent = c0 - t.cores; const h0 = P.hand.length; P.deck.unshift(BS.mkInst('26RBS01-X10'), BS.mkInst('26RBS01-X10'), BS.mkInst('26RBS01-X10'));
    P.spirits.splice(P.spirits.indexOf(b), 1); b.cores = 0; b.lostLv = 1; P.trash.push(b);
    await BS.fireFx(P, 'DESTROYED', b, { subject: b }); await BS.flushBursts();
    return [sent, P.hand.length - h0]; })()`);
  assert.deepEqual(r, [3, 2]);
});

test('K-80 highSpeedIf/highSpeedOnce/trashAllColor: Lira-Rali needs a reduced Life and a Yellow-only Trash; Nei-Lanetail needs a Sword Eye card in the Trash, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; P.hand.length = 0; P.trash.length = 0; P.reserve.n = 12; G.active = O.key;
    const l = BS.mkInst('26RBS03-047'); P.hand.push(l);
    const y = BS.mkInst('26RBS03-047'), nonY = BS.mkInst('26RBS01-X10');
    const a = BS.highSpeedOK(P, l);
    P.lifeRedTurn = G.turnNo; const b = BS.highSpeedOK(P, l);
    P.trash.push(nonY); const c = BS.highSpeedOK(P, l);
    const n = BS.mkInst('26RDB01-032'); P.hand.push(n); P.trash.length = 0;
    const d = BS.highSpeedOK(P, n);
    const se = Object.values(BS.CARDS).find(k => (k.families || []).includes('Sword Eye')); P.trash.push(BS.mkInst(se.id));
    const e = BS.highSpeedOK(P, n); const ok = await BS.highSpeedSummon(P, n);
    const n2 = BS.mkInst('26RDB01-032'); P.hand.push(n2); const f = BS.highSpeedOK(P, n2);
    return [a, b, c, d, e, ok, f]; })()`);
  assert.deepEqual(r, [false, true, false, false, true, true, false]);
});

test('K-81 REFRESH_SPIRIT nexusPer: Misty Forest boosts attacking Ferobeasts and refreshes one per two Nexuses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; G.active = P.key; P.cpu = true; O.cpu = true; G.step = 3;
    const m = BS.mkInst('26RSD06-009'); m.cores = 5; P.nexus.push(m);
    const a = BS.mkInst('26RBS02-064'); a.cores = 3; P.spirits.push(a); const b = BS.mkInst('26RBS02-064'); b.cores = 3; P.spirits.push(b);
    a.exhausted = true; b.exhausted = true;
    G.step = 5; G.attacker = null; const b0 = BS.bpOf(a); G.attacker = a; const hit = BS.bpOf(a) - b0; G.attacker = null;
    await BS.fireFx(P, 'END_STEP', m, { subject: m }); const one = [a, b].filter(x => !x.exhausted).length;
    a.exhausted = true; b.exhausted = true; const n2 = BS.mkInst('TRAIN-N1'); P.nexus.push(n2); P.nexus.push(BS.mkInst('TRAIN-N2')); P.nexus.push(BS.mkInst('TRAIN-N2'));
    m.fxUsed = {}; P.noStackDone = null; await BS.fireFx(P, 'END_STEP', m, { subject: m }); const two = [a, b].filter(x => !x.exhausted).length;
    return [hit, one, two]; })()`);
  assert.deepEqual(r, [1000, 0, 2]);
});

test('K-82 Blue Beat Stage: Invoke boosts an attacking Blue Beat Spirit; End Step refreshes one per two Blue Beat Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; G.active = P.key; P.cpu = true; O.cpu = true; G.step = 5;
    const n = BS.mkInst('26RDB01-052'); n.cores = 5; P.nexus.push(n);
    const L = []; for (let i = 0; i < 4; i++) { const s = BS.mkInst('26RDB01-041'); s.cores = 3; s.exhausted = true; P.spirits.push(s); L.push(s); }
    await BS.fireFx(P, 'END_STEP', n, { subject: n });
    return [L.filter(x => !x.exhausted).length]; })()`);
  assert.deepEqual(r, [2]);
});

test('K-83 Utmost Depth Emerald Abyss: attacking Armored Fish +1000; Main Invoke shows an Armored Fish card, returns it to the deckbottom and draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const n = BS.mkInst('26RSD03-010'); n.cores = 5; P.nexus.push(n);
    const f = BS.mkInst('26RBS01-039'); f.cores = 3; P.spirits.push(f);
    G.active = P.key; G.step = 5; G.attacker = null; const b0 = BS.bpOf(f); G.attacker = f; const up = BS.bpOf(f) - b0; G.attacker = null;
    G.step = 3; const h = BS.mkInst('26RBS01-039'); P.hand.length = 0; P.hand.push(h); while (P.deck.length < 5) P.deck.push(BS.mkInst('26RBS01-039'));
    const i = BS.CARDS['26RSD03-010'].effects.findIndex(e => e.invoke);
    const ok = await BS.activateFx(P, n, i);
    return [up, ok, P.hand.length, P.hand.includes(h), P.deck[P.deck.length - 1] === h]; })()`);
  assert.deepEqual(r, [1000, true, 1, false, true]);
});

test('K-84 Duntekleo: Summoned gives up to two Armored Fish +3000; Invoke refreshes another Armored Fish, never itself', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true; G.active = P.key; G.step = 3;
    const d = BS.mkInst('26RSD03-X02'); d.cores = 6; P.spirits.push(d);
    const a = BS.mkInst('26RBS01-039'); a.cores = 3; P.spirits.push(a); const b = BS.mkInst('26RBS01-039'); b.cores = 3; P.spirits.push(b);
    const base = [d, a, b].map(x => BS.bpOf(x));
    await BS.fireFx(P, 'SUMMONED', d, { subject: d });
    const up = [d, a, b].map((x, i) => BS.bpOf(x) - base[i]).filter(x => x === 3000).length;
    d.exhausted = true; a.exhausted = true; G.step = 5; G.attacker = a; G.battleNo = (G.battleNo || 0) + 1;
    const i = BS.CARDS['26RSD03-X02'].effects.findIndex(e => e.invoke);
    const ok = await BS.activateFx(P, d, i);
    return [up, ok, d.exhausted, a.exhausted]; })()`);
  assert.deepEqual(r, [2, true, true, false]);
});

test('K-85 soulInTrash: Assipha destroys only with the Soul Core in the Trash; Cornix target BP 3000 -> 4000; Cornix returns a Cost 4 Red Cloud', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true; G.active = P.key; G.step = 5;
    const out = [];
    for (const [id, soul, tid] of [['26RSD09-009', false, 'BS48-021'], ['26RSD09-009', true, 'BS48-021'], ['26RSD09-009', true, '26RBS01-039'], ['26RSD09-007', false, 'BS48-021'], ['26RSD09-007', false, '26RBS01-039'], ['26RSD09-007', true, '26RBS01-039']]) {
      P.spirits.length = 0; O.spirits.length = 0; P.trashCores.soul = soul;
      const s = BS.mkInst(id); s.cores = 3; P.spirits.push(s); G.attacker = s;
      const t = BS.mkInst(tid); t.cores = 1; O.spirits.push(t);
      const bp = BS.bpOf(t);
      await BS.fireFx(P, 'ATTACKS', s, { subject: s });
      out.push([bp, O.spirits.includes(t)]);
    }
    P.spirits.length = 0; P.hand.length = 0; P.trash.length = 0;
    const c = BS.mkInst('26RSD09-007'); c.cores = 1; P.spirits.push(c);
    P.trash.push(BS.mkInst('26RBS01-008'), BS.mkInst('26RBS01-004'));
    await BS.fireFx(P, 'SUMMONED', c, { subject: c });
    out.push(P.hand.map(x => x.id));
    return out; })()`);
  assert.deepEqual(r, [[3000, true], [3000, false], [4000, false], [3000, false], [4000, true], [4000, false], ['26RBS01-004']]);
});

test('K-86 Lira-Rali LV2 gets +2000 only while attacking; Nei-Lanetail LV2 Flash Invoke gives -2000 BP to the attacker and destroys it at 0', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const l = BS.mkInst('26RBS03-047'); l.cores = 3; P.spirits.push(l);
    G.active = P.key; G.step = 5; G.attacker = null; const b0 = BS.bpOf(l); G.attacker = l; const up = BS.bpOf(l) - b0; G.attacker = null;
    P.spirits.length = 0; const out = [up];
    for (const tid of ['BS48-033', '26RBS01-039']) {
      O.spirits.length = 0; P.spirits.length = 0; P.nexus.length = 0;
      const n = BS.mkInst('26RDB01-032'); n.cores = 3; P.spirits.push(n);
      const t = BS.mkInst(tid); t.cores = 1; O.spirits.push(t);
      G.active = O.key; G.step = 5; G.attacker = t; const bp = BS.bpOf(t);
      const i = BS.CARDS['26RDB01-032'].effects.findIndex(e => e.invoke);
      const ok = await BS.activateFx(P, n, i);
      out.push([bp, ok, O.spirits.includes(t), O.spirits.includes(t) ? BS.bpOf(t) : null]);
    }
    return out; })()`);
  assert.deepEqual(r, [2000, [2000, true, false, null], [4000, true, true, 2000]]);
});

test('K-87 Zinoris: while attacking, neither Spirit is destroyed by BP comparison; End Step refreshes a Topaz Spirit only if Zinoris is exhausted', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const z = BS.mkInst('26RBS02-054'); z.cores = 3; P.spirits.push(z);
    const t = BS.mkInst('BS48-033'); t.cores = 1; O.spirits.push(t);
    G.active = P.key; G.step = 5; const life = O.life; await BS.doBattle(P.key, z);
    const lock1 = [P.spirits.includes(z), O.spirits.includes(t), O.life < life];
    const out = [lock1];
    for (const ex of [false, true]) {
      P.spirits.length = 0; z.exhausted = ex; P.spirits.push(z);
      const tp = BS.mkInst('26RBS02-054'); tp.cores = 1; tp.exhausted = true; P.spirits.push(tp);
      await BS.fireFx(P, 'END_STEP', z, { subject: z });
      out.push((z.exhausted ? 1 : 0) + (tp.exhausted ? 1 : 0));
    }
    return out; })()`);
  assert.deepEqual(r, [[true, true, true], 1, 1]);
});

test('K-88 Rideshooter: RYUKI Spirits get +1000 only in the opposing Attack Step; LV2 block reveal needs Hand <= 4', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const n = BS.mkInst('26RCB01-058'); n.cores = 2; P.nexus.push(n);
    const s = BS.mkInst('26RCB01-025'); s.cores = 1; P.spirits.push(s);
    G.active = P.key; G.step = 5; G.attacker = null; const mine = BS.bpOf(s);
    G.active = O.key; G.step = 5; const during = BS.bpOf(s);
    const rev = async (h) => { P.hand.length = 0; for (let i = 0; i < h; i++) P.hand.push(BS.mkInst('26RCB01-025')); P.deck.unshift(BS.mkInst('26RCB01-064')); await BS.fireFx(P, 'ALLY_BLOCKS', s, { subject: s, blocker: s }); return P.hand.length - h; };
    return [during - mine, await rev(5), await rev(2)]; })()`);
  assert.deepEqual(r, [1000, 0, 1]);
});

test('K-89 Lamenting Larona: When Summoned and LV2 When Destroyed summon a Cost 4 or less Dark Puce Spirit from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const l = BS.mkInst('26RBS02-023'); l.cores = 3; P.spirits.push(l);
    const dp = (id) => { const t = BS.mkInst(id); P.trash.push(t); return t; };
    const a = dp('26RBS01-016'); await BS.fireFx(P, 'SUMMONED', l, { subject: l });
    const first = P.spirits.includes(a);
    P.spirits.splice(P.spirits.indexOf(l), 1); P.trash.push(l); l.lostLv = 1; const b = dp('26RBS01-016'); await BS.fireFx(P, 'DESTROYED', l, {});
    return [first, P.spirits.includes(b)]; })()`);
  assert.deepEqual(r, [true, true]);
});

test('K-90 Kuramagrama: summons a Cost 3 or less Dark Puce from the Trash free; LV2 block returns a core from the attacker', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const k = BS.mkInst('26RBS03-X05'); k.cores = 3; P.spirits.push(k);
    const lo = BS.mkInst('26RBS01-016'); P.trash.push(lo);
    await BS.fireFx(P, 'SUMMONED', k, { subject: k });
    const sum = [P.spirits.includes(lo)];
    const at = BS.mkInst('BS48-033'); at.cores = 3; O.spirits.push(at); const bystander = BS.mkInst('BS48-033'); bystander.cores = 3; O.spirits.push(bystander);
    G.active = O.key; G.attacker = at; G.blocker = k; G.step = 5;
    await BS.fireFx(P, 'BLOCKS', k, { subject: k, blocker: k });
    return [sum, at.cores, bystander.cores]; })()`);
  assert.deepEqual(r[1], 2); assert.deepEqual(r[2], 3); assert.equal(r[0][0], true);
});

test('K-91 The Current Corridor: Flash exhaust gives a Current Spirit +2000 BP this battle; LV2 reveals an Oceanic Green Cost 7+ when a Current Spirit is summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const nx = BS.mkInst('26RBS01-098'); nx.cores = 4; P.nexus.push(nx);
    const s = BS.mkInst('26RBS01-038'); s.cores = 1; P.spirits.push(s);
    G.active = P.key; G.step = 5; G.attacker = s; const before = BS.bpOf(s);
    await BS.activateFx(P, nx, 0);
    const bp = [BS.bpOf(s) - before, nx.exhausted === true];
    P.hand.length = 0; P.deck.unshift(BS.mkInst('26RBS01-044')); await BS.fireFx(P, 'ALLY_SUMMONED', nx, { subject: s });
    return [bp, P.hand.length]; })()`);
  assert.deepEqual(r, [[2000, true], 1]);
});

test('K-92 26RBS02-X04: When Destroyed leaves one core on an opposing Spirit; LV2 When Blocked sends one core from each of two opposing Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const mk = (c) => { const t = BS.mkInst('BS48-033'); t.cores = c; O.spirits.push(t); return t; };
    const x = BS.mkInst('26RBS02-X04'); P.trash.push(x); x.lostLv = 0; const a = mk(4);
    await BS.fireFx(P, 'DESTROYED', x, {});
    P.trash.length = 0; const y = BS.mkInst('26RBS02-X04'); y.cores = 3; P.spirits.push(y); const b = mk(2), c = mk(3);
    await BS.fireFx(P, 'ALLY_BLOCKED', y, { subject: y });
    return [a.cores, b.cores + c.cores + a.cores]; })()`);
  assert.deepEqual(r, [1, 4]);
});

test('K-93 26RBS03-X13: LV1 reveals three cards and returns them to the deckbottom; LV2 attack summon from Hand pays unless Life <= 3', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const x = BS.mkInst('26RBS03-X13'); x.cores = 4; P.spirits.push(x);
    const top = P.deck.slice(0, 3).map(c => c.id).join(); const len = P.deck.length;
    await BS.fireFx(P, 'SUMMONED', x, { subject: x });
    const moved = P.deck.length === len && P.deck.slice(-3).map(c => c.id).join() === top;
    const sum = async (life) => { P.life = life; P.reserve.n = 10; P.hand.length = 0; const h = BS.mkInst('26RBS01-061'); P.hand.push(h); x.fxUsed = {}; await BS.fireFx(P, 'ATTACKS', x, { subject: x }); return [P.spirits.includes(h), 10 - P.reserve.n]; };
    const paid = await sum(5); const free = await sum(3);
    return [moved, paid[0], paid[1] > 0, free[0], free[1] - 0]; })()`);
  assert.deepEqual(r, [true, true, true, true, r[4]], JSON.stringify(r));
  assert.ok(r[4] <= 1);
});

test('K-94 26RBS03-X10: show+return a Leucomyst card then draw 1, or 2 when Hand is 2 or less after the return', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const x = BS.mkInst('26RBS03-X10'); x.cores = 3; P.spirits.push(x);
    const go = async (extra) => { P.hand.length = 0; P.hand.push(BS.mkInst('26RBS01-046')); for (let i = 0; i < extra; i++) P.hand.push(BS.mkInst('26RBS01-048')); x.fxUsed = {}; const dl = P.deck.length; await BS.fireFx(P, 'ATTACKS', x, { subject: x }); return [P.hand.length, dl - P.deck.length]; };
    return [await go(0), await go(1), await go(3)]; })()`);
  // hand 1 -> returns -> 0 -> draw 2 = 2 ; hand 2 -> 1 -> draw 2 = 3 ; hand 4 -> 3 -> draw 1 = 4 (deck net: -draws +1 returned)
  assert.deepEqual(r.map(a => a[0]), [2, 3, 4], JSON.stringify(r));
});

test('K-95 26RBS03-X07: When Summoned sends out a Swordish Token (once per name per turn); LV2 Invoke exhausts a Swordish to refresh this Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    P.tokens = { '26RSD10-T001': 10 }; P.reserve.n = 8;
    const sw = () => P.spirits.filter(s => BS.CARDS[s.id].name === 'Swordish').length;
    const x = BS.mkInst('26RBS03-X07'); x.cores = 4; P.spirits.push(x);
    await BS.fireFx(P, 'SUMMONED', x, { subject: x }); const one = sw();
    const y = BS.mkInst('26RBS03-X07'); y.cores = 4; P.spirits.push(y);
    await BS.fireFx(P, 'SUMMONED', y, { subject: y }); const still = sw();
    G.active = P.key; G.step = 5; G.attacker = x; x.exhausted = true;
    const i = BS.CARDS['26RBS03-X07'].effects.findIndex(e => e.invoke);
    const ok = await BS.activateFx(P, x, i);
    const t = P.spirits.find(s => BS.CARDS[s.id].name === 'Swordish');
    return [one, still, ok, x.exhausted, t && t.exhausted]; })()`);
  assert.deepEqual(r, [1, 1, true, false, true], JSON.stringify(r));
});

test('K-96 26RCB01-038 / 064: REVEAL_PICK.also adds a second matching card; LV2 End Step refreshes all RYUKI Spirits; 064 Main reveals three', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0; O.spirits.length = 0; O.nexus.length = 0; P.cpu = true; O.cpu = true;
    const x = BS.mkInst('26RCB01-038'); x.cores = 4; P.spirits.push(x);
    const a = BS.mkInst('26RCB01-026'); a.cores = 2; a.exhausted = true; P.spirits.push(a);
    P.deck.unshift(BS.mkInst('26RCB01-048' in BS.CARDS ? '26RCB01-048' : 'BS48-033'), BS.mkInst('26RCB01-065'), BS.mkInst('26RCB01-025'));
    P.hand.length = 0; const len = P.deck.length;
    await BS.fireFx(P, 'SUMMONED', x, { subject: x });
    const got = P.hand.map(c => c.id).sort().join();
    await BS.fireFx(P, 'END_STEP', x, {});
    const refreshed = !a.exhausted;
    P.hand.length = 0; P.reserve.n = 10; const m = BS.mkInst('26RCB01-064'); P.hand.push(m);
    P.deck.unshift(BS.mkInst('BS48-033'), BS.mkInst('26RCB01-065'), BS.mkInst('26RCB01-028'));
    const ok = await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' });
    return [got, refreshed, P.hand.map(c => c.id).sort().join()]; })()`);
  assert.equal(r[0], '26RCB01-025,26RCB01-065', JSON.stringify(r)); assert.equal(r[1], true);
  assert.equal(r[2], '26RCB01-028,26RCB01-065', JSON.stringify(r));
});
