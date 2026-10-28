// v0.150.0: ctrl condition gains keyword ("a Spirit with Evolution"), other ("another X family Spirit": not the source) and nLe ("N or less Spirits").
// rules: ETR:effects.conditions@none
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const FIX = [
  { id: 'K-EVO', name: 'Evo Tester', type: 'Spirit', color: 'red', cost: 3, symbols: 1, text: 'Evolution (move cores)', families: ['Astral Dragon'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'K-BLK', name: 'Block Tester', type: 'Spirit', color: 'red', cost: 3, symbols: 1, text: '[LV1] (When Blocks)\nExhaust it.', families: ['Astral Dragon'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'K-PLAIN', name: 'Plain Tester', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }] },
];
before(async () => { g = await openGame(''); const r = await g.page.evaluate(f => BS.importCards(JSON.stringify(f)), FIX); assert.equal(r.ok, FIX.length, JSON.stringify(r)); });
after(async () => { await g.page.close(); await closeBrowser(); });
const ev = body => g.page.evaluate(`(async () => { BS.testSetup(); const P = BS.G.p.player, O = BS.G.p.opponent; P.spirits = []; O.spirits = [];
  const sp = id => { const i = BS.mkInst(id); i.cores = 1; P.spirits.push(i); return i; }; ${body} })()`);

test('CK01 ctrl.keyword matches the keywords list; a Spirit without it does not', async () => {
  const r = await ev(`const c = { ctrl: { n: 1, type: 'Spirit', keyword: 'Evolution' } }; const a = BS.fxIf(P, O, c); sp('K-PLAIN'); const b = BS.fxIf(P, O, c); sp('K-EVO'); return [a, b, BS.fxIf(P, O, c)];`);
  assert.deepEqual(r, [false, false, true]);
});
test('CK02 ctrl.other ignores the source Spirit itself', async () => {
  const r = await ev(`const s = sp('K-EVO'), c = { ctrl: { n: 1, type: 'Spirit', family: 'Astral Dragon', other: true } }; const a = BS.fxIf(P, O, c, { selfUid: s.uid }); sp('K-EVO'); return [a, BS.fxIf(P, O, c, { selfUid: s.uid })];`);
  assert.deepEqual(r, [false, true]);
});
test('CK03 ctrl.nLe is a maximum; parse accepts the new keys and rejects bad ones', async () => {
  const r = await ev(`const c = { ctrl: { type: 'Spirit', nLe: 1 } }; const a = BS.fxIf(P, O, c); sp('K-PLAIN'); const b = BS.fxIf(P, O, c); sp('K-PLAIN');
    return [a, b, BS.fxIf(P, O, c), BS.parseActionList([{ do: 'DRAW', n: 1, if: { ctrl: { n: 1, type: 'Spirit', keyword: 'Evolution', other: true } } }]).error || 'ok', !!BS.parseActionList([{ do: 'DRAW', n: 1, if: { ctrl: { type: 'Spirit', keyword: 5 } } }]).error];`);
  assert.deepEqual(r, [true, true, false, 'ok', true]);
});
test('CK04 ctrl.keyword matches a printed effect head "(When Blocks)" (v0.182 Mortariser); a Spirit without that head does not', async () => {
  const r = await ev(`const c = { ctrl: { n: 1, type: 'Spirit', keyword: 'When Blocks' } }; sp('K-PLAIN'); const a = BS.fxIf(P, O, c); sp('K-BLK'); return [a, BS.fxIf(P, O, c)];`);
  assert.deepEqual(r, [false, true]);
});
