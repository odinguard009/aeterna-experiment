// v0.205.2: draw card shape, Format/Status dropdowns, two-step Flash window, field-effects button, effects in the log
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });

test('UB01 the dropdowns for Format and Status exist in the deck builder and the library', async () => {
  const r = await g.page.evaluate(() => ['db-fmt', 'db-cstatus', 'lib-fmt', 'lib-status'].map(i => document.getElementById(i) && document.getElementById(i).tagName));
  assert.deepEqual(r, ['SELECT', 'SELECT', 'SELECT', 'SELECT']);
});
test('UB02 the Flash window asks first: Use Flash / Pass, then a vertical list with Cancel', async () => {
  const r = await g.page.evaluate(() => {
    MODAL = { resolve() {}, cfg: { flash: 'x', buttons: [{ label: 'Spark', value: 'a' }, { label: 'Pass', cls: 'cancel', value: null }] }, stage: 0 };
    const s0 = modalBtns().map(b => b.label);
    MODAL.stage = 1; const s1 = modalBtns().map(b => b.label);
    MODAL = { resolve() {}, cfg: { buttons: [] }, stage: 1 };
    return [s0, s1];
  });
  assert.deepEqual(r, [['⚡ Use Flash', 'Pass'], ['Spark', 'Cancel']]);
});
test('UB03 a resolved effect and a cast Magic write a line to the log', async () => {
  const r = await g.page.evaluate(async () => {
    BS.testSetup(); const P = BS.G.p.player, O = BS.G.p.opponent; P.spirits = [];
    const s = BS.mkInst('TRAIN-02'); s.cores = 1; P.spirits.push(s);
    const before = BS.G.history.length;
    await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'DRAW', n: 1 }] }, 'SUMMONED');
    return BS.G.history.slice(before).some(l => /^Effect · /.test(l));
  });
  assert.equal(r, true);
});
test('UB04 the field-effects list reads continuous effects and BP changes of both sides', async () => {
  const r = await g.page.evaluate(() => {
    BS.testSetup(); const P = BS.G.p.player; P.spirits = [];
    const s = BS.mkInst('TRAIN-02'); s.cores = 1; s.bpMod = 2000; P.spirits.push(s);
    return fieldFxRows().filter(x => x.tag === 'BP').map(x => x.key + ':' + x.t);
  });
  assert.deepEqual(r, ['player:+2000 BP until the end of the turn']);
});
test('UB05 the CPU holds a thin attack into an opponent with a payable Flash Magic', async () => {
  const r = await g.page.evaluate(() => {
    BS.testSetup(); const P = BS.G.p.opponent, O = BS.G.p.player;
    const m = Object.keys(CARDS).find(id => CARDS[id].type === 'Magic' && CARDS[id].magic && CARDS[id].magic.timing.includes('FLASH') && CARDS[id].cost <= 3);
    O.hand = [BS.mkInst(m)]; O.reserve.n = 8;
    return cpuFlashThreat(O) >= 1;
  });
  assert.equal(r, true);
});
