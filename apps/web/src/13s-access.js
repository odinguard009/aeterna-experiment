/* ---------------------------------------------------------------------
   v0.138.0 ACCESSIBILITY (mockup "New features"): Text size (Normal / Large / Larger, menu screens) and the keyboard shortcuts list
   (press ? anywhere, or Settings > Accessibility). Display only; the battle keys themselves live in 13-render.js.
   --------------------------------------------------------------------- */
const TEXT_SIZES = ['normal', 'large', 'larger'];
function applyTextSize() { if (typeof document !== 'undefined') document.documentElement.dataset.ts = TEXT_SIZES.includes(SETTINGS.textSize) ? SETTINGS.textSize : 'normal'; }
applyTextSize();
const SHORTCUTS = [['?', 'Open this list'], ['Space / Enter', 'Battle: next step (the Next button)'], ['L', 'Battle: open or close the log'], ['Esc', 'Close a dialog, the log or a menu'], ['Tab / Shift+Tab', 'Move between buttons and cards'], ['Enter / Space', 'Press the focused button or card']];
function shortcutsDialog() {
  if ($('action-modal').classList.contains('active')) return;
  uiInfo('Keyboard shortcuts', `<div class="kbd-list">${SHORTCUTS.map(([k, d]) => `<div class="kbd-row"><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}</div>`);
}
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  const t = evT(e), tag = t.tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '?') { e.preventDefault(); shortcutsDialog(); }
});
