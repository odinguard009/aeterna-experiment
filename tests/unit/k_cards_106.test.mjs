import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1060 BS44-032 Pandaro-Cross: discarded from Hand by an opposing effect draws; Summoned exhausts; Attacks banishes a Trash card then bounces an exhausted Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 5; G.fxBy = O.key;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS44-032');
    const pc = BS.mkInst('BS44-032'); P.hand = [pc]; P.deck = [1,2,3,4,5].map(() => BS.mkInst(any));
    const src = BS.mkInst(any); O.spirits = [src];
    await BS.fireFx(O, 'SUMMONED', src, { subject: src });
    const eff = { trigger: 'START_MAIN', actions: [{ do: 'OPP_DISCARD', n: 1 }] };
    const c = { p: O, opp: P, src, ctx: {} }; await BS.FX_ACTIONS.OPP_DISCARD.run(c, { do: 'OPP_DISCARD', n: 1 });
    const drew = P.hand.length, inTrash = P.trash.includes(pc);
    G.active = P.key; const a = BS.mkInst('BS44-032'); a.cores = 3; const t = BS.mkInst(any); t.exhausted = true; P.spirits = [a]; O.spirits = [t]; O.trash = [BS.mkInst(any)]; G.attacker = a;
    await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { drew, inTrash, bounced: !O.spirits.includes(t), trash: O.trash.length, partial: BS.CARDS['BS44-032'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.inTrash, true, JSON.stringify(r)); assert.equal(r.drew, 3, JSON.stringify(r));
  assert.equal(r.bounced, true, JSON.stringify(r)); assert.equal(r.trash, 0, JSON.stringify(r));
});
