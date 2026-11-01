// v0.46.0 Ultimate card type (summon condition, LV3+ levels, Field/battle like a Spirit, not a Brave or Contract Advent target)
// and Ultra Manifest (BS76-CP01 Generator-Dragon-Brahman: Soul Core onto this card, +1 core to the target Nexus, summon without paying).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const VEN = 'BS74-X15', LEON = 'BS74-X12', GIG = 'BS74-X14', MITRA = 'BS74-CX03', EK = 'BS74-038', BRAHMAN = 'BS76-CP01', BRAHMA = 'SD69-CX01', SPEAR = 'BS71-063', HOUND = 'BS68-014';
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; q.trashCores.n = 0; q.trashCores.soul = false; q.life = 5; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P, n = 0) => { const i = BS.mkInst(id); i.cores = n; q.nexus.push(i); return i; }, hd = (id, q = P) => { const i = BS.mkInst(id); q.hand.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('U01 the four BS74 Ultimates load as type Ultimate with LV3-LV5 levels and a summon condition', async () => {
  const r = await g.page.evaluate(ids => ids.map(i => { const c = BS.CARDS[i]; return [c.type, c.levels.length, BS.isSpiritForm(c), c.lvBase, !!c.summonIf]; }), [VEN, LEON, GIG, 'BS74-X13']);
  for (const x of r) assert.deepEqual(x, ['Ultimate', 3, true, 3, true]);
});
test('U02 summon condition: Ven-Danta cannot be summoned without "Contractor Mitra", can with it', async () => {
  assert.deepEqual(await ev(`const v = hd('${VEN}'); const a = BS.canPlayCard(P, v); nx('${MITRA}'); return [a, BS.canPlayCard(P, v), BS.summonOK(P, BS.CARDS['${VEN}'])];`), [false, true, true]);
});
test('U03 a paid summon puts the Ultimate on the Field at LV3 with its first-level BP', async () => {
  assert.deepEqual(await ev(`nx('${MITRA}'); const v = hd('${VEN}'); await BS.summonPaid(P, v); return [P.spirits.includes(v), v.cores, BS.lvNo(v), BS.bpOf(v)];`), [true, 1, 3, 9000]);
});
test('U04 Ultimate levels: 2 cores = LV4, 5 cores = LV5; effects use the printed LV numbers', async () => {
  assert.deepEqual(await ev(`const v = sp('${VEN}', P, 2); const a = [BS.lvNo(v), BS.bpOf(v)]; v.cores = 5; return a.concat([BS.lvNo(v), BS.bpOf(v), BS.CARDS['${VEN}'].effects[0].lv.join('')]);`), [4, 14000, 5, 20000, '345']);
});
test('U05 an Ultimate attacks with its Ultimate symbol (one Life)', async () => {
  assert.equal(await ev(`const v = sp('${VEN}', P, 1); return BS.attackSymbols(v);`), 1);
});
test('U06 an Ultimate symbol pays an Ultimate reduction symbol; a colour symbol does not', async () => {
  const r = await ev(`const c = BS.CARDS['${GIG}']; sp('${EK}', P, 1); const a = BS.reductionOf(c, BS.fieldSymbols(P)); P.spirits = []; sp('${VEN}', P, 1); return [c.reduction.ultimate, a, BS.reductionOf(c, BS.fieldSymbols(P))];`);
  assert.deepEqual(r, [1, 0, 1]);
});
test('U07 an Ultimate with too few cores is depleted', async () => {
  assert.deepEqual(await ev(`const v = sp('${VEN}', P, 0); BS.checkDepletion(P); return [P.spirits.includes(v), P.trash.includes(v)];`), [false, true]);
});
test('U08 a Brave cannot combine with an Ultimate', async () => {
  assert.equal(await ev(`const v = sp('${VEN}', P, 3); return BS.braveFits(BS.mkInst('${SPEAR}'), v);`), false);
});
test('U09 Ven-Danta Contract Advent onto an Awakened Dragon Spirit needs Mitra and 3 counters, then returns an opposing Spirit to the deck bottom', async () => {
  const r = await ev(`const ek = sp('${EK}', P, 2); P.reserve.soul = true; P.count = 3; const v = hd('${VEN}'); const t = sp('${HOUND}', O, 1);
    const a = BS.contractAdventTargets(P, v, 'main').length; nx('${MITRA}'); const b = BS.contractAdventTargets(P, v, 'main').length;
    await BS.doContractAdvent(P, v, ek, 'main'); return [a, b, P.spirits.includes(v), O.spirits.includes(t), O.deck[O.deck.length - 1] === t];`);
  assert.deepEqual(r, [0, 1, true, false, true]);
});
test('U10 Contract Advent cannot stack onto an Ultimate', async () => {
  assert.equal(await ev(`nx('${MITRA}'); sp('${VEN}', P, 2); P.reserve.soul = true; P.count = 3; const v = hd('${VEN}'); return BS.contractAdventTargets(P, v, 'main').length;`), 0);
});
test('U11 the CPU scores an affordable Ultimate as a play', async () => {
  assert.ok(await ev(`nx('${MITRA}'); const v = hd('${VEN}'); return BS.cpuPlayScore(P, v);`) > 0);
});
const brahm = (count = 7, nc = 0) => `const n = nx('${BRAHMA}', P, ${nc}); P.count = ${count}; P.reserve.soul = true; const b = hd('${BRAHMAN}'); G.step = 5;`;
test('U12 Ultra Manifest: the Soul Core goes onto Brahman, the Nexus gets +1 core, no summon cost is paid', async () => {
  const r = await ev(brahm() + ` const res = P.reserve.n; const T = BS.manifestTargets(P, b, 'flash'); await BS.doManifest(P, b, T[0], 'flash');
    return [T.length, P.spirits.includes(b), b.soul, b.cores, n.cores, P.reserve.n, P.reserve.soul, P.trashCores.soul];`);
  assert.deepEqual(r, [1, true, true, 0, 2, 9, false, false]);   // Nexus: +1 (Ultra Manifest) +1 (Brahma Neo-Core Charge from the Reserve on the Cost 3+ summon)
});
test('U13 Ultra Manifest needs 7 counters and your turn', async () => {
  assert.deepEqual(await ev(brahm(6) + ` const a = BS.manifestTargets(P, b, 'flash').length; P.count = 7; G.active = O.key; const c = BS.manifestTargets(P, b, 'flash').length; G.active = P.key; return [a, c, BS.manifestTargets(P, b, 'flash').length];`), [0, 0, 1]);
});
test('U14 Ultra Manifest is once per turn (same name)', async () => {
  assert.equal(await ev(brahm() + ` await BS.doManifest(P, b, n, 'flash'); P.reserve.soul = false; P.spirits.find(x => x === b).soul = false; P.reserve.soul = true; const b2 = hd('${BRAHMAN}'); return BS.manifestTargets(P, b2, 'flash').length;`), 0);
});
test('U15 Brahman (When Manifests) returns a Generator from the Trash in the Attack Step', async () => {
  const r = await ev(brahm() + ` const gen = BS.mkInst(Object.keys(BS.CARDS).find(k => /Generator/.test(BS.CARDS[k].name) && k !== '${BRAHMAN}')); P.trash.push(gen);
    await BS.doManifest(P, b, n, 'flash'); return P.hand.includes(gen);`);
  assert.equal(r, true);
});
