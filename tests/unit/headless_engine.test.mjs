// v0.82.0 (phase F2 = monorepo step M2): host port + headless engine.
// The engine reaches its host only through io (packages/protocol/src/00p-protocol.js); a CPU-vs-CPU match runs in
// Node without a DOM (packages/engine/headless.mjs) and gives the same result as the browser sim.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { srcParts } from '../../tools/src_parts.mjs';
import { playHeadless, loadEngine, WEB_GAPS } from '../../packages/engine/headless.mjs';
import { ROOT, simMatch, closeBrowser, openGame, WHITE } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
const parts = srcParts(ROOT).map(p => ({ ...p, src: readFileSync(join(ROOT, p.rel), 'utf8') }));
const engine = parts.filter(p => !p.rel.startsWith('apps/')), web = parts.filter(p => p.rel.startsWith('apps/'));

test('H82-01 protocol and engine parts touch no DOM and no browser global', () => {
  for (const p of engine) {
    const s = strip(p.src);
    for (const re of [/\bdocument\./, /\bwindow\./, /(?<![\w$])\$\(/, /\bAudioContext\b/, /\binnerHTML\b/, /\bclassList\b/]) assert.doesNotMatch(s, re, p.rel);
  }
});

test('H82-02 the engine calls no web function except the prompts left for M3 (shrink-only list)', () => {
  const names = new Set();
  for (const p of web) for (const m of p.src.matchAll(/^(?:async\s+)?(?:function\*?\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  names.delete('$');                                    // template literals hold "${"; a $() call is caught by H82-01
  const used = new Set();
  for (const p of engine) for (const m of strip(p.src).matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/g)) if (names.has(m[0])) used.add(m[0]);
  assert.deepEqual([...used].sort(), [...WEB_GAPS].sort(), 'update WEB_GAPS in packages/engine/headless.mjs only by removing names');
  assert.equal(WEB_GAPS.length, 0, 'v0.83.0 (M3 part 1): the engine calls no web function');
});

test('H82-03 headless CPU vs CPU: every prebuilt colour plays to the end with valid view records', async () => {
  const pairs = [['red', 'mitra'], ['blue', 'red'], ['green', 'purple'], ['yellow', 'green'], ['purple', 'blue'], ['mitra', 'yellow']];
  let seed = 820;
  for (const [a, b] of pairs) {
    const r = await playHeadless({ seed: seed++, deckA: a, deckB: b, timeoutMs: 30000 });
    assert.deepEqual(r.errors, [], `${a} vs ${b}`);
    assert.ok(r.over && (r.winner === 'player' || r.winner === 'opponent'), `${a} vs ${b} did not finish`);
    assert.equal(r.views.matchEnd, 1); assert.equal(r.views.reset, 1); assert.ok(r.views.board > 10);
    assert.equal(r.logs, r.log, 'every log line went through io.log');
  }
});

test('H82-04 headless and browser sims give the same match (offline game unchanged)', async () => {
  for (const [seed, mode, a, b] of [[1, 'white', 'red', WHITE], [3, 'greenmirror', 'green', 'green']]) {
    const w = await simMatch(seed, { mode }), h = await playHeadless({ seed, deckA: a, deckB: b });
    assert.ok(w.over && h.over, mode);
    assert.deepEqual([h.winner, h.turn, h.hash], [w.winner, w.turn, w.hash], mode);
  }
});

test('H82-05 the browser binds the web host; the port rejects unknown records; a fresh engine has the no-op host', async () => {
  const { page, errors } = await openGame('');
  const r = await page.evaluate(() => {
    let e = null; try { io.view({ type: 'nope' }); } catch (x) { e = x.message; }   // eslint-disable-line no-undef
    return { name: io.host.name, e, types: VIEW_TYPES.slice() };                 // eslint-disable-line no-undef
  });
  await page.close();
  assert.equal(r.name, 'web'); assert.match(r.e || '', /unknown view record/);
  assert.deepEqual(r.types, ['board', 'decks', 'screen', 'reset', 'matchEnd', 'acted', 'effect', 'core', 'draw', 'burst']);
  assert.deepEqual(errors, []);
  const E = loadEngine();
  assert.equal(E.io.host.name, 'none');
  await assert.rejects(E.io.decide('player', { kind: 'x' }), /no host answers/);
});
