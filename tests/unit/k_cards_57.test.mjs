// Lane K tests, file 57 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Next cycle bundle 17 (Eternal): BS17-038 and BS16-040 (DRAW per family with per.max).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-469 data: both Eternal cards carry their printed clauses', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS17-038', 'BS16-040'].map(id => {
    const c = BS.CARDS[id];
    return [id, c.implemented === true, (c.effects || []).map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [['BS17-038', true, 'MAGIC_USED'], ['BS16-040', true, 'DESTROYED']], JSON.stringify(r));
});

test('K-470 BS17-038: using a Magic card gives it +2000 BP this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.calmion;
    G.step = 4; G.active = P.key;
    const bp0 = BS.bpOf(t);
    await BS.fireFx(P, 'MAGIC_USED', null, { subject: t });
    return BS.bpOf(t) - bp0;
  }, SPEC('magic-bp-and-magician-draw'));
  assert.equal(r, 2000, String(r));
});

test('K-471 BS16-040 LV2 (When Destroyed): draws for each Magician Spirit but never more than four', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.tin;
    G.step = 4; G.active = P.key;
    const lv = BS.lvNo(t);
    P.spirits = P.spirits.filter(s => s !== t); P.trash.push(t); t.lostLv = lv - 1;
    const h0 = P.hand.length;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    const two = P.hand.length - h0;               // Calmion + the one Magician on the field
    for (let i = 0; i < 5; i += 1) { const m = BS.mkInst('BS02-066'); m.cores = 1; P.spirits.push(m); }
    const h1 = P.hand.length;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [two, P.hand.length - h1];
  }, SPEC('magic-bp-and-magician-draw'));
  assert.deepEqual(r, [1, 4], JSON.stringify(r));      // initial field has one Magician; later six are capped at 4
});
