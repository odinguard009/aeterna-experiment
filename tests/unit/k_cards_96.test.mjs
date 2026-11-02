// Lane K cards, batch 96.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1175 Burst ALLY_LOST (SD66-006): an ally destroyed by the opponent lets the burst summon the card; DESTROY bpRank lowest picks the lowest-BP Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5;
    const ids = Object.values(BS.CARDS).filter(c => /^BS0/.test(c.id) && c.type === 'Spirit' && c.cost <= 2).slice(0, 3).map(c => c.id);
    const v = BS.mkInst(ids[0]); v.cores = 1; P.spirits = [v]; P.burst = BS.mkInst('SD66-006'); P.hand = []; P.trash = [];
    BS.removeSpirit(P, v, 'destroyed', true); await BS.flushBursts();
    const summoned = P.spirits.some(s => s.id === 'SD66-006'), burstUsed = !P.burst;
    const lo = BS.mkInst(ids[1]); lo.cores = 1; const hi = BS.mkInst(ids[2]); hi.cores = 3; O.spirits = [hi, lo];
    const cands = BS.FX_ACTIONS.DESTROY.cands({ p: P, opp: O, src: P.spirits[0], ctx: {} }, { do: 'DESTROY', bpRank: 'lowest' });
    const lowestBp = Math.min(...O.spirits.map(BS.bpOf));
    return { summoned, burstUsed, n: cands.length, allLowest: cands.every(s => BS.bpOf(s) === lowestBp), ok: BS.CARDS['SD66-006'].fxComplete !== false }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.burstUsed, true, JSON.stringify(r));
  assert.equal(r.allLowest, true, JSON.stringify(r)); assert.ok(r.n >= 1, JSON.stringify(r));
});
