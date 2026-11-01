// v0.35 missing mechanics (issue #4): Token cards (Rig Avatar Dragon) and the Saga Brave onto a Grandwalker Nexus (Yaj-Veda + Brahma).
// Rules: Eternal rule manual VER.17.0 p. 56-57 (Tokens), p. 38-39 (Saga Brave) and the official "How to Use Token Cards" page
// (battlespirits.com/product/special/tokencard/): not in the Deck, placed only by "send out" effects with Lv1 cores and no cost,
// a Spirit while on the Field, back to the Token supply when it leaves (so "after destroyed" Bursts cannot activate). Quiet boards only.
// rules: ETR:tokens@06480141, ETR:brave.saga@9bf96f20
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
const FIX = [
  { id: 'K-ALLY', name: 'Summon Watcher', type: 'Nexus', color: 'red', cost: 1, levels: [{ cores: 0 }], effects: [{ trigger: 'ALLY_SUMMONED', actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'K-DEAD', name: 'Last Word Beast', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'DESTROYED', actions: [{ do: 'DRAW', n: 1 }] }] },
  { id: 'K-LOW', name: 'Tiny Lizard', type: 'Spirit', color: 'red', cost: 1, symbols: 1, families: ['Ancient Dragon'], levels: [{ cores: 1, bp: 1000 }] },
  { id: 'K-GEN', name: 'Plain Destroyer', type: 'Spirit', color: 'red', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 4000 }], effects: [{ trigger: 'ATTACKS', actions: [{ do: 'DESTROY', bpLe: 5000 }] }] },
  { id: 'K-SW', name: 'Token Edge', type: 'Brave', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], brave: { bp: 3000, family: ['Creation'] } },
];
const RAD = 'SD69-TOKEN-RAD';
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent, RAD = '${RAD}';
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.tokens[RAD] = 10; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);
const parseA = a => g.page.evaluate(x => { const r = BS.parseActionList([x]); return r.error ? r.error : 'ok'; }, a);

// ---- Token data and supply ----
test('K01 Rig Avatar Dragon is registered as a Token Spirit (Spirit with token:true) with its data', async () => {
  const r = await g.page.evaluate(id => { const c = BS.CARDS[id]; return [c.type, c.token, c.cost, c.symbols, c.families, c.levels, (c.effects || []).length, c.implemented]; }, RAD);
  assert.deepEqual(r, ['Spirit', true, 0, 0, ['Ancient Dragon', 'Creation'], [{ cores: 1, bp: 4000 }], 1, true]);
});
test('K02 a Token can never be put into a Deck (validation and clean-up)', async () => {
  const r = await g.page.evaluate(id => { const d = {}; d[id] = 1; return BS.validateDeck(d).errors.some(e => /Token/.test(e)); }, RAD);
  assert.equal(r, true);
});
test('K03 a match prepares the Token supply only for decks whose cards send that Token out', async () => {
  const r = await g.page.evaluate(id => {
    const a = BS.loadScenario({ turn: 3, active: 'player', step: 4, players: { player: { hand: ['SD69-CX01'] }, opponent: { hand: ['BS75-001'] } } });
    return [a.ok, BS.G.p.player.tokens[id], BS.G.p.opponent.tokens[id] || 0, BS.TOKEN_SUPPLY];
  }, RAD);
  assert.deepEqual(r, [true, 10, 0, 10]);
});
test('K04 sending out a Token: no cost, Lv1 cores from the Reserve, supply -1, on the Field as a Spirit', async () => {
  const r = await ev(`const t = BS.sendToken(P, RAD); return [P.spirits.includes(t), t.token, t.cores, P.reserve.n, P.tokens[RAD], BS.bpOf(t)];`);
  assert.deepEqual(r, [true, true, 1, 9, 9, 4000]);
});
test('K05 sending out a Token is not a summon (no "when summoned" effects of your other cards)', async () => {
  const r = await ev(`nx('K-ALLY'); const t = BS.sendToken(P, RAD); return [!!t, P.count];`);
  assert.deepEqual(r, [true, 0]);
});
test('K06 no Token without cores for Lv1 or with an empty supply', async () => {
  const r = await ev(`P.reserve.n = 0; const a = BS.canSendToken(P, RAD); P.reserve.n = 3; P.tokens[RAD] = 0; const b = BS.canSendToken(P, RAD); return [a, b, BS.sendToken(P, RAD)];`);
  assert.deepEqual(r, [false, false, null]);
});
test('K07 Token cores may come from a Field card\'s spare cores', async () => {
  const r = await ev(`P.reserve.n = 0; const s = sp('K-LOW', P, 2); const t = BS.sendToken(P, RAD); return [!!t, s.cores, t && t.cores];`);
  assert.deepEqual(r, [true, 1, 1]);
});

