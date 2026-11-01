// Lane K tests, file 82. Schema v286-: handLeOpp, OPP_START_STEP.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-865 BS02-077 refreshes Awaken Spirits at the Opposing Start Step (one at LV1, all at LV2)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS02-077'); n.cores = 1; P.nexus = [n];
    const mk = () => { const x = BS.mkInst('BS31-008'); x.cores = 1; x.exhausted = true; return x; };
    const kw = BS.cardHasKeyword ? BS.cardHasKeyword(BS.CARDS['BS31-008'], 'Awaken') : null;
    P.spirits = [mk(), mk()]; const out = [kw];
    await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(P.spirits.filter(x => x.exhausted).length);
    n.cores = 4; P.spirits = [mk(), mk()];
    await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(P.spirits.filter(x => x.exhausted).length);
    return out; })()`);
  assert.deepEqual(r.slice(1), [1, 0], JSON.stringify(r));
});
