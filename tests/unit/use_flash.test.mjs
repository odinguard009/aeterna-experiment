// v0.184.0: USE_FLASH "use the Flash effect of a Magic card from your Hand, without paying the cost" (Lane K)
// rules: ETR:effects.conditions@none
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const FIX = [
  { id: 'U-MAG', name: 'Flash Draw', type: 'Magic', color: 'red', cost: 5, families: ['Topaz'], text: 'Flash\nDraw a card.', magic: { timing: ['FLASH'], effect: 'ACTIONS', actions: [{ do: 'DRAW', n: 1 }] } },
  { id: 'U-MAIN', name: 'Main Only', type: 'Magic', color: 'red', cost: 1, families: ['Topaz'], text: 'Main\nDraw a card.', magic: { timing: ['MAIN'], effect: 'ACTIONS', actions: [{ do: 'DRAW', n: 1 }] } },
  { id: 'U-SP', name: 'Source', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 3000 }] },
];
before(async () => { g = await openGame(''); const r = await g.page.evaluate(f => BS.importCards(JSON.stringify(f)), FIX); assert.equal(r.ok, FIX.length, JSON.stringify(r)); });
after(async () => { await g.page.close(); await closeBrowser(); });
const ev = body => g.page.evaluate(`(async () => { BS.testSetup(); const P = BS.G.p.player, O = BS.G.p.opponent; P.spirits = []; P.hand = []; P.trash = []; ${body} })()`);

test('UF01 parse accepts a match; a cpu casts the matching Flash Magic for free (hand to Trash, no cores spent)', async () => {
  const r = await ev(`const ok = BS.parseActionList([{ do: 'USE_FLASH', match: { family: ['Topaz'] } }]).error || 'ok'; P.cpu = true;
    const s = BS.mkInst('U-SP'); s.cores = 1; P.spirits.push(s); P.hand.push(BS.mkInst('U-MAIN'), BS.mkInst('U-MAG')); for (let i = 0; i < 3; i++) P.deck.push(BS.mkInst('U-SP'));
    const res = P.reserve.n; await BS.runActions({ p: P, opp: O, src: s, ctx: {} }, { actions: [{ do: 'USE_FLASH', match: { family: ['Topaz'] } }] }, 'SUMMONED');
    return [ok, P.hand.length, P.trash.map(x => x.id), P.reserve.n === res];`);
  assert.deepEqual(r, ['ok', 2, ['U-MAG'], true]);
});
