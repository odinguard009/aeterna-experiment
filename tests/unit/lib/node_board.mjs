// Node-only twin of sharedBoard() (tests/unit/lib/game.mjs) for engine-effect tests that never touch the DOM: same `page.evaluate(code)`
// shape, but the code runs in the headless engine vm (packages/engine/headless.mjs) where `BS` is the engine hook. No Chromium, so a K
// test file runs in ~1 s instead of ~100-370 s. Use it when a test only reads BS.CARDS / BS.G / BS.FX_ACTIONS / BS.mkInst.
// Strings or functions (a function is sent as source, so it must not close over test variables; its one argument is JSON); await every effect inside the string (an un-awaited one is cut off by the next testSetup() with ABORT after the test ended, which node:test reports as a failure); results are JSON round-tripped like Playwright does, so deepEqual works across realms.
import { readFileSync } from 'node:fs';
import { loadEngine } from '../../../packages/engine/headless.mjs';

// BS.loadScenario lives in the web layer (apps/web/src/16-events.js) but only uses engine names plus render() and window.SC: its source is
// cut out of that file and run inside the engine context, so a scenario test sees the same code as the page (nothing is copied).
function scenarioSource() {
  const src = readFileSync(new URL('../../../apps/web/src/16-events.js', import.meta.url), 'utf8').replace(/\r/g, '');
  const a = src.indexOf('function loadScenario(spec) {');
  if (a < 0) throw new Error('loadScenario not found in 16-events.js');
  const b = src.indexOf('\n}\n', a);
  return src.slice(a, b + 3);
}

let shared = null;
export async function sharedBoard() {
  if (!shared) {
    const E = loadEngine({ sim: true, format: 'eternal', fixtures: false });
    E.__eval(`var window = globalThis; function render() {} function testSetup() { return BS.testSetup(); } ${scenarioSource()}; BS.loadScenario = loadScenario;`);
    E.bindHost({ name: 'node-board', view() {}, log() {}, async decide(seat, d) { return E.cpuAnswer(seat, JSON.parse(JSON.stringify(d))); } });   // no UI: views dropped, prompts answered by the CPU
    shared = { errors: [], page: { async evaluate(code, arg) { if (typeof code === 'function') code = `(${code})(${arg === undefined ? '' : JSON.stringify(arg)})`;      // Playwright's function form
      const r = await E.__eval(code); return r === undefined ? undefined : JSON.parse(JSON.stringify(r)); } } };
  }
  await shared.page.evaluate('BS.testSetup()');
  return shared;
}
export async function closeBrowser() { shared = null; }
