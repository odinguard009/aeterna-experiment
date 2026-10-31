// Lane K tests, file 37 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle 23 of v0.202.0: 26RCB01-032 (Darkwing).
// Engine piece: action GRANT_WIN_BOUNCE {costIs, bpLe} resolved in 08-battle after the BP comparison.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-407 data: Darkwing carries its printed clause', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const c = BS.CARDS['26RCB01-032'];
    return [c.implemented === true, c.effects.map(e => e.trigger).join(','), c.effects[0].actions.map(a => a.do).join(',')];
  });
  assert.deepEqual(r, [true, 'ALLY_BLOCKS', 'BP_TARGET,GRANT_WIN_BOUNCE'], JSON.stringify(r));
});

test('K-408 26RCB01-032 (Opposing Attack Step): a Kamen Rider Knight blocking gives +2000 BP to the blocker and arms the Cost 8 bounce', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, t = window.SC.darkwing, knight = window.SC.knight, surv = window.SC.survive;
    G.step = 5; G.active = G.p.opponent.key; G.battleNo = 12; G.blocker = surv; G.attacker = window.SC.oppA;      // battle BP needs both fighters
    const bp0 = BS.bpOf(surv);
    await BS.fireFx(P, 'ALLY_BLOCKS', knight, { subject: knight, attacker: window.SC.oppA, blocker: surv });
    return [BS.bpOf(surv) - bp0, !!surv.winBounce, surv.winBounce && surv.winBounce.battleNo === 12, surv.winBounce && surv.winBounce.bpLe];
  }, SPEC('darkwing'));
  assert.equal(r[0], 2000, JSON.stringify(r));
  assert.equal(r[1], true, JSON.stringify(r));
  assert.equal(r[2], true, JSON.stringify(r));
  assert.equal(r[3], 5000, JSON.stringify(r));
});