// ---- leaving the Field ----
test('K08 a Token destroyed by the opponent returns to the supply, not the Trash, and no "after destroyed" Burst is queued', async () => {
  const r = await ev(`G.burstQ = []; const t = BS.sendToken(P, RAD); BS.removeSpirit(P, t, 'destroyed', true); return [P.spirits.length, P.trash.length, P.tokens[RAD], G.burstQ.length, P.reserve.n];`);
  assert.deepEqual(r, [0, 0, 10, 0, 10]);
});
test('K09 control: a normal Spirit destroyed by the opponent goes to the Trash and queues the Burst check', async () => {
  const r = await ev(`G.burstQ = []; const s = sp('K-LOW'); BS.removeSpirit(P, s, 'destroyed', true); return [P.trash.length, G.burstQ.length];`);
  assert.deepEqual(r, [1, 1]);
});
test('K10 a returned Token goes back to the supply, not the Hand or the Deck', async () => {
  const r = await ev(`const t = BS.sendToken(P, RAD), u = BS.sendToken(P, RAD); BS.bounceCard(P, t, 'hand'); BS.bounceCard(P, u, 'deckBottom'); return [P.hand.length, P.deck.length, P.spirits.length, P.tokens[RAD]];`);
  assert.deepEqual(r, [0, 0, 0, 10]);
});
test('K11 a Token cannot enter Soul State: it returns to the supply', async () => {
  const r = await ev(`const t = BS.sendToken(P, RAD); const ok = BS.toSoulState(P, t); return [ok, P.soulState.length, P.spirits.length, P.tokens[RAD]];`);
  assert.deepEqual(r, [false, 0, 0, 10]);
});
test('K12 a depleted Token returns to the supply', async () => {
  const r = await ev(`const t = BS.sendToken(P, RAD); t.cores = 0; BS.checkDepletion(P); return [P.spirits.length, P.trash.length, P.tokens[RAD]];`);
  assert.deepEqual(r, [0, 0, 10]);
});
test('K13 a Brave can combine with a Token Spirit; when the Token leaves, the Brave goes to the Trash', async () => {
  const r = await ev(`const t = BS.sendToken(P, RAD), b = sp('K-SW'); const fits = BS.braveFits(b, t); BS.combineBrave(P, b, t); BS.removeSpirit(P, t, 'destroyed', true);
    return [fits, P.trash.map(x => x.id), P.tokens[RAD]];`);
  assert.deepEqual(r, [true, ['K-SW'], 10]);
});
test('K14 the card count invariant ignores Tokens and counts combined Braves', async () => {
  const r = await g.page.evaluate(id => {
    BS.loadScenario({ turn: 3, active: 'player', step: 4, players: { player: { reserve: 5, hand: ['SD69-CX01', 'BS76-060'], spirits: [{ id: 'BS76-006', cores: 1 }] }, opponent: {} } });
    const P = BS.G.p.player; BS.sendToken(P, id); const y = P.hand.find(x => x.id === 'BS76-060'); BS.braveSummon(P, y, P.spirits[0], null);
    try { BS.checkInvariants(); return 'ok'; } catch (e) { return String(e.message); }
  }, RAD);
  assert.equal(r, 'ok');
});
test('K15 SEND_TOKEN validation rejects a bad Token id or count', async () => {
  assert.equal(await parseA({ do: 'SEND_TOKEN', token: RAD, n: 1 }), 'ok');
  assert.notEqual(await parseA({ do: 'SEND_TOKEN', token: 'bad id', n: 1 }), 'ok');
  assert.notEqual(await parseA({ do: 'SEND_TOKEN', token: RAD, n: 4 }), 'ok');
  assert.notEqual(await parseA({ do: 'DESTROY', bpLe: 5000, noFx: 'yes' }), 'ok');
});

