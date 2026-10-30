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

test('K-148 26RCB01-053: TRASH_CORES_TO toLife moves a Trash core to the Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const c = { p: P, opp: O, src: BS.mkInst('26RCB01-053'), ctx: {} };
    P.trashCores.n = 2; const l0 = P.life;
    await BS.runActions(c, { actions: [{ do: 'TRASH_CORES_TO', n: 1, toLife: true }] });
    return [P.life - l0, P.trashCores.n, BS.CARDS['26RCB01-053'].effects.length]; })()`);
  assert.deepEqual(r, [1, 1, 3], JSON.stringify(r));
});

test('K-149 26RCB01-047: Brave Fantasy LV2 draws 2 then returns 2 (HAND_TO_BOTTOM n:2 forced)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RCB01-047'].effects[2];
    const c = { p: P, opp: O, src: BS.mkInst('26RCB01-047'), ctx: {} };
    const d0 = P.deck.length; await BS.runActions(c, { actions: fx.actions });
    return [P.hand.length, d0 - P.deck.length, fx.if.ctrl.family]; })()`);
  assert.deepEqual(r, [0, 0, 'EX-AID'], JSON.stringify(r));
});

test('K-150 26RSD10-X02: Swordish BP+2000 in either Attack Step; LV2 sends 1 Token, +1 if two cards are returned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RSD10-X02'].effects;
    return [fx[0].bp, fx[0].if.oppTurn === undefined, fx[1].actions.map(a => a.do).join()]; })()`);
  assert.deepEqual(r, [2000, true, 'SEND_TOKEN,HAND_TO_BOTTOM,SEND_TOKEN'], JSON.stringify(r));
});

test('K-151 26RSD05-009: Thunder Driftways gives attacking Thunder Dragons a bpLe 1000 block mark; LV2 START_MAIN -2000', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const fx = BS.CARDS['26RSD05-009'].effects, a = BS.mkInst('BS48-047'), c = { p: P, opp: O, src: BS.mkInst('26RSD05-009'), ctx: { attacker: a } };
    await BS.runActions(c, { actions: fx[0].actions });
    return [a.noBlockBy.bpLe, fx[1].trigger, fx[1].actions[0].n]; })()`);
  assert.deepEqual(r, [1000, 'START_MAIN', 2000], JSON.stringify(r));
});

test('K-152 26RSD10-T001: Swordish token gains an extra Green symbol on START_MAIN and when summoned', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${SETUP}
    const c = { p: P, opp: O, src: BS.mkInst('26RSD10-T001'), ctx: {} }; P.spirits.push(c.src);
    await BS.runActions(c, { actions: BS.CARDS['26RSD10-T001'].effects[0].actions });
    return [c.src.symTurn.cols.join(), BS.CARDS['26RSD10-T001'].effects.map(e => e.trigger).join()]; })()`);
  assert.deepEqual(r, ['green', 'START_MAIN,SUMMONED'], JSON.stringify(r));
});
