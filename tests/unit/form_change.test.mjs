// v0.135.0 Form Change ({{F Change|"X" & Cost N}} {{Invoke|Main}}) and "If summoned via Form Change": FORM_CHANGE action + viaFormChange
// condition (schema v8). The exhausted Spirit returns to the Hand and a Cost N card with another name is summoned free from the Hand;
// the summoned card's When Summoned effects see viaFC; every other summon path clears it. Scenario: tests/scenarios/form-change-summon.json.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const FC = { trigger: 'ACTIVATE', invoke: true, timing: ['MAIN'], once: true, sameName: true, lv: [1], actions: [{ do: 'FORM_CHANGE', match: { name: ['Zed'] }, costIn: [3] }] };
const FIX = [
  { id: 'TF-A', name: 'Zed Alpha', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [FC] },
  { id: 'TF-A2', name: 'Zed Alpha', type: 'Spirit', color: 'red', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [FC] },
  { id: 'TF-B', name: 'Zed Beta', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 4000 }],
    effects: [{ trigger: 'SUMMONED', lv: [1], actions: [{ do: 'DRAW', n: 1, if: { viaFormChange: false } }, { do: 'DRAW', n: 2, if: { viaFormChange: true } }] }] },
  { id: 'TF-SAME', name: 'Zed Alpha', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 4000 }] },
  { id: 'TF-C4', name: 'Zed Gamma', type: 'Spirit', color: 'red', cost: 4, symbols: 1, levels: [{ cores: 1, bp: 5000 }] },
  { id: 'TF-OTHER', name: 'Nobody', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'TF-FILL', name: 'Filler', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 500 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 4;
  P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.trash = []; q.standby = []; q.void = 0; q.hand = []; q.life = 5; }
  P.reserve.n = 6; P.deck = Array.from({ length: 10 }, () => BS.mkInst('TF-FILL'));
  const sp = (id, ex = true) => { const i = BS.mkInst(id); i.cores = 1; i.exhausted = ex; P.spirits.push(i); return i; };
  const hand = id => { const i = BS.mkInst(id); P.hand.push(i); return i; };
  const fcIdx = id => BS.CARDS[id].effects.findIndex(e => e.invoke);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('FC-01 an exhausted Spirit returns to the Hand and the Cost 3 card is summoned free, flagged viaFC', async () => {
  const r = await ev(`const a = sp('TF-A'); hand('TF-B'); const ok = await BS.activateFx(P, a, fcIdx('TF-A'));
    return { ok, field: P.spirits.map(x => x.id), hand: P.hand.map(x => x.id).filter(x => x !== 'TF-FILL'), flag: P.spirits[0] && P.spirits[0].viaFC, drew: P.deck.length };`);
  assert.deepEqual([r.ok, r.field, r.hand, r.flag], [true, ['TF-B'], ['TF-A'], true]);
  assert.equal(r.drew, 8, 'viaFormChange true branch: draws two, not one');
});
test('FC-02 not exhausted, no Cost 3 card, the same name, the wrong cost or the wrong name: the effect cannot be used', async () => {
  const r = await ev(`const out = [];
    const a = sp('TF-A', false); hand('TF-B'); out.push(BS.activatable(P, a, 'MAIN').length);
    a.exhausted = true; P.hand = []; out.push(BS.activatable(P, a, 'MAIN').length);
    hand('TF-SAME'); out.push(BS.activatable(P, a, 'MAIN').length);
    P.hand = []; hand('TF-C4'); out.push(BS.activatable(P, a, 'MAIN').length);
    P.hand = []; hand('TF-OTHER'); out.push(BS.activatable(P, a, 'MAIN').length);
    P.hand = []; hand('TF-B'); out.push(BS.activatable(P, a, 'MAIN').length);
    return out;`);
  assert.deepEqual(r, [0, 0, 0, 0, 0, 1]);
});
test('FC-03 the same card name can Form Change once per turn', async () => {
  const r = await ev(`const a = sp('TF-A'), b = sp('TF-A2'); hand('TF-B'); hand('TF-B');
    const first = await BS.activateFx(P, a, fcIdx('TF-A')); const second = BS.activatable(P, b, 'MAIN').length;
    G.turnNo += 1; const nextTurn = BS.activatable(P, b, 'MAIN').length;
    return { first, second, nextTurn };`);
  assert.deepEqual(r, { first: true, second: 0, nextTurn: 1 });
});
test('FC-04 a normal summon of the same card is not "via Form Change" (flag cleared) and draws one', async () => {
  const r = await ev(`const a = sp('TF-A'); const b = hand('TF-B'); await BS.activateFx(P, a, fcIdx('TF-A'));
    const viaFlag = P.spirits[0].viaFC; BS.bounceCard(P, P.spirits[0], 'hand');
    const flagAfterBounce = b.viaFC; const d0 = P.deck.length; const t = P.hand.find(x => x.id === 'TF-B');
    await BS.summonFree(P, t, {});      // an ordinary free summon of the same instance
    return { viaFlag, flagAfterBounce, drew: d0 - P.deck.length, flag: t.viaFC };`);
  assert.deepEqual(r, { viaFlag: true, flagAfterBounce: false, drew: 1, flag: false });
});
test('FC-05 real cards: Nox Wolf Shadow (26RCB01-019) becomes Nox Gun Shadow (26RCB01-021); a Cost 4 "Nox" or a second use is refused', async () => {
  const r = await ev(`const a = sp('26RCB01-019'); hand('26RCB01-021'); hand('26RCB01-018');       // Nox Knight (Cost 3) must not qualify
    const idx = BS.CARDS['26RCB01-019'].effects.findIndex(e => e.invoke); const ok = await BS.activateFx(P, a, idx);
    return { ok, field: P.spirits.map(x => x.id), hand: P.hand.map(x => x.id).sort(), again: BS.activatable(P, P.spirits[0], 'MAIN').length, reserve: P.reserve.n };`);
  assert.deepEqual([r.ok, r.field, r.hand, r.again], [true, ['26RCB01-021'], ['26RCB01-018', '26RCB01-019'], 0]);
});