// ---- Rig Avatar Dragon ----
test('K16 Rig Avatar Dragon attacks: +1 core to Contractor Brahma and +1 symbol during this battle only', async () => {
  const r = await ev(`const br = nx('SD69-CX01'), t = BS.sendToken(P, RAD); G.attacker = t; await BS.fireFx(P, 'ATTACKS', t, { attacker: t });
    const during = BS.attackSymbols(t); G.attacker = null; t.symBattle = 0; return [br.cores, during, BS.attackSymbols(t)];`);
  assert.deepEqual(r, [1, 1, 0]);
});
// rules: ETR:brave.combine@0d0e7d3a
test('K17 attack symbols: a combined Brave adds its symbol (manual p. 34)', async () => {
  const r = await ev(`const d = sp('K-LOW'), b = sp('K-SW'); const s0 = BS.attackSymbols(d); BS.CARDS['K-LOW'].families = ['Creation']; BS.combineBrave(P, b, d); BS.CARDS['K-LOW'].families = ['Ancient Dragon']; return [s0, BS.attackSymbols(d)];`);
  assert.deepEqual(r, [1, 2]);
});
test('K18 an unblocked Rig Avatar Dragon takes 1 Life thanks to its battle symbol, then the symbol is gone', async () => {
  const r = await ev(`G.step = 5; G.active = 'player'; nx('SD69-CX01'); const t = BS.sendToken(P, RAD); O.life = 5; O.spirits = [];
    await BS.doBattle('player', t); return [O.life, t.symBattle || 0];`);
  assert.deepEqual(r, [4, 0]);
});

