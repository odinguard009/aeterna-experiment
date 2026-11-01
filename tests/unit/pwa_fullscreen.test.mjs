// v0.205.4: installable app icon (PWA manifest) and the fullscreen buttons next to the colour picker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('PWA-1 manifest, icons and head links exist', () => {
  const m = JSON.parse(readFileSync('pwa/manifest.webmanifest', 'utf8'));
  assert.equal(m.display, 'standalone');
  for (const i of m.icons) assert.ok(existsSync('pwa/' + i.src), i.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const html = readFileSync('apps/web/index.template.html', 'utf8');
  assert.match(html, /rel="manifest" href="pwa\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="pwa\/apple-touch-icon\.png"/);
  assert.match(readFileSync('.github/workflows/deploy-pages.yml', 'utf8'), /cp -r functions pwa dist/);
});

test('FS-1 fullscreen buttons sit next to the colour buttons (PC and phone) and are wired', () => {
  const html = readFileSync('apps/web/index.template.html', 'utf8');
  assert.equal((html.match(/data-a="fullscreen"/g) || []).length, 2);
  assert.match(readFileSync('apps/web/src/16-events.js', 'utf8'), /a === 'fullscreen'\) toggleFullscreen\(\)/);
});

test('FX-1 Effects button sits in your Field corner, rows do not reuse the absolute .fxl class, dialogs sit above the card zoom', () => {
  const ev = readFileSync('apps/web/src/16-events.js', 'utf8'), z = readFileSync('apps/web/src/12-zones.js', 'utf8'), css = readFileSync('apps/web/styles.css', 'utf8');
  assert.match(ev, /function placeFeBtn/);
  assert.match(z, /class="fxrow /); assert.doesNotMatch(z, /class="fxl /);
  assert.match(css, /#action-modal\.modal-overlay \{ z-index: 210; \}/);
});
