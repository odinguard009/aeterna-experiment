// v0.171.0: ctrl.nexus ("Spirit/Nexus"), controlName list ("[A]/[B]"), keyword Current as a holder,
// SELF_TO_HAND from the Trash under a destroyed trigger, "put the core to this Spirit instead".
// rules: ETR:battle.destruction@698b8d5e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.reserve.n = 10; q.onceUsed = {}; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('V171-01 Gawrm: when destroyed it returns from the Trash to the Hand', async () => {
  const r = await ev(`const d = sp('BS01-032', P, 3); d.lv = 2; BS.removeSpirit(P, d, 'destroyed', true); await BS.flushBursts();
    return [P.hand.some(x => x.id === 'BS01-032'), P.trash.some(x => x.id === 'BS01-032'), P.spirits.length];`);
  assert.deepEqual(r, [true, false, 0]);
});

test('V171-02 Macaroni Pentan: returns only while a Kaiser Empereur / Penpress is controlled', async () => {
  const a = await ev(`const d = sp('BS07-039', P, 3); BS.removeSpirit(P, d, 'destroyed', true); await BS.flushBursts(); return [P.hand.length, P.trash.length];`);
  assert.deepEqual(a, [0, 1]);
  const names = await ev(`return Object.values(BS.CARDS).filter(k => /Kaiser Empereur|Penpress/.test(k.name)).map(k => k.id).slice(0, 3);`);
  if (names.length) {
    const b = await ev(`sp('${names[0]}', P, 1); const d = sp('BS07-039', P, 3); BS.removeSpirit(P, d, 'destroyed', true); await BS.flushBursts(); return [P.hand.length, P.trash.length];`);
    assert.deepEqual(b, [1, 0]);
  }
});

test('V171-03 ctrl.nexus counts the Nexus; ctrl.other skips the source', async () => {
  const r = await ev(`const src = sp('BS01-042', P, 1); const fam = (BS.CARDS['BS01-042'].families || [])[0] || null;
    const N = BS.mkInst('BS01-042'); P.nexus.push(N);
    const base = { n: 1, type: 'Spirit', family: fam || 'x', other: true };
    const ctx = { selfUid: src.uid };
    return [fam, BS.fxIf(P, O, { ctrl: base }, ctx), BS.fxIf(P, O, { ctrl: Object.assign({ nexus: true }, base) }, ctx)];`);
  if (r[0]) assert.deepEqual(r.slice(1), [false, true]);
});

test('V171-04 Current is a holder template: only a Spirit with {{Current|..}} counts', async () => {
  const r = await ev(`const q = { ctrl: { n: 1, type: 'Spirit', keyword: 'Current' } };
    const none = BS.fxIf(P, O, q, {}); sp('BS01-042', P, 1); const plain = BS.fxIf(P, O, q, {}); sp('26RBS01-038', P, 1); const cur = BS.fxIf(P, O, q, {});
    return [none, plain, cur];`);
  assert.deepEqual(r, [false, false, true]);
});

test('V171-05 Salakka: the core goes to the Trash, or to this Spirit when a Current Spirit is in play', async () => {
  const a = await ev(`const s = sp('26RBS01-034', P, 1); await BS.fireFx(P, 'SUMMONED', s, {}); return [s.cores, P.trashCores.n];`);
  assert.deepEqual(a, [1, 1]);
  const b = await ev(`sp('26RBS01-038', P, 1); const s = sp('26RBS01-034', P, 1); await BS.fireFx(P, 'SUMMONED', s, {}); return [s.cores, P.trashCores.n];`);
  assert.deepEqual(b, [2, 0]);
});

test('V171-06 Golek: a Wollaguard Nexus sends the core to the Reserve instead', async () => {
  const fam = await ev(`return (BS.CARDS['26RBS03-034'].families || [])[0] || null;`);
  const a = await ev(`const s = sp('26RBS03-034', P, 1); P.reserve.n = 0; await BS.fireFx(P, 'SUMMONED', s, {}); return [P.reserve.n, P.trashCores.n];`);
  assert.deepEqual(a, [0, 1]);
  const nx = await ev(`return Object.values(BS.CARDS).filter(k => k.type === 'Nexus' && (k.families || []).includes('Wollaguard')).map(k => k.id).slice(0, 1);`);
  if (nx.length) {
    const b = await ev(`const N = BS.mkInst('${nx[0]}'); P.nexus.push(N); const s = sp('26RBS03-034', P, 1); P.reserve.n = 0; await BS.fireFx(P, 'SUMMONED', s, {}); return [P.reserve.n, P.trashCores.n];`);
    assert.deepEqual(b, [1, 0]);
  }
});

test('V171-07 Tokkaricca: a core to each of up to two Spirits with Current', async () => {
  const r = await ev(`const a = sp('26RBS01-038', P, 1), b = sp('26RBS01-040', P, 1), c = sp('BS01-042', P, 1), t = sp('26RBS01-042', P, 1);
    await BS.fireFx(P, 'SUMMONED', t, {}); return [a.cores + b.cores, c.cores];`);
  assert.deepEqual(r, [4, 1]);
});
