// v0.106.0: the action table is spread over 02b and 02q-02t, and two things depend on load order
// that nothing used to check:
//   * 02k wraps every action's cands() once, at load time, with the immunity filter (a card in the
//     Trash that says it is unaffected, an opposing card unaffected by this effect);
//   * 02m/02p capture DESTROY, BOUNCE_OPP, REFRESH, SUMMON_HAND and VOID_TO_CARD while loading, so
//     those five must be defined before them.
// The split broke the first one silently: 15 seeded matches stayed identical and only a scenario in
// tests/unit/effect_priority.test.mjs noticed. These checks fail in the quick loop instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from '../../packages/engine/headless.mjs';

const E = loadEngine({ sim: true });
const table = E.FX_ACTIONS;
const names = Object.keys(table);

test('LO01 every action that lists targets has the immunity wrapper (02k reached it)', () => {
  const withCands = names.filter((n) => typeof table[n].cands === 'function');
  assert.ok(withCands.length > 20, `only ${withCands.length} actions list targets; the table looks empty`);
  const unwrapped = withCands.filter((n) => table[n].cands.immunityWrapped !== true);
  assert.deepEqual(unwrapped, [], `an action defined after 02k missed wrapImmunity(): ${unwrapped.join(', ')}`);
});

test('LO02 the table is complete: every family of the split is present', () => {
  for (const n of ['DRAW', 'DESTROY', 'BP_PLUS', 'RETURN_TRASH', 'REVEAL_PICK', 'SUMMON_HAND', 'SOUL_ENTER', 'VOID_TO_CARD', 'BOUNCE_OPP', 'DESTROY_TOTAL', 'BY']) {
    assert.ok(table[n], `${n} is missing from FX_ACTIONS (a part did not load)`);
  }
  assert.ok(names.length >= 40, `only ${names.length} actions; expected 40+`);
});

test('LO03 the five entries a later part captures at load time are defined (load-order contract)', () => {
  for (const n of ['DESTROY', 'BOUNCE_OPP', 'REFRESH', 'SUMMON_HAND', 'VOID_TO_CARD']) {
    assert.equal(typeof table[n].chk, 'function', `${n} must be defined before 02m/02p capture it`);
  }
});

test('LO04 the parser sees the same table the engine runs (no stale copy)', () => {
  // parseActionList rejects unknown names against Object.keys(FX_ACTIONS); a card using a split
  // action must therefore still parse
  const r = E.parseCard({ id: 'TST-LO04', name: 'Order Test', type: 'Magic', color: 'red', cost: 1, symbols: 1, text: '', magic: { effect: 'ACTIONS', actions: [{ do: 'RETURN_TRASH', match: { name: ['Order Test'] } }] } });
  assert.deepEqual(JSON.parse(JSON.stringify(r.errors || [])), []);
  assert.equal(r.card.magic.actions[0].do, 'RETURN_TRASH');
});
