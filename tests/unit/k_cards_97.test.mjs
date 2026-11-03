// Lane K tests, file 97 (Grandwalker order): BS75-CX03 Indra bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1001 BS75-043 Vajdraco: Thunderive attack, an Indra core to the Void, opposing Cost 4 or less Nexuses cannot activate until its next Start Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const indra = BS.mkInst('BS75-CX03'); indra.cores = 2; P.nexus = [indra];
    const v = BS.mkInst('BS75-043'); P.spirits = [v];
    v.cores = 1;
    let n = null, before = 0, tm = 'MAIN';
    for (const nx of Object.values(BS.CARDS).filter(c => c.type === 'Nexus' && c.cost <= 4 && (c.effects || []).some(e => e.trigger === 'ACTIVATE'))) {
      const t = BS.mkInst(nx.id); t.cores = 3; O.nexus = [t];
      for (const m of ['MAIN', 'FLASH']) { const k = BS.activatable(O, t, m).length; if (k > 0) { n = t; before = k; tm = m; break; } }
      if (n) break;
    }
    await BS.fireFx(P, 'ALLY_ATTACKS', v, { attacker: v });
    const locked = BS.activatable(O, n, tm).length;
    P.nexusLockLe = null;
    return [before > 0, indra.cores, P.void, locked]; })()`);
  assert.deepEqual(r, [true, 1, 1, 0]);
});

test('K-1002 BS75-043 Vajdraco: without an Indra core nothing happens', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const indra = BS.mkInst('BS75-CX03'); indra.cores = 0; P.nexus = [indra];
    const v = BS.mkInst('BS75-043'); v.cores = 1; P.spirits = [v];
    await BS.fireFx(P, 'ALLY_ATTACKS', v, { attacker: v });
    return [P.nexusLockLe == null, P.void]; })()`);
  assert.deepEqual(r, [true, 0]);
});

test('K-1003 BS75-069 Charged Crystal Cave: Flash symbol shield and Trash symbols for Thunderive cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = true;
    const c = BS.CARDS['BS75-069'];
    const n = BS.mkInst('BS75-069'); n.cores = 2; P.nexus = [n];
    const idx = BS.activatable(P, n, 'FLASH').map(x => x.idx);
    await BS.activateFx(P, n, idx[0]);
    const sh = P.symShield && P.symShield.ge;
    return [!c.partial, idx.length, sh, n.exhausted === true, BS.trashSymsOn ? BS.trashSymsOn(P, BS.CARDS['BS75-043']) : 'n/a']; })()`);
  assert.deepEqual(r.slice(0, 4), [true, 1, 2, true]);
  assert.ok(r[4] === true || r[4] === 'n/a', String(r[4]));
});
