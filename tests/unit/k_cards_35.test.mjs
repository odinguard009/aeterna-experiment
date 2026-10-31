// Lane K tests, file 35 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 21 of v0.202.0: 26RSD06-011 (Barrage Forest) and 26RBS03-067 (Cryptorop).
// Engine pieces: STATIC ATK_TAX (payAtkTax), NEXUS_DIED.byBattle, DESTROY_OWN_NEXUS.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-400 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RSD06-011', '26RBS03-067'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger + (e.flag ? ':' + e.flag : '')).join(','), c.implemented === true];
  }));
  assert.deepEqual(r[0][0], '26RSD06-011');
  assert.ok(r[0][1].includes('STATIC:ATK_TAX'), JSON.stringify(r));
  assert.deepEqual(r[1], ['26RBS03-067', 'ALLY_ATTACKS,ALLY_NEXUS_DESTROYED', true], JSON.stringify(r));
});

test('K-401 26RSD06-011 LV2: an opposing LV1 attack is cancelled unless its owner pays one cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, att = window.SC.oppLv1;
    G.step = 5; G.active = O.key;
    const broke = await BS.payAtkTax(O, P, att);         // no Reserve core: the attack cannot be paid
    O.reserve.n = 2;
    const paid = await BS.payAtkTax(O, P, att);
    return [broke, paid, O.reserve.n, O.trashCores.n];
  }, SPEC('barrage-and-cryptorop'));
  assert.deepEqual(r, [false, true, 1, 1], JSON.stringify(r));
});

test('K-402 26RBS03-067 LV1-2: a Cyantree attack can destroy a Nexus to draw two and return one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.cryptorop, att = window.SC.cyantreeSpirit;
    G.step = 5; G.active = P.key;
    P.nexus = P.nexus.filter(n => n !== window.SC.barrage);      // every remaining Nexus is Cyantree
    const n0 = P.nexus.length, h0 = P.hand.length, d0 = P.deck.length;
    await BS.fireFx(P, 'ALLY_ATTACKS', null, { subject: att });
    return [n0 - P.nexus.length, P.hand.length - h0, d0 - P.deck.length];
  }, SPEC('barrage-and-cryptorop'));
  assert.equal(r[0], 1, JSON.stringify(r));      // one Nexus destroyed
  assert.equal(r[1], 1, JSON.stringify(r));      // drew two, returned one
});

test('K-403 26RBS03-067 LV2: an originally-Nexus Spirit destroyed by BP comparison returns to the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.cryptorop;
    G.step = 5; G.active = P.key; G.evQ = []; G.fxBy = O.key;
    const as = BS.mkInst('26RBS01-106'); as.cores = 1; as.asSpirit = true; P.spirits.push(as);
    BS.removeSpirit(P, as, 'destroyed', 'battle');       // BP comparison
    const inTrash = P.trash.includes(as);
    await BS.fireFx(P, 'ALLY_NEXUS_DESTROYED', as, { subject: as, byBattle: true });
    return [inTrash, P.hand.includes(as), P.trash.includes(as)];
  }, SPEC('barrage-and-cryptorop'));
  assert.deepEqual(r, [true, true, false], JSON.stringify(r));
});
