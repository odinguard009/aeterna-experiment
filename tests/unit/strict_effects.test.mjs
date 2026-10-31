// v0.59.4 strict effects mode (Q1 quality bundle, Aegis idea): an unknown trigger, action, condition or STATIC flag name
// throws in automated runs (navigator.webdriver: these tests, sims, Playwright suites) and warns once + is skipped in the release build.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); await g.page.evaluate(() => { BS.testSetup(); return 1; }); });
after(closeBrowser);

const run = fn => g.page.evaluate(fn);

test('S594-01 strict is on in automated runs', async () => {
  assert.equal(await run(() => BS.FX_STRICT), true);
});
test('S594-02 strict: unknown condition, flag, trigger and action names throw', async () => {
  const r = await run(async () => {
    BS.setFxStrict(true);
    const P = BS.G.p.player, O = BS.G.p.opponent, out = {};
    const t = (k, f) => { try { f(); out[k] = 'no throw'; } catch (e) { out[k] = e.message; } };
    t('cond', () => BS.fxIf(P, O, { lifeLee: 3 }, {}));
    t('flag', () => BS.flagActive(P, 'MUST_BLOK', P.spirits[0] || { id: 'x' }));
    t('trigger', () => BS.collectFx({ owner: P, trigger: 'ATACKS', src: null, ctx: {} }));
    const c = { p: P, opp: O, src: null, ctx: {} };
    try { await BS.runActions(c, { actions: [{ do: 'DRAWW', n: 1 }] }, 'SUMMONED'); out.action = 'no throw'; } catch (e) { out.action = e.message; }
    return out;
  });
  assert.equal(r.cond, 'unknown effect condition "lifeLee"');
  assert.equal(r.flag, 'unknown effect flag "MUST_BLOK"');
  assert.equal(r.trigger, 'unknown effect trigger "ATACKS"');
  assert.equal(r.action, 'unknown effect action "DRAWW"');
});
test('S594-03 release: unknown names are skipped (condition not met, no effects) and warn once per name', async () => {
  const r = await run(async () => {
    BS.setFxStrict(false); BS.FX_WARNED.clear();
    const P = BS.G.p.player, O = BS.G.p.opponent, warns = [], w0 = console.warn;
    console.warn = m => warns.push(m);
    try {
      const a = BS.fxIf(P, O, { lifeLee: 3 }, {}), b = BS.fxIf(P, O, { lifeLee: 3 }, {});
      const fx = BS.collectFx({ owner: P, trigger: 'ATACKS', src: null, ctx: {} });
      const hand = P.hand.length, c = { p: P, opp: O, src: P.deck[0], ctx: {} };
      await BS.runActions(c, { actions: [{ do: 'DRAWW', n: 1 }, { do: 'DRAW', n: 1 }] }, 'SUMMONED');
      return { a, b, fx: fx.length, drew: P.hand.length - hand, warns };
    } finally { console.warn = w0; BS.setFxStrict(true); }
  });
  assert.equal(r.a, false); assert.equal(r.b, false); assert.equal(r.fx, 0);
  assert.equal(r.drew, 1, 'the known action after the unknown one still runs');
  assert.deepEqual(r.warns, ['[effects] unknown effect condition "lifeLee"', '[effects] unknown effect trigger "ATACKS"', '[effects] unknown effect action "DRAWW"']);
});
test('S594-04 every condition key the parser accepts is known to fxIf', async () => {
  const bad = await run(() => {
    const keys = ['handLe', 'byOpp', 'hasSymbol', 'lifeLe', 'anyLifeLe', 'counterGe', 'soulGe', 'oppHandGe', 'voidGe', 'soulLe', 'putGe', 'lifeGe', 'oppRemovedGe', 'removedGe', 'oppSpiritsLe', 'oppNexusGe', 'oppNoAB', 'oppRemovedSpirit', 'controlName', 'hasName', 'soulOn', 'nexusBraved', 'oppTurn', 'attackStep', 'prev', 'utHit', 'sealed'];
    const P = BS.G.p.player, O = BS.G.p.opponent, out = [];
    for (const k of keys) { try { BS.fxIf(P, O, { [k]: k === 'hasSymbol' ? 'red' : /Name|soulOn|nexusBraved/.test(k) ? 'x' : /Ge$|Le$/.test(k) ? 1 : true }, {}); } catch (e) { out.push(k + ': ' + e.message); } }
    return out;
  });
  assert.deepEqual(bad, []);
});
test('S594-05 every built-in card effect uses known names', async () => {
  const bad = await run(() => {
    const out = [], flags = ['NO_BP_COMPARE', 'SUMMON_TAX', 'MUST_BLOCK', 'NO_DECK_DISCARD', 'NO_ATTACK_LIFE', 'HAND_COST', 'DRAW_PLUS', 'TREAT_LV3', 'NO_RETURN', 'CORES_DRAW', 'UNAFFECTED_SOUL', 'COST_DESTROY_PLUS', 'EXTRA_REDUCTION', 'NO_END_ATTACK', 'UNAFFECTED', 'HAND_UNAFFECTED', 'BLOCK_EXHAUSTED', 'CANT_ATTACK', 'CANT_BLOCK', 'TRIBUTE_SAFE', 'IMMORTALITY', 'NO_BLOCK_INFERIOR', 'SUMMON_SYMBOL', 'CAMOU', 'CORE_SAFE', 'LIFE_CORE_TO_TRASH', 'EXTRA_SYMBOL', 'NO_BLOCK_SHAMAN', 'BP_VIA_SHAMAN', 'NO_ATTACK_ONE_CORE', 'RUMBLE_PLUS', 'UNBLOCKABLE_LOW', 'LOW_ATK_ONCE', 'BLOCKS_AS_ATTACKS', 'BLOCK_TAX', 'ZERO_BP_DECKBOTTOM', 'LIFE_HIT_PLUS'];
    const walk = (id, list) => { for (const a of list || []) { if (!BS.FX_ACTIONS[a.do]) out.push(id + ' action ' + a.do); if (a.then) walk(id, a.then); if (a.cost) walk(id, [a.cost]); } };
    for (const [id, c] of Object.entries(BS.CARDS)) for (const e of c.effects || []) {
      if (e.trigger === 'STATIC' && e.flag && !flags.includes(e.flag)) out.push(id + ' flag ' + e.flag);
      walk(id, e.actions);
    }
    return out.slice(0, 10);
  });
  assert.deepEqual(bad, []);
});
