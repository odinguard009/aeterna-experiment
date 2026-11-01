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

test('K-866 BS01-109 refreshes a High Speed Spirit at the Opposing Start Step and gives a summoned Spirit +1000 BP at LV2', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const n = BS.mkInst('BS01-109'); n.cores = 2; P.nexus = [n];
    const h = BS.mkInst('BS01-053'); h.cores = 1; h.exhausted = true; P.spirits = [h]; const out = [];
    await BS.fireFx(P, 'OPP_START_STEP', null, {}); out.push(h.exhausted);
    const s = BS.mkInst('BS01-001'); s.cores = 1; P.spirits.push(s); const b = BS.bpOf(s);
    await BS.fireFx(P, 'SUMMONED', s, { subject: s }); out.push(BS.bpOf(s) - b);
    n.cores = 0; const s2 = BS.mkInst('BS01-001'); s2.cores = 1; P.spirits.push(s2); const b2 = BS.bpOf(s2);
    await BS.fireFx(P, 'SUMMONED', s2, { subject: s2 }); out.push(BS.bpOf(s2) - b2);
    return out; })()`);
  assert.deepEqual(r, [false, 1000, 0], JSON.stringify(r));
});
