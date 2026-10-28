// v0.118.0 Rumble keyword {{Rumble|X}} (During Attack): at the end of the battle, discard X cards from the opposing
// decktop, minus the cost of the blocking Spirit card when it is now in the opposing Trash (Fandom keyword page "Rumble"
// FAQ 31592-31594, 31621). Engine: action RUMBLE {n:1-7} in 02o-effects-battle-end.js, queued at the ATTACKS trigger and
// resolved in endOfBattle() next to CURSE / BRILLIANCE, so the mill only happens when the attacker is still on the Field
// and only a Spirit blocker that reached the Trash reduces it. Scenario: tests/scenarios/rumble-end-of-battle-mill.json.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const FIX = [
  { id: 'TR-ATK', name: 'Rumbler', type: 'Spirit', color: 'blue', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'ATTACKS', lv: [1], actions: [{ do: 'RUMBLE', n: 3 }] }] },
  { id: 'TR-W4', name: 'Cost Four Wall', type: 'Spirit', color: 'red', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'TR-W1', name: 'Cost One Wall', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'TR-BIG', name: 'Big Wall', type: 'Spirit', color: 'red', cost: 5, symbols: 1, levels: [{ cores: 1, bp: 5000 }] },
  { id: 'TR-SMALL', name: 'Deck Filler', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 500 }] },
  { id: 'TR-EXF', name: 'EX Filler', type: 'Spirit', color: 'red', cost: 1, symbols: 1, ex_symbols: 1, levels: [{ cores: 1, bp: 500 }] },
  { id: 'TR-WATCH', name: 'Watcher', type: 'Spirit', color: 'blue', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'RUMBLE_DISCARD', actions: [{ do: 'DRAW', n: 1 }] }] },
  { id: 'TR-WEX', name: 'EX Watcher', type: 'Spirit', color: 'blue', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'RUMBLE_DISCARD', exOnly: true, actions: [{ do: 'DRAW', n: 1 }] }] },
  { id: 'TR-WOTH', name: 'Other Watcher', type: 'Spirit', color: 'blue', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 1000 }], effects: [{ trigger: 'RUMBLE_DISCARD', other: true, actions: [{ do: 'DRAW', n: 1 }] }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; q.void = 10; q.hand = []; q.life = 5; }
  O.deck = [BS.mkInst('TR-SMALL'), BS.mkInst('TR-SMALL'), BS.mkInst('TR-SMALL'), BS.mkInst('TR-SMALL'), BS.mkInst('TR-SMALL'), BS.mkInst('TR-SMALL')];
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const block = b => { window.cpuChooseBlock = () => b; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('RUM-01 unblocked: Rumble mills its full number', async () => {
  const r = await ev(`const a = sp('TR-ATK'); const d0 = O.deck.length; block(null); await BS.doBattle('player', a);
    return { milled: d0 - O.deck.length, trash: O.trash.length };`);
  assert.deepEqual(r, { milled: 3, trash: 3 });
});

test('RUM-02 blocked by a destroyed Spirit whose cost covers X: no cards are discarded', async () => {
  const r = await ev(`const a = sp('TR-ATK'); const w = sp('TR-W4', O); const d0 = O.deck.length; block(w); await BS.doBattle('player', a);
    return { milled: d0 - O.deck.length, trash: O.trash.length, blockerGone: !O.spirits.includes(w) };`);
  assert.deepEqual(r, { milled: 0, trash: 1, blockerGone: true }, 'Cost 4 blocker (X=3) reduces the mill to 0; only the blocker is in the Trash');
});

test('RUM-03 blocked by a destroyed Cost 1 Spirit: X minus 1 cards are discarded', async () => {
  const r = await ev(`const a = sp('TR-ATK'); const w = sp('TR-W1', O); const d0 = O.deck.length; block(w); await BS.doBattle('player', a);
    return { milled: d0 - O.deck.length, trash: O.trash.length };`);
  assert.deepEqual(r, { milled: 2, trash: 3 }, '3 - cost 1 = 2 milled, plus the blocker = 3 cards in the Trash');
});

test('RUM-04 the attacker destroyed by BP: Rumble does not resolve', async () => {
  const r = await ev(`const a = sp('TR-ATK'); const w = sp('TR-BIG', O); const d0 = O.deck.length; block(w); await BS.doBattle('player', a);
    return { milled: d0 - O.deck.length, attackerInTrash: P.trash.includes(a) };`);
  assert.deepEqual(r, { milled: 0, attackerInTrash: true }, 'the attacker left the Field, so no mill');
});

test('RUM-05 the shipped Rumble cards carry the keyword and the RUMBLE effect', async () => {
  const r = await g.page.evaluate(() => {
    const c = BS.CARDS['26RBS01-079'];
    return {
      keywords: c.keywords, implemented: c.implemented, partial: c.partial,
      rumble: (c.effects || []).filter(e => e.trigger === 'ATTACKS').map(e => e.actions.map(a => a.do + ':' + a.n)),
      txt: BS.FX_ACTIONS.RUMBLE.txt({ n: 3 }),
    };
  });
  assert.ok(r.keywords.includes('RUMBLE'), String(r.keywords));
  assert.equal(r.implemented, true, 'the card is complete');
  assert.equal(r.partial, false);
  assert.deepEqual(r.rumble, [['RUMBLE:3']]);
  assert.match(r.txt, /Rumble 3/);
});

test('RUM-06 RUMBLE_DISCARD fires for a watcher; exOnly needs an EX card', async () => {
  const r = await ev(`const a = sp('TR-ATK'); sp('TR-WATCH'); sp('TR-WEX'); sp('TR-WOTH');
    P.deck = [1, 2, 3, 4, 5].map(() => BS.mkInst('TR-SMALL')); block(null); await BS.doBattle('player', a); const plain = P.hand.length;
    P.hand = []; O.deck = [BS.mkInst('TR-EXF'), BS.mkInst('TR-SMALL'), BS.mkInst('TR-SMALL')]; const b = sp('TR-ATK'); block(null); await BS.doBattle('player', b);
    return { plain, withEx: P.hand.length };`);
  assert.equal(r.plain, 2, 'no EX card milled: only Watcher and Other Watcher draw');
  assert.equal(r.withEx, 3, 'an EX card was milled: the EX Watcher draws too');
});