// ---- The GenesisContractor Brahma (SD69-CX01) ----
test('K19 Brahma Contract Skill 2: two cores to the Void, counter +2, then a Rig Avatar Dragon Token', async () => {
  const r = await ev(`const br = nx('SD69-CX01', P, 2); const L = BS.activatable(P, br, 'FLASH').map(x => x.idx); await BS.activateFx(P, br, L[0]);
    return [L.length, br.cores, P.count, P.void, P.spirits.filter(s => s.token).length, P.tokens[RAD]];`);
  assert.deepEqual(r, [1, 0, 2, 0, 1, 9]);   // the 2 cores paid to the Void are taken back by counter +2
});
test('K20 Brahma Contract Skill needs two cores on the Nexus and is once per turn', async () => {
  const r = await ev(`const br = nx('SD69-CX01', P, 1); const a = BS.activatable(P, br, 'MAIN').length; br.cores = 4; const idx = BS.activatable(P, br, 'MAIN')[0].idx;
    await BS.activateFx(P, br, idx); return [a, BS.activatable(P, br, 'MAIN').length];`);
  assert.deepEqual(r, [0, 0]);
});
test('K21 Brahma deploy: three cards from the Deck to the Trash, +1 core per Ancient Dragon/Devotee/Concluser cost 3+', async () => {
  const r = await ev(`P.deck = ['BS76-006', 'BS75-001', 'BS76-CP01', 'K-LOW'].map(id => BS.mkInst(id)); const br = nx('SD69-CX01'); await BS.fireFx(P, 'SUMMONED', br);
    return [P.trash.length, br.cores, P.deck.length];`);
  assert.deepEqual(r, [3, 2, 1]);
});
test('K22 Yaj-Veda milled by Brahma goes to the Hand, once per turn (same name)', async () => {
  const r = await ev(`P.deck = ['BS76-060', 'BS76-060', 'BS75-001'].map(id => BS.mkInst(id)); const br = nx('SD69-CX01'); await BS.fireFx(P, 'SUMMONED', br);
    return [P.hand.map(x => x.id), P.trash.map(x => x.id).sort()];`);
  assert.deepEqual(r, [['BS76-060'], ['BS75-001', 'BS76-060']]);
});
test('K23 Neo-Core Charge: Brahma gets +1 core when a cost 3+ Ancient Dragon Spirit is summoned, not for a cheap one', async () => {
  const r = await ev(`const br = nx('SD69-CX01'); const a = hd('BS76-006'); BS.summon(P, a, null); await BS.fireFx(P, 'SUMMONED', a); const c1 = br.cores;
    const b = hd('K-LOW'); BS.summon(P, b, null); await BS.fireFx(P, 'SUMMONED', b); return [c1, br.cores];`);
  assert.deepEqual(r, [1, 1]);
});
test('K24 Contract Field (LV2 by Count): an attacking Ancient Dragon gets +5000 BP and you draw', async () => {
  const r = await ev(`nx('SD69-CX01'); const d = sp('BS76-006'); P.deck = [BS.mkInst('K-LOW')]; P.count = 4;
    await BS.fireFx(P, 'ALLY_ATTACKS', null, { attacker: d }); return [BS.bpOf(d), P.hand.length];`);
  assert.deepEqual(r, [9000, 1]);
});
test('K25 Contract Field is off at LV1 (Count below 4)', async () => {
  const r = await ev(`nx('SD69-CX01'); const d = sp('BS76-006'); P.deck = [BS.mkInst('K-LOW')]; P.count = 3;
    await BS.fireFx(P, 'ALLY_ATTACKS', null, { attacker: d }); return [BS.bpOf(d), P.hand.length];`);
  assert.deepEqual(r, [4000, 0]);
});

// ---- Generator Yajdragon (BS76-006) ----
test('K26 Generator Yajdragon Manifests onto "Contractor Brahma" only in a Flash Timing of either Attack Step', async () => {
  const r = await ev(`P.reserve.soul = true; const br = nx('SD69-CX01', P, 2), y = hd('BS76-006'); G.step = 4; const a = BS.manifestTargets(P, y, 'main').length;
    G.step = 5; G.active = 'opponent'; const b = BS.manifestTargets(P, y, 'flash').includes(br); return [BS.CARDS['BS76-006'].manifest, a, b];`);
  assert.deepEqual([r[0].name, r[0].turn, r[1], r[2]], ['Contractor Brahma', 'EITHER_ATTACK', 0, true]);
});
test('K27 Generator Yajdragon attacks: counter +1, destroys a 5000 BP Spirit whose effects cannot activate', async () => {
  const r = await ev(`const y = sp('BS76-006'); const v = sp('K-DEAD', O); O.deck = [BS.mkInst('K-LOW')]; await BS.fireFx(P, 'ATTACKS', y, { attacker: y });
    return [P.count, O.spirits.length, O.trash.length, O.hand.length];`);
  assert.deepEqual(r, [1, 0, 1, 0]);
});
test('K28 control: a plain destroy lets the "When Destroyed" effect activate', async () => {
  const r = await ev(`const y = sp('K-GEN'); sp('K-DEAD', O); O.deck = [BS.mkInst('K-LOW')]; await BS.fireFx(P, 'ATTACKS', y, { attacker: y }); return [O.spirits.length, O.hand.length];`);
  assert.deepEqual(r, [0, 1]);
});
test('K29 Generator Yajdragon LV2: with a "Contractor Brahma" in Soul State it sends out a Token; without one it does not', async () => {
  const r = await ev(`const y = sp('BS76-006', P, 2); await BS.fireFx(P, 'ATTACKS', y, { attacker: y }); const a = P.spirits.filter(s => s.token).length;
    const b0 = BS.mkInst('SD69-CX01'); b0.inSoulState = true; P.soulState.push(b0); y.fxUsed = {}; await BS.fireFx(P, 'ATTACKS', y, { attacker: y });
    return [a, P.spirits.filter(s => s.token).length];`);
  assert.deepEqual(r, [0, 1]);
});

