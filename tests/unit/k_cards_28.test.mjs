// Lane K tests, file 28 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 14 of v0.202.0: 26RCB01-057 (Sakura Hurricane) and 26RBS03-X03 (Zekuga).
// Engine pieces: BP_REACHED match filter, TRASH_CORES_TO.toPick, SOUL_AWAKEN.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-373 data: the bundle cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RCB01-057', '26RBS03-X03'].map(id => {
    const c = BS.CARDS[id];
    return [id, (c.effects || []).map(e => e.trigger).join(','), c.implemented === true];
  }));
  assert.deepEqual(r, [
    ['26RCB01-057', 'BP_REACHED,END_STEP', true],
    ['26RBS03-X03', 'ATTACKS,ALLY_BATTLE_END', true],
  ], JSON.stringify(r));
});

test('K-374 26RCB01-057 LV1-2 (Your Attack Step): a GAIM Spirit whose BP rose draws when the Hand is four or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.sakura, gaim = window.SC.gaim;
    G.step = 5; G.active = P.key;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'BP_REACHED', gaim, { subject: gaim, bpFrom: 0 });      // the engine fires from the Spirit that crossed
    const on = P.hand.length - h0;
    const other = BS.mkInst('26RBS01-004'); other.cores = 1; P.spirits.push(other);      // not a GAIM Spirit: nothing
    const h1 = P.hand.length;
    await BS.fireFx(P, 'BP_REACHED', other, { subject: other, bpFrom: 0 });
    const off = P.hand.length - h1;
    for (let i = 0; i < 4; i++) P.hand.push(BS.mkInst('26RBS01-005'));                    // Hand five: nothing
    const h2 = P.hand.length;
    await BS.fireFx(P, 'BP_REACHED', gaim, { subject: gaim, bpFrom: 0 });
    return [on, off, P.hand.length - h2];
  }, SPEC('sakura-and-zekuga'));
  assert.deepEqual(r, [1, 0, 0], JSON.stringify(r));
});

test('K-375 26RCB01-057 LV2 (Your End Step): up to two Trash cores go to a Kamen Rider Gaim', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.sakura, gaim = window.SC.gaim;
    G.step = 7; G.active = P.key;
    const c0 = gaim.cores, tc0 = P.trashCores.n;
    await BS.fireFx(P, 'END_STEP', t);
    return [gaim.cores - c0, tc0 - P.trashCores.n];
  }, SPEC('sakura-and-zekuga'));
  assert.deepEqual(r, [2, 2], JSON.stringify(r));
});

test('K-376 26RBS03-X03 LV1-2 (Soul Awaken): the Soul Core moves to it and it refreshes, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.zekuga, soul = window.SC.soulNexus;
    G.step = 5; G.active = P.key;
    t.exhausted = true;
    const c0 = t.cores;
    await BS.fireFx(P, 'ATTACKS', t);
    const on = [t.cores - c0, !!t.soul, !t.exhausted, !!soul.soul];
    t.exhausted = true;
    await BS.fireFx(P, 'ATTACKS', t);                     // once per turn
    return [on, t.cores - c0, t.exhausted];
  }, SPEC('sakura-and-zekuga'));
  assert.deepEqual(r[0], [1, true, true, false], JSON.stringify(r));
  assert.deepEqual(r[1], 1, JSON.stringify(r));
  assert.deepEqual(r[2], true, JSON.stringify(r));
});

test('K-377 26RBS03-X03 LV2 (During Attack): the end of its battle sends an opposing Life to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent, t = window.SC.zekuga;
    G.step = 5; G.active = P.key; G.attacker = t; G.battleNo = 5;
    const l0 = O.life, r0 = O.reserve.n;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: t });
    return [l0 - O.life, O.reserve.n - r0];
  }, SPEC('sakura-and-zekuga'));
  assert.deepEqual(r, [1, 1], JSON.stringify(r));
});
