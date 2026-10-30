// Lane K tests, shard 3 of 4 (split from k_legacy_bounce.test.mjs; one shared page per shard, see sharedBoard in lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
// Magic bases are staged with an allHave gate; these tests drop it and check the new shapes.
const MAGIC_RUN = `const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
  const run = (id, lg) => { const m = BS.mkInst(id); m.legacyN = lg || 0; const acts = BS.CARDS[id].magic.actions.map(a => { const b = { ...a }; if (b.if) { b.if = { ...b.if }; delete b.if.allHave; if (!Object.keys(b.if).length) delete b.if; } return b; }); return BS.runActions({ p: P, opp: O, src: m, ctx: {} }, { actions: acts }); };
  const opp = (cost, bp, team) => { const c = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && c.cost === cost && c.levels[0].bp === bp && !(c.effects && c.effects.length)); const f = BS.mkInst(c.id); f.cores = 1; O.spirits.push(f); return f; };`;

test('K-49 Gnutarius/Roaspis: perLegacy / nLegacy scale with the EX Symbols banished', async () => {
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    O.spirits.length = 0; opp(3, 2000); opp(3, 2000);
    O.spirits[0].soul = true;
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS01-039'), ctx: {} }, { actions: [{ do: 'EXHAUST_OPP', n: 1, noSoul: true }] }); await BS.flushBursts();
    return O.spirits.map(s => !!s.exhausted); })()`);
  assert.deepEqual(r, [false, true]);
});

test('K-59 Vitality Woods: NEXUS_EXHAUST draws only in your Attack Step with four or fewer cards in hand', async () => {
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
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
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    O.spirits.length = 0; for (let i = 0; i < 5; i++) opp(1, 1000);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RBS03-087'), ctx: {} }, { actions: [{ do: 'DESTROY_TOTAL', total: 7000, max: 3 }] }); await BS.flushBursts();
    return O.spirits.length; })()`);
  assert.equal(r, 2);
});

test('K-68 Swordish Comes: ctrl refreshed counts only refreshed Swordish', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    const T = '26RSD10-T001', c = { ctrl: { type: 'Spirit', name: 'Swordish', refreshed: true, nLe: 0 } };
    P.tokens = { [T]: 10 }; P.reserve.n = 5;
    const a = BS.fxIf(P, O, c, {}); const t = BS.sendToken(P, T);
    const b = BS.fxIf(P, O, c, {}); t.exhausted = true;
    return [a, b, BS.fxIf(P, O, c, {})]; })()`);
  assert.deepEqual(r, [true, false, true]);
});

test('K-69 War Toll: HAND_TO_BOTTOM then SEND_TOKEN (Life 2 sends two)', async () => {
  const { page } = await sharedBoard();
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

test('K-70 START_MAIN fires at the start of the Main Step (Bubble Cluster Realm)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.cpu = true; const n = BS.mkInst('26RSD03-011'); n.cores = 5; P.nexus.push(n);
    const eff = BS.CARDS['26RSD03-011'].effects.find(e => e.trigger === 'START_MAIN');
    const f = P.spirits; f.length = 0;
    for (let i = 0; i < 2; i++) { const s = BS.mkInst('26RSD03-001'); s.exhausted = true; f.push(s); }
    BS.CARDS['26RSD03-001'].families = ['Armored Fish'];
    const v0 = P.void, r0 = P.reserve.n; P.void = 3;
    await BS.fireFx(P, 'START_MAIN', null, {});
    return [!!eff, P.reserve.n - r0, P.void]; })()`);
  assert.equal(r[0], true);
  assert.equal(r[1], 1);
  assert.equal(r[2], 2);
});

test('K-71 BP_MINUS all + zeroDestroy hits every opposing Spirit; a Nexus can EXHAUST_SELF', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    O.spirits.length = 0; opp(1, 1000); opp(1, 4000);
    await BS.runActions({ p: P, opp: O, src: BS.mkInst('26RSD05-X01'), ctx: {} }, { actions: [{ do: 'BP_MINUS', n: 1000, all: true, zeroDestroy: true }] }); await BS.flushBursts();
    const n = BS.mkInst('26RDB01-048'); P.nexus.push(n);
    await BS.runActions({ p: P, opp: O, src: n, ctx: {} }, { actions: [{ do: 'EXHAUST_SELF' }] });
    return [O.spirits.length, BS.bpOf(O.spirits[0]), n.exhausted]; })()`);
  assert.deepEqual(r, [1, 3000, true]);
});

test('K-72 Invoke cost destroyOwn destroys a Cyantree Nexus; STATIC targetRefreshed counts only refreshed Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${MAGIC_RUN}
    P.spirits.length = 0; P.nexus.length = 0;
    const s = BS.mkInst('26RBS03-069'); s.cores = 6; P.spirits.push(s);
    const nx = BS.mkInst('26RBS01-106'); P.nexus.push(nx);
    G.active = P.key; G.step = 5; G.attacker = s; G.battleNo = (G.battleNo || 0) + 1;
    const before = BS.bpOf(s), i = BS.CARDS['26RBS03-069'].effects.findIndex(e => e.invoke);
    const ok = await BS.activateFx(P, s, i);
    const w = BS.mkInst('26RBS03-032'); w.cores = 3; P.spirits.push(w);
    const m = BS.mkInst('26RBS03-080'); m.cores = 5; P.nexus.push(m);
    const up = BS.bpOf(w); w.exhausted = true; const down = BS.bpOf(w);
    return [ok, P.nexus.includes(nx), BS.bpOf(s) - before, up - down]; })()`);
  assert.deepEqual(r, [true, false, 4000, 1000]);
});
