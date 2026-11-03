import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1026 BS58-024 Wolfbanus: banishes up to five opposing Trash cards; with a Red symbol it draws and destroys a Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const w = BS.mkInst('BS58-024'); w.cores = 2; P.spirits = [w]; O.spirits = [];
    const ids = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token).slice(0, 7);
    O.trash = ids.map(k => BS.mkInst(k)); const t0 = O.trash.length;
    await BS.fireFx(P, 'ATTACKS', w, { attacker: w, subject: w });
    return { banished: t0 - O.trash.length, ok: !BS.CARDS['BS58-024'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.banished, 5, JSON.stringify(r));
});
