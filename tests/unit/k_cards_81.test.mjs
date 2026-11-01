// Lane K tests, file 81. Schema v277: OWN_CORES_TO_TRASH, OPP_SELF_CORES_TO_TRASH. Cards: BS09-070, BS08-072.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-839 OWN_CORES_TO_TRASH then OPP_SELF_CORES_TO_TRASH move cores from Spirits to the Trash (BS09-070)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const a = BS.mkInst('BS01-001'); a.cores = 2; P.spirits = [a]; const b = BS.mkInst('BS01-001'); b.cores = 2; O.spirits = [b];
    const acts = BS.CARDS['BS09-070'].magic.by.FLASH.actions; const c = { p: P, opp: O, src: BS.mkInst('BS09-070'), ctx: {} };
    const t0 = P.trashCores.n, o0 = O.trashCores.n;
    await BS.FX_ACTIONS.OWN_CORES_TO_TRASH.run(c, acts[0]); c.ctx.prev = c.ctx.did !== false;
    await BS.FX_ACTIONS.OPP_SELF_CORES_TO_TRASH.run(c, acts[1]);
    return [a.cores, b.cores, P.trashCores.n - t0, O.trashCores.n - o0, BS.FX_ACTIONS.OWN_CORES_TO_TRASH.chk(acts[0])]; })()`);
  assert.deepEqual(r, [1, 1, 1, 1, true], JSON.stringify(r));
});
