// Lane K tests, file 3 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SETUP = `const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits.length = 0; q.nexus.length = 0; q.hand.length = 0; }`;

test('K-147 26RDB01-049: Red Stella Nexus gives +1000 BP in your Attack Step; exhausted Red Stella Spirits are unaffected by opposing Magic (match.exhausted)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const n = BS.mkInst('26RDB01-049'); n.cores = 3; P.nexus.push(n);
    const fx = BS.CARDS['26RDB01-049'].effects;
    const t = BS.mkInst('26RDB01-049'); const m = fx[1].match;
    const ok = x => fxMatch(BS.CARDS[x.id], m, x);
    const A = BS.mkInst('BS48-047'); A.exhausted = true; const B = BS.mkInst('BS48-047');
    return [fx[0].bp, m.team, m.exhausted, fxMatch(BS.CARDS[A.id], { exhausted: true }, A), fxMatch(BS.CARDS[A.id], { exhausted: true }, B), fxMatch(BS.CARDS[A.id], { team: "Red Stella" }, A)]; })()`);
  assert.deepEqual(r, [1000, "Red Stella", true, true, false, false], JSON.stringify(r));
});
