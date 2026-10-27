/* ---------------------------------------------------------------------
   THEME (v0.63.0, UI/UX overhaul U1; docs/DESIGN.md section 0)
   Player side colour (teal default or one of the eight symbol colours) and Dark/Light mode.
   Saved per device; applied as CSS custom properties on <html>: --you, --you-ink, --you-soft, --cpu, data-mode.
   The CPU is crimson, and blue when the player picks red. Display only: nothing here touches the rules.
   --------------------------------------------------------------------- */
const THEME_KEY = 'aeterna.theme.v1';
const THEME_COLS = [
  { id: 'teal', name: 'Teal (default)', d: '#17b897', l: '#0f8f74', ink: '#04211b', lk: '#000000' },
  { id: 'red', name: 'Red', d: '#e5484d', l: '#c8303a', ink: '#ffffff' },
  { id: 'purple', name: 'Purple', d: '#a06cf0', l: '#7b45cf', ink: '#ffffff' },
  { id: 'green', name: 'Green', d: '#2fb36a', l: '#1f8f50', ink: '#06210f', lk: '#000000' },
  { id: 'white', name: 'White', d: '#eef1f5', l: '#ffffff', ink: '#141922' },
  { id: 'yellow', name: 'Yellow', d: '#ffe14a', l: '#f0cf00', ink: '#2a2400' },
  { id: 'blue', name: 'Blue', d: '#3a8cf0', l: '#1f6fd9', ink: '#ffffff' },
  { id: 'silver', name: 'Silver (Soul Core)', d: '#b8c2cf', l: '#8f9aa8', ink: '#141922' },
  { id: 'gold', name: 'Gold (Ultimate)', d: '#c9952a', l: '#a87a14', ink: '#241700' }
];
const THEME = (() => {
  const t = { color: 'teal', mode: 'dark' };
  try { const o = JSON.parse(localStorage.getItem(THEME_KEY)); if (o && typeof o === 'object') { if (THEME_COLS.some(c => c.id === o.color)) t.color = o.color; if (o.mode === 'light') t.mode = 'light'; } } catch (e) { /* storage blocked: defaults */ }
  return t;
})();
function applyTheme() {
  if (typeof document === 'undefined') return;
  const c = THEME_COLS.find(x => x.id === THEME.color) || THEME_COLS[0], light = THEME.mode === 'light', v = light ? c.l : c.d, r = document.documentElement;
  r.setAttribute('data-mode', THEME.mode);
  r.style.setProperty('--you', v);
  const lum = h => { const [R, G, B] = [1, 3, 5].map(i => { const x = parseInt(h.slice(i, i + 2), 16) / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * R + .7152 * G + .0722 * B; };
  const cr = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05), ink0 = light && c.lk ? c.lk : c.ink;
  r.style.setProperty('--you-ink', cr(ink0, v) >= 4.5 ? ink0 : '#000000');   // v0.147 audit: the colour's own ink when it reads at 4.5:1, else black (Red, Purple, Blue in dark mode); v0.99 U8a lk: light-mode ink on the darker light colour
  r.style.setProperty('--you-soft', c.id === 'white' && light ? '#0b1a3022' : v + '40');
  r.style.setProperty('--cpu', c.id === 'red' ? (light ? '#1f6fd9' : '#3a8cf0') : (light ? '#c42b40' : '#d8344b'));
  r.style.setProperty('--cpu-ink', '#ffffff');
  // U16b: the favicon and the early-paint colour of the loading screen follow the chosen colour
  const ic = /** @type {HTMLLinkElement|null} */ (document.querySelector('link[rel="icon"]'));
  if (ic) { if (!ic.dataset.h) ic.dataset.h = ic.getAttribute('href') || ''; const mix = k => '%23' + [1, 3, 5].map(i => Math.round(parseInt(v.substr(i, 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join(''); ic.setAttribute('href', ic.dataset.h.replace(/%2317b897/gi, '%23' + v.slice(1)).replace(/%239fe8d8/gi, mix(.4))); }
  try { localStorage.setItem('aeterna.accent', v); } catch (e) { /* blocked: the loader stays teal */ }
}
function setTheme(key, val) {
  if (key === 'color' && THEME_COLS.some(c => c.id === val)) THEME.color = val;
  else if (key === 'mode' && (val === 'dark' || val === 'light')) THEME.mode = val;
  else return;
  try { localStorage.setItem(THEME_KEY, JSON.stringify(THEME)); } catch (e) { /* blocked: this visit only */ }
  applyTheme();
}
applyTheme();
