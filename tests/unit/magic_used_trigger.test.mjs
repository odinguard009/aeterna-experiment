// v0.116.0 "When you use a <family>/<colour> Magic card" (trigger MAGIC_USED) and the condition
// magicUsed ("if you used a <family> Magic card this turn"). 26RBS01 keyword heads of the Standard
// block A pack. The trigger fires after the Magic resolved (the card is in the Trash by then); a
// Burst is not a use of a Magic card. Rules: Standard Comprehensive Rules 12-2 (Common Effects) —
// the card text names the event, the engine only supplies it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

const SCEN = {
  turn: 3, active: 'opponent', step: 5,
  players: {
    player: {
      hand: ['26RBS01-121'],
      deck: ['26RBS01-001', '26RBS01-001', '26RBS01-001', '26RBS01-001'],
      reserve: 10, soul: 'trash',
      spirits: [{ id: '26RBS01-061', cores: 2, as: 'stodol' }],
    },
    opponent: { reserve: 3, spirits: [{ id: '26RBS01-001', cores: 1, as: 'attacker' }] },
  },
};

const ev = body => g.page.evaluate(`(async () => {
  const r = BS.loadScenario(${JSON.stringify(SCEN)}); if (!r.ok) throw new Error(r.error);
  BS.SETTINGS.speed = 'instant';
  const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; G.battleNo = 1; G.attacker = O.spirits[0];
  ${body}
})()`);

test('M116-01 a Topaz Magic in the opposing Attack Step gives the watching Spirit +2000 BP for that battle', async () => {
  const r = await ev(`const s = P.spirits[0], base = BS.bpOf(s);
    await BS.castMagic(P, { inst: P.hand[0] });
    return { base, after: BS.bpOf(s), bpB: s.bpB || null, battle: G.battleNo, trash: P.trash.map(x => x.id) };`);
  assert.equal(r.after, r.base + 2000, `BP ${r.base} -> ${r.after}`);
  assert.deepEqual(r.bpB, { n: 2000, b: r.battle });
  assert.deepEqual(r.trash, ['26RBS01-121']);
});

test('M116-02 a Magic of another family is cast but does not trigger it', async () => {
  const r = await ev(`P.hand = [BS.mkInst('BS01-117')]; P.reserve = { n: 10, soul: false };
    const s = P.spirits[0], base = BS.bpOf(s);
    await BS.castMagic(P, { inst: P.hand[0] });
    return { base, after: BS.bpOf(s), bpB: s.bpB || null, trash: P.trash.map(x => x.id) };`);
  assert.deepEqual(r.trash, ['BS01-117'], 'the other Magic was used');
  assert.equal(r.after, r.base);
  assert.equal(r.bpB, null);
});

test('M116-03 the BP bonus is gone outside that battle', async () => {
  const r = await ev(`const s = P.spirits[0], base = BS.bpOf(s);
    await BS.castMagic(P, { inst: P.hand[0] });
    const during = BS.bpOf(s);
    G.attacker = null;                       // the battle ended
    const after = BS.bpOf(s);
    return { base, during, after };`);
  assert.equal(r.during, r.base + 2000);
  assert.equal(r.after, r.base);
});

test('M116-04 condition magicUsed: true after a matching Magic this turn, false for another family', async () => {
  const r = await ev(`await BS.castMagic(P, { inst: P.hand[0] });
    return [BS.fxIf(P, O, { magicUsed: { family: ['Topaz'] } }), BS.fxIf(P, O, { magicUsed: { family: ['Wailwraith'] } })];`);
  assert.deepEqual(r, [true, false]);
});

test('M116-05 26RBS01-068 draws two on (When Summoned) only when a Topaz Magic was used this turn', async () => {
  const r = await ev(`const sn = BS.mkInst('26RBS01-068'); sn.cores = 3; P.spirits.push(sn);
    const before = P.hand.length;
    await BS.fireFx(P, 'SUMMONED', sn);
    const withoutMagic = P.hand.length;
    await BS.castMagic(P, { inst: BS.mkInst('26RBS01-121') });
    await BS.fireFx(P, 'SUMMONED', sn);
    return { before, withoutMagic, withMagic: P.hand.length };`);
  assert.equal(r.withoutMagic, r.before, 'no Magic used yet: no draw');
  assert.equal(r.withMagic, r.withoutMagic + 2, 'two cards drawn');
});
