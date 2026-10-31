// Lane K tests, file 14 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v205 (Magirrate): 26RBS01-103, 26RBS01-123, 26RBS01-X04
// (viaMagirrate cast mark, blockerKeyword, TREAT_LV1, REVEAL_PICK discard, ACTIVATE_SUMMONED).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-292 data: the three bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RBS01-103', '26RBS01-123', '26RBS01-X04'].map(id => {
    const c = BS.CARDS[id];
    const acts = c.type === 'Magic' ? (c.magic.actions || []).map(a => a.do) : (c.effects || []).map(e => e.trigger);
    return [id, acts.join(','), c.implemented === true && !(c.residual || []).length];
  }));
  assert.deepEqual(r, [
    ['26RBS01-103', 'MAGIC_USED,ACTIVATE', true],
    ['26RBS01-123', 'OWN_CORE_TO_LIFE,REFRESH_SPIRIT', true],
    ['26RBS01-X04', 'SUMMONED,ATTACKS', true],
  ], JSON.stringify(r));
});

test('K-293 26RBS01-103 LV1-2: using a Magic card in the opposing Attack Step refreshes your exhausted Topaz Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const t = window.SC.magirrateBlocker, magic = BS.mkInst('26RBS01-123');
    G.step = 5; G.active = 'opponent';
    await BS.fireFx(P, 'MAGIC_USED', null, { subject: magic });
    const inOppAttack = !t.exhausted;
    t.exhausted = true; G.step = 4;
    await BS.fireFx(P, 'MAGIC_USED', null, { subject: magic });
    return [inOppAttack, t.exhausted];
  }, SPEC('thunder-erupting-mountain'));
  assert.deepEqual(r, [true, true], JSON.stringify(r));
});

test('K-294 26RBS01-103 LV2 (Opposing Attack Step): with a Magirrate blocker the Invoke exhausts this Nexus and treats the attacker as LV1', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const n = window.SC.mountain, a = window.SC.oppAttacker;
    G.attacker = a; G.blocker = window.SC.magirrateBlocker; G.battleNo = 42;
    const lv0 = BS.lvNo(a);
    const st = BS.activatable(P, n, 'FLASH').map(x => x.idx);
    const ok = await BS.activateFx(P, n, 1);
    return [st, ok, n.exhausted, lv0, BS.lvNo(a), a.lv1Battle === G.battleNo];
  }, SPEC('thunder-erupting-mountain'));
  assert.deepEqual(r, [[1], true, true, 2, 1, true], JSON.stringify(r));
});

test('K-295 26RBS01-123 cast via Magirrate: free from the Hand, one core to Life, and the Magirrate Spirit is refreshed', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const t = window.SC.thunderai, m = P.hand[0];
    G.step = 5; G.active = P.key; G.attacker = t; G.battleNo = 7;
    const life0 = P.life, res0 = P.reserve.n;
    const idx = BS.activatable(P, t, 'FLASH').map(x => x.idx);
    const ok = await BS.activateFx(P, t, idx[0]);
    return [idx, ok, P.trash.includes(m), P.hand.includes(m), P.life - life0, res0 - P.reserve.n, !t.exhausted];
  }, SPEC('thunder-shutter-magirrate'));
  assert.deepEqual(r, [[0], true, true, false, 1, 0, true], JSON.stringify(r));
});

test('K-296 26RBS01-123 cast normally: the via-Magirrate clause does not refresh', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const t = window.SC.thunderai, m = P.hand[0];
    G.step = 5; G.active = P.key;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'flash' });
    return [P.trash.includes(m), t.exhausted, P.life];
  }, SPEC('thunder-shutter-magirrate'));
  assert.deepEqual(r, [true, true, 6], JSON.stringify(r));
});

test('K-297 26RBS01-X04 LV1-2 (When Summoned): reveal three, discard a Purple card and return the rest to the deckbottom', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const trash0 = P.trash.length;
    await BS.fireFx(P, 'SUMMONED', window.SC.shireizen);
    return [P.trash.length - trash0, P.trash[P.trash.length - 1].id, P.deck.map(t => t.id), P.hand.length];
  }, SPEC('insect-lord-shireizen'));
  assert.deepEqual(r, [1, '26RBS01-021', ['26RBS01-002', '26RBS01-016'], 0], JSON.stringify(r));
});

test('K-298 26RBS01-X04 LV2 (When Attacks): your Spirit with Shamanism activates its Shamanism (its When Summoned summon)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    G.step = 5; G.active = P.key;
    const reserve0 = P.reserve.n;
    await BS.fireFx(P, 'ATTACKS', window.SC.shireizen, { attacker: window.SC.shireizen });
    return [P.spirits.some(s => s.id === '26RBS01-016'), P.trash.some(t => t.id === '26RBS01-016'), reserve0 - P.reserve.n];
  }, SPEC('insect-lord-shireizen'));
  assert.deepEqual(r, [true, false, 2], JSON.stringify(r));
});
