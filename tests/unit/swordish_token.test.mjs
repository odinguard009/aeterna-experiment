// Tests for 26RSD10-T001 (Swordish) token registration, deck validation, and field mechanics.
// Rules: Eternal rule manual VER.17.0 p. 56-57 (Tokens) & Standard block A token data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const SWORDISH = '26RSD10-T001';

before(async () => {
  g = await openGame('');
});

after(async () => {
  await g.page.close();
  await closeBrowser();
});

const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent, SW = '${SWORDISH}';
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.tokens[SW] = 10; q.onceUsed = {}; }`;

const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('T01 Swordish is registered as a Token Spirit with verified properties and fxComplete: false', async () => {
  const r = await g.page.evaluate(id => {
    const c = BS.CARDS[id];
    return {
      type: c.type,
      token: c.token,
      cost: c.cost,
      symbols: c.symbols,
      color: c.symbol,
      families: c.families,
      levels: c.levels,
      implemented: c.implemented,
      partial: c.partial,
      residual: c.residual
    };
  }, SWORDISH);

  assert.deepEqual(r, {
    type: 'Spirit',
    token: true,
    cost: 0,
    symbols: 0,
    color: 'green',
    families: ['Abyssen'],
    levels: [{ cores: 1, bp: 2000 }],
    implemented: false,
    partial: true,
    residual: ['[LV1] (Your Turn) This Spirit gains an extra Green symbol.']
  });
});

test('T02 Swordish token can never be put into a Deck or chosen as Key Spirit', async () => {
  const r = await g.page.evaluate(id => {
    const d = { [id]: 1 };
    const deckErr = BS.validateDeck(d).errors;
    const keyErr = BS.validateDeck({ [id]: 3 }, 'standard', id).errors;
    return { deckErr, keyErr };
  }, SWORDISH);

  assert.ok(r.deckErr.some(e => /Token cards cannot be put into a Deck/.test(e)));
  assert.ok(r.keyErr.some(e => /A Spirit card is required as the Key Spirit|Token cards cannot be put into a Deck/.test(e)));
});

test('T03 sending out Swordish token uses 1 core for Lv1 and has 2000 BP', async () => {
  const r = await ev(`
    const t = BS.sendToken(P, SW);
    return [P.spirits.includes(t), t.token, t.cores, P.reserve.n, P.tokens[SW], BS.bpOf(t)];
  `);
  assert.deepEqual(r, [true, true, 1, 9, 9, 2000]);
});

test('T04 Swordish token returns to token supply when destroyed or bounced', async () => {
  const r = await ev(`
    G.burstQ = [];
    const t1 = BS.sendToken(P, SW);
    BS.removeSpirit(P, t1, 'destroyed', true);
    const afterDestroy = [P.spirits.length, P.trash.length, P.tokens[SW], G.burstQ.length];

    const t2 = BS.sendToken(P, SW);
    BS.bounceCard(P, t2, 'hand');
    const afterBounceHand = [P.hand.length, P.spirits.length, P.tokens[SW]];

    const t3 = BS.sendToken(P, SW);
    BS.bounceCard(P, t3, 'deckBottom');
    const afterBounceDeck = [P.deck.length, P.spirits.length, P.tokens[SW]];

    return { afterDestroy, afterBounceHand, afterBounceDeck };
  `);

  assert.deepEqual(r.afterDestroy, [0, 0, 10, 0]);
  assert.deepEqual(r.afterBounceHand, [0, 0, 10]);
  assert.deepEqual(r.afterBounceDeck, [0, 0, 10]);
});

test('T05 SEND_TOKEN action accepts Swordish token id and loadScenario prepares supply', async () => {
  const r = await g.page.evaluate(id => {
    const act = BS.parseActionList([{ do: 'SEND_TOKEN', token: id, n: 1, ask: true }]);
    // Mock card with SEND_TOKEN
    BS.CARDS['TEST-SW-SENDER'] = {
      id: 'TEST-SW-SENDER',
      name: 'Test Sender',
      type: 'Spirit',
      symbol: 'green',
      cost: 2,
      levels: [{ cores: 1, bp: 2000 }],
      effects: [{ actions: [{ do: 'SEND_TOKEN', token: id, n: 1 }] }]
    };
    const sc = BS.loadScenario({
      turn: 3,
      active: 'player',
      step: 4,
      players: {
        player: { hand: ['TEST-SW-SENDER'] },
        opponent: { hand: ['BS01-016'] }
      }
    });
    const playerTokens = BS.G.p.player.tokens[id];
    const opponentTokens = BS.G.p.opponent.tokens[id] || 0;
    delete BS.CARDS['TEST-SW-SENDER'];
    return {
      actionError: act.error || null,
      scenarioOk: sc.ok,
      scenarioError: sc.error || null,
      playerTokens,
      opponentTokens
    };
  }, SWORDISH);

  assert.equal(r.actionError, null);
  assert.equal(r.scenarioError, null);
  assert.equal(r.scenarioOk, true);
  assert.equal(r.playerTokens, 10);
  assert.equal(r.opponentTokens, 0);
});

test('T06 dependent cards retain fxComplete: false and are not prematurely marked complete', async () => {
  const r = await g.page.evaluate(() => {
    const deps = ['26RSD10-X02'];   // 26RBS03-X07 was completed in schema 144 (Swordish send-out + Invoke refresh)
    return deps.map(id => {
      const c = BS.CARDS[id];
      return { id, implemented: c.implemented, partial: c.partial, hasResidual: (c.residual || []).length > 0 };
    });
  });

  for (const dep of r) {
    assert.equal(dep.implemented, false, `${dep.id} must not be marked implemented`);
    assert.equal(dep.partial, true, `${dep.id} must be marked partial`);
    assert.equal(dep.hasResidual, true, `${dep.id} must have residual clauses`);
  }
});
