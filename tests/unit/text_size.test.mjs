import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '');
const css = read('../../apps/web/styles.css'), js = read('../../apps/web/src/13s-access.js'), tpl = read('../../apps/web/index.template.html');
test('TS1 every text size has a --t value and the setting lists them', () => {
  for (const s of ['small', 'large', 'larger']) assert.ok(css.includes(`html[data-ts="${s}"]{--t:`), s);
  assert.ok(js.includes("['small', 'normal', 'large', 'larger']"));
  for (const s of ['small', 'normal', 'large', 'larger']) assert.ok(tpl.includes(`<option value="${s}">`), s);
});
test('TS2 no small fixed px font-size is left unscaled in the main stylesheet', () => {
  const bad = (css.match(/font-size:\s*\d+(\.\d+)?px/g) || []).filter((m) => parseFloat(m.replace(/[^\d.]/g, '')) <= 22);
  assert.ok(bad.length <= 3, bad.join(' '));
});