// ---- Generator-Dragon-Brahman (BS76-CP01) ----
test('K30 Brahman attacks: returns up to two Generator/HermitDragon from the Trash, then sends out up to two Tokens, once per turn', async () => {
  const r = await ev(`const c = sp('BS76-CP01'); P.trash = ['BS76-006', 'BS76-009', 'BS76-006', 'K-LOW'].map(id => BS.mkInst(id));
    await BS.fireFx(P, 'ATTACKS', c, { attacker: c }); const a = [P.hand.length, P.spirits.filter(s => s.token).length];
    await BS.fireFx(P, 'ATTACKS', c, { attacker: c }); return a.concat([P.hand.length, P.spirits.filter(s => s.token).length]);`);
  assert.deepEqual(r, [2, 2, 2, 2]);
});

// ---- Saga Brave onto a Grandwalker Nexus (Yaj-Veda) ----
test('K31 Yaj-Veda fits a "Brahma" Grandwalker Nexus, not another Grandwalker Nexus', async () => {
  const r = await ev(`const br = nx('SD69-CX01'), mi = nx('BS74-CX03'), y = hd('BS76-060'); return [BS.braveFits(y, br), BS.braveFits(y, mi), BS.braveTargets(P, y).map(x => x.id)];`);
  assert.deepEqual(r, [true, false, ['SD69-CX01']]);
});
// rules: ETR:brave.saga@9bf96f20
test('K32 combining onto the Nexus: the Brave cores go back to the Reserve first (manual p. 38)', async () => {
  const r = await ev(`const br = nx('SD69-CX01', P, 2), y = sp('BS76-060', P, 2); const r0 = P.reserve.n; BS.combineBrave(P, y, br);
    return [br.brave === y, br.cores, P.reserve.n - r0, P.spirits.length];`);
  assert.deepEqual(r, [true, 2, 2, 0]);
});
test('K33 a Nexus-braved Brahma can use the Brave\'s Contract Skill 3 in either Attack Step (Token with Brahma)', async () => {
  const r = await ev(`const br = nx('SD69-CX01', P, 3), y = hd('BS76-060'); BS.braveSummon(P, y, br, null); G.step = 4; const main = BS.activatable(P, br, 'FLASH').filter(x => x.idx >= 100).length;
    G.step = 5; const L = BS.activatable(P, br, 'FLASH').filter(x => x.idx >= 100); await BS.activateFx(P, br, L[0].idx);
    return [main, L.length, br.cores, P.void, P.spirits.filter(s => s.token).length];`);
  assert.deepEqual(r, [0, 1, 0, 3, 1]);
});
test('K34 Yaj-Veda\'s Nexus Brave effect is not usable while it stands alone as a Spirit', async () => {
  const r = await ev(`G.step = 5; const y = sp('BS76-060', P, 1); return BS.activatable(P, y, 'FLASH').length;`);
  assert.equal(r, 0);
});
test('K35 a destroyed braved Nexus takes its Brave to the Trash; separating gives Yaj-Veda Lv1 cores', async () => {
  const r = await ev(`const br = nx('SD69-CX01'), y = sp('BS76-060'); BS.combineBrave(P, y, br); const ok = BS.canSeparate(P, br); BS.separateBrave(P, br); const sep = [P.spirits.includes(y), y.cores, br.brave];
    BS.combineBrave(P, y, br); BS.removeNexus(P, br, 'destroyed'); return [ok, sep, P.trash.map(x => x.id).sort()];`);
  assert.deepEqual(r, [true, [true, 1, null], ['BS76-060', 'SD69-CX01']]);
});
