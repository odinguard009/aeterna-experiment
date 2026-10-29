// K2 (v0.69.2) generated tests per compiled action (docs/ai/compiler-v2-plan.md point 5): every action of every shipped card with
// complete effects gets one quiet board built from its JSON (tests/unit/lib/fx-props.mjs), so a promoted card needs no hand-written
// test unless its effect is new. Shapes without a generator are listed, never guessed; FX01 keeps the coverage from falling.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';
import { PRE, casesFor, caseFor, fixtureCards, shapeOf } from './lib/fx-props.mjs';

const CARDS = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));
const ALL = casesFor(CARDS), RUNS = ALL.filter(c => c.body), SKIPS = ALL.filter(c => c.skip);
const MIN_SHARE = 0.73;          // share of shipped compiled actions with a generator (v0.69.2: see FX01); raise it, never lower it

let g;
before(async () => {
  g = await openGame('');
  const fix = fixtureCards(RUNS.concat(MUTANTS.map(m => m.c)));
  const r = await g.page.evaluate(f => BS.importCards(JSON.stringify(f)), fix);
  assert.equal(r.ok, fix.length, JSON.stringify(r));
  await g.page.evaluate(() => { BS.setFxStrict(true); return 1; });
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const runCase = c => g.page.evaluate(`(async () => { ${PRE}\n${c.body} })()`).catch(e => 'threw: ' + e.message.split('\n')[0]);

test('FX01 coverage: most shipped compiled actions have a generator; the uncovered shapes are listed', t => {
  const share = RUNS.length / ALL.length, by = {};
  for (const s of SKIPS) (by[s.skip] = by[s.skip] || []).push(s.id);
  t.diagnostic(`${RUNS.length} of ${ALL.length} actions generated (${Math.round(share * 100)}%); uncovered: ` +
    Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `${k} x${v.length}`).join('; '));
  assert.ok(share >= MIN_SHARE, `coverage ${share.toFixed(3)} < ${MIN_SHARE}`);
});

test('FX02 every generated action board holds its property', async () => {
  const bad = [];
  for (const c of RUNS) { const r = await runCase(c); if (r) bad.push(`${c.name}: ${r}`); }
  assert.deepEqual(bad, []);
});

// The generators must bite: a wrong bound or count in the action JSON fails its board.
const card = { id: 'BS74-CX03', type: 'Nexus', cost: 3, fxComplete: true };
const MUTANTS = [
  { why: 'DESTROY with a bound 1000 too high destroys the over-bound target', a: { do: 'DESTROY', bpLe: 4000 }, wrong: { do: 'DESTROY', bpLe: 5000 } },
  { why: 'EXHAUST_OPP n 2 exhausts two, not one', a: { do: 'EXHAUST_OPP', n: 1 }, wrong: { do: 'EXHAUST_OPP', n: 2 } },
  { why: 'BP_MINUS without zeroDestroy keeps a 0 BP Spirit', a: { do: 'BP_MINUS', n: 3000 }, wrong: { do: 'BP_MINUS', n: 3000, zeroDestroy: true } },
  { why: 'BOUNCE_OPP to the deck bottom is not a return to the Hand', a: { do: 'BOUNCE_OPP', kind: 'spirit', to: 'hand' }, wrong: { do: 'BOUNCE_OPP', kind: 'spirit', to: 'deckBottom' } },
].map(m => ({ ...m, c: caseFor(card, 0, 0, m.a) }));
test('FX03 mutation check: a board built for one action fails when the engine runs a different one', async () => {
  for (const m of MUTANTS) {
    assert.ok(m.c.body, shapeOf(m.a));
    assert.equal(await runCase(m.c), '', `${m.why}: the right action must pass`);
    const swapped = { ...m.c, body: m.c.body.replace('const RA = A;', `const RA = ${JSON.stringify(m.wrong)};`) };
    assert.notEqual(swapped.body, m.c.body);
    assert.notEqual(await runCase(swapped), '', m.why);
  }
});
