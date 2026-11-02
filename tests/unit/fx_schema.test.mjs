// F1 (v0.81.0): effect JSON schema (packages/engine/fx-schema.json, tools/fx_schema.mjs) + validator (tools/fx_validate.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, schemaText, SCHEMA_PATH, SCHEMA_VERSION } from '../../tools/fx_schema.mjs';
import { cardErrors, validate } from '../../tools/fx_validate.mjs';
import { openGame, closeBrowser, ROOT } from './lib/node_board.mjs';

after(closeBrowser);
const S = buildSchema();

test('FS01 the committed schema is the one generated from packages/engine/src', () => {
  assert.equal(readFileSync(SCHEMA_PATH, 'utf8'), schemaText(S), 'run node tools/fx_schema.mjs');
  assert.equal(S.schemaVersion, SCHEMA_VERSION);
});

test('FS02 the schema matches the live engine (actions, Burst timings, triggers, STATIC flags)', async () => {
  const { page } = await openGame('');
  const live = await page.evaluate(() => ({
    actions: Object.keys(BS.FX_ACTIONS).sort(),
    burst: Object.keys(BS.BURST_WHEN),
    trig: BS.parseEffects([{ trigger: '?' }]).error,
    flag: BS.parseEffects([{ trigger: 'STATIC', flag: '?' }]).error,
  }));
  await page.close();
  assert.deepEqual(Object.keys(S.actions), live.actions);
  assert.deepEqual(S.burstWhen, live.burst);
  assert.equal(live.trig, `effect trigger must be one of ${S.triggers.join(', ')}`);
  assert.equal(live.flag, `STATIC "flag" must be one of ${S.staticFlags.join(', ')}`);
  for (const [k, v] of Object.entries(S.actions)) assert.ok(Array.isArray(v.fields), k);
});

test('FS03 every shipped card passes the schema and the engine parser (zero errors)', async () => {
  const r = await validate({ engine: true });
  assert.equal(r.schemaStale, false);
  assert.deepEqual(r.shipped, {});
});

test('FS04 the validator catches each kind of format error (mutation check)', () => {
  const base = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8')).find((c) => c.id === 'BS01-108');
  assert.ok(base && base.effects, 'fixture card BS01-108');
  assert.deepEqual(cardErrors(base, S), []);
  const cases = [
    [(c) => { c.effects[0].actions[0].too = 1; }, /REFRESH: unknown field "too"/],
    [(c) => { c.effects[0].trigger = 'SUMMON'; }, /unknown trigger "SUMMON"/],
    [(c) => { c.effects[0].optinal = true; }, /effects\[0\]: unknown field "optinal"/],
    [(c) => { c.effects[0].if.lifLe = 2; }, /effects\[0\]\.if: unknown field "lifLe"/],
    [(c) => { c.effects[0].actions[0] = { do: 'DRAWW', n: 1 }; }, /unknown action "DRAWW"/],
    [(c) => { c.effects[0].actions[0] = { do: 'BY', cost: { do: 'DISCARD_HAND', n: 1, bogus: 1 }, then: [{ do: 'DRAW', n: 1 }] }; }, /DISCARD_HAND: unknown field "bogus"/],
    [(c) => { c.effects[0].match = { famly: ['X'] }; }, /match: unknown field "famly"/],
    [(c) => { c.summonif = {}; }, /card: unknown field "summonif"/],
    [(c) => { c.fxComplete = true; c.residual = ['x']; }, /fxComplete: true with a residual/],
    [(c) => { c.residual = ['x'.repeat(401)]; }, /residual\[0\]: 401 characters/],
    [(c) => { c.burst = { when: 'LIFE_DOWN', actions: [{ do: 'DRAW', n: 1 }] }; }, /burst: unknown timing "LIFE_DOWN"/],
    [(c) => { c.effects[0] = { trigger: 'STATIC', flag: 'NO_RETURNS' }; }, /unknown STATIC flag "NO_RETURNS"/],
  ];
  for (const [mut, re] of cases) {
    const c = structuredClone(base); mut(c);
    const e = cardErrors(c, S);
    assert.ok(e.some((x) => re.test(x)), `${re}: got ${JSON.stringify(e)}`);
  }
});
