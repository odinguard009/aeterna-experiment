import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1601 BS71-072 Bulwark Temple: Trash cards without Celtica/Scalostle are unaffected and have no usable effects; excepted families and the Nexus itself are not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const pick = f => Object.values(BS.CARDS).find(f);
    const other = pick(c => c.type === 'Spirit' && !c.token && !(c.families || []).some(x => x === 'Celtica' || x === 'Scalostle') && (c.effects || []).some(e => e.trigger !== 'STATIC'));
    const fam = pick(c => c.type === 'Spirit' && !c.token && (c.families || []).includes('Scalostle') && (c.effects || []).some(e => e.trigger !== 'STATIC'));
    const a = BS.mkInst(other.id), b = BS.mkInst(fam.id); O.trash = [a, b];
    const before = { a: BS.fxEntries(a).length, aSafe: BS.trashSafe(a, { p: P, src: BS.mkInst(fam.id) }) };
    const nx = BS.mkInst('BS71-072'); P.nexus = [nx]; nx.cores = 1;
    const lock = BS.CARDS['BS71-072'].effects.find(e => e.flag === 'TRASH_LOCK');
    const lv = BS.lvNo(nx);
    const after = { a: BS.fxEntries(a).length, b: BS.fxEntries(b).length, aSafe: BS.trashSafe(a, { p: P, src: BS.mkInst(fam.id) }), aSafeOwn: BS.trashSafe(a, { p: O, src: BS.mkInst(fam.id) }), bSafe: BS.trashSafe(b, { p: P, src: BS.mkInst(other.id) }), selfSafe: BS.trashSafe(a, { p: P, src: nx }) };
    return { before, after, lv, lock: !!lock, fam: b && BS.fxEntries(b).length, fc: BS.CARDS['BS71-072'].partial === false }; })()`);
  const j = JSON.stringify(r);
  assert.ok(r.before.a > 0, j); assert.equal(r.before.aSafe, false, j);
  assert.equal(r.after.a, 0, j); assert.ok(r.after.b > 0, j);
  assert.equal(r.after.aSafe, true, j); assert.equal(r.after.aSafeOwn, true, j);
  assert.equal(r.after.bSafe, false, j); assert.equal(r.after.selfSafe, false, j);
  assert.equal(r.fc, true, j);
});
