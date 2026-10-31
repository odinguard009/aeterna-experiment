// Lane K tests, file 7 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v192: 26RBS01-X14, 26RBS02-059, 26RBS03-059, 26RBS03-X12 (OPP_DIED / RETURN_SUBJECT / BP_MINUS.targets / trashSymbolsIf).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-234 data: the four bundle cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS01-X14', '26RBS02-059', '26RBS03-059', '26RBS03-X12'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [
    ['26RBS01-X14', 2, 'SUMMONED,MAGIC_USED'],
    ['26RBS02-059', 1, 'SUMMONED'],
    ['26RBS03-059', 2, 'ALLY_BLOCKED,ALLY_DIED'],
    ['26RBS03-X12', 2, 'OPP_DIED,ALLY_BLOCKED'],
  ], JSON.stringify(r));
});

test('K-235 26RBS01-X14 LV1-2: two opposing Spirits get -2000 BP and both at 0 are destroyed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.zelotl;
    await BS.fireFx(P, 'SUMMONED', x);
    const both = O.spirits.length;                                 // two 2000 BP Spirits -> both destroyed
    const big = BS.mkInst('BS48-047'); big.cores = 2; big.bpMod = 2000; O.spirits.push(big);   // 5000 BP -> 3000 after -2000, survives
    await BS.runActions({ p: P, opp: O, src: x, ctx: {} }, { actions: BS.CARDS['26RBS01-X14'].effects[0].actions });
    return [both, O.spirits.length, BS.bpOf(big), BS.CARDS['26RBS01-X14'].effects[0].actions[0].targets];
  }, SPEC('x14-two-bp-minus'));
  assert.deepEqual(r, [0, 1, 3000, 2], JSON.stringify(r));
});

test('K-236 26RBS01-X14 LV2 (During Attack): a used Thunder Dragon Magic returns to the Hand; another Magic does not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.zelotl; x.cores = 3;                       // LV2
    const magic = window.SC.thunderMagic;
    G.step = 5; G.active = P.key; G.attacker = x;
    await BS.fireFx(P, 'MAGIC_USED', magic, { subject: magic });
    const family = P.hand.includes(magic) && !P.trash.includes(magic);
    const otherMagic = BS.mkInst('26RBS01-121');                   // a Topaz Magic is not "Thunder Dragon"
    P.trash.push(otherMagic); P.hand = P.hand.filter(h => h !== otherMagic);
    await BS.fireFx(P, 'MAGIC_USED', otherMagic, { subject: otherMagic });
    return [family, P.hand.includes(otherMagic), BS.CARDS['26RBS01-X14'].effects[1].actions[0].do];
  }, SPEC('x14-two-bp-minus'));
  assert.deepEqual(r, [true, false, 'RETURN_SUBJECT'], JSON.stringify(r));
});

test('K-237 26RBS02-059 LV1-2: with another Wailwraith/Hexcraft Spirit, -4000 BP destroys; without one nothing happens', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const b = window.SC.bisqular, ally = window.SC.hexcraftAlly;
    const t = window.SC.oppSpirit; t.bpMod = 1000;                 // 3000 BP -> 0 after -4000
    await BS.fireFx(P, 'SUMMONED', b);
    const withAlly = !O.spirits.includes(t);
    const t2 = BS.mkInst('BS48-047'); t2.cores = 1; t2.bpMod = 1000; O.spirits.push(t2);
    P.spirits = P.spirits.filter(s => s !== ally);
    await BS.fireFx(P, 'SUMMONED', b);
    return [withAlly, O.spirits.includes(t2), BS.CARDS['26RBS02-059'].effects[0].actions[0].if.ctrl.family];
  }, SPEC('bisqular-trash-symbols'));
  assert.deepEqual(r, [true, true, ['Wailwraith', 'Hexcraft']], JSON.stringify(r));
});

test('K-238 26RBS02-059 summoning: Trash symbols reduce the cost only from the second attack of the turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const card = BS.CARDS['26RBS02-059'];
    P.attacksThisTurn = 1; const one = effCost(P, card);
    P.attacksThisTurn = 2; const two = effCost(P, card);
    return [card.trashSymbolsIf && card.trashSymbolsIf.attacksGe, card.cost, one, two];
  }, SPEC('bisqular-trash-symbols'));
  assert.deepEqual(r, [2, 6, 4, 2], JSON.stringify(r));
});

test('K-239 26RBS03-059 LV1-2 (During Attack): when blocked, -3000 BP destroys a 3000 BP Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const r = window.SC.railsaurer, blk = window.SC.blocker;
    G.step = 5; G.active = P.key; G.attacker = r; G.blocker = blk;
    await BS.fireFx(P, 'ALLY_BLOCKED', r, { attacker: r, blocker: blk, subject: r });
    return [O.spirits.includes(blk), BS.CARDS['26RBS03-059'].effects[0].actions[0].n];
  }, SPEC('railsaurer-blocked-bp'));
  assert.deepEqual(r, [false, 3000], JSON.stringify(r));
});

test('K-240 26RBS03-059 LV2 (Opposing Attack Step): a destroyed Topaz Cost 6/8 ally returns to the Hand; another ally does not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const r = window.SC.railsaurer; r.cores = 4;                   // LV2
    G.step = 5; G.active = G.p.opponent.key;
    const ally = window.SC.topazAlly;
    BS.removeSpirit(P, ally, 'destroyed', false); await BS.flushBursts();
    const topaz = P.hand.includes(ally);
    const plain = BS.mkInst('BS48-047'); plain.cores = 1; P.spirits.push(plain);
    BS.removeSpirit(P, plain, 'destroyed', false); await BS.flushBursts();
    return [topaz, P.hand.includes(plain)];
  }, SPEC('railsaurer-blocked-bp'));
  assert.deepEqual(r, [true, false], JSON.stringify(r));
});

test('K-241 26RBS03-X12 LV1-2 (Your Attack Step): an opposing 2000 BP or less Spirit destroyed refreshes it, a bigger one does not', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.irmaides;
    BS.removeSpirit(O, window.SC.smallSpirit, 'destroyed', false); await BS.flushBursts();
    const small = !x.exhausted;
    x.exhausted = true;
    const big = BS.mkInst('26RBS01-X09'); big.cores = 2; O.spirits.push(big);       // 11000 BP
    BS.removeSpirit(O, big, 'destroyed', false); await BS.flushBursts();
    return [small, x.exhausted];
  }, SPEC('x12-opp-died'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-242 26RBS03-X12 LV2: a blocked Wailwraith/Hexcraft ally gives -4000 BP to the blocking Spirit and destroys it at 0', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.irmaides; x.cores = 3;                     // LV2
    const ally = BS.mkInst('26RBS01-061'); ally.cores = 1; P.spirits.push(ally);   // Hexcraft
    const blk = BS.mkInst('BS48-047'); blk.cores = 2; O.spirits.push(blk);        // 3000 BP
    G.step = 5; G.active = P.key; G.attacker = ally; G.blocker = blk;
    await BS.fireFx(P, 'ALLY_BLOCKED', ally, { attacker: ally, blocker: blk, subject: ally });
    return [O.spirits.includes(blk), BS.CARDS['26RBS03-X12'].effects[1].actions[0].blockerOnly];
  }, SPEC('x12-opp-died'));
  assert.deepEqual(r, [false, true], JSON.stringify(r));
});
