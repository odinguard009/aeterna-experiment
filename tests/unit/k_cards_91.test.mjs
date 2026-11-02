// Lane K cards, batch 91 (saga-60 product cards).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-1101 PB44-RV006 and SD50-CP05 (Song Flash) set the end of the Attack Step after this battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const out = [];
    for (const id of ['PB44-RV006', 'SD50-CP05']) {
      const att = BS.mkInst('BS01-001'); att.cores = 1; O.spirits = [att]; G.attacker = att; G.endAttackAfter = null;
      P.reserve.n = 20; const m = BS.mkInst(id); P.hand = [m];
      await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
      out.push({ id, impl: BS.CARDS[id].implemented === true, end: G.endAttackAfter });
    }
    return out; })()`);
  for (const x of r) { assert.equal(x.impl, true, JSON.stringify(r)); assert.ok(x.end, JSON.stringify(r)); }
});

test('K-1102 SD44-004 refreshes itself on attack (LV2) and draws with a Red symbol', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const s = BS.mkInst('SD44-004'); s.cores = 3; s.exhausted = true; P.spirits = [s];
    P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001')]; P.hand = [];
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s });
    return { ex: !!s.exhausted, impl: BS.CARDS['SD44-004'].implemented === true, hand: P.hand.length, red: BS.CARDS['SD44-004'].symbol }; })()`);
  assert.equal(r.impl, true, JSON.stringify(r));
  assert.equal(r.ex, false, JSON.stringify(r));
  assert.equal(r.hand, r.red === 'red' ? 1 : 0, JSON.stringify(r));
});
