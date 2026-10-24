/* ---------------------------------------------------------------------
   SETTINGS, HOW TO PLAY, LIBRARY PAGES (v0.68.0, UI/UX overhaul U4; docs/DESIGN.md section 0, mockup docs/design/mockup-v11.html "Settings")
   Settings = header card + section menu (PC: left column; phone: chip row) + rows (label, help line, control on the right).
   Appearance: Dark/Light, player colour grid (same THEME as the header picker), playmat upload, CPU colour.
   Playmat: one picture kept in the card-image store (IndexedDB 'bse-images', key MAT_KEY), shown behind the battle board
   with background-size: cover centred (edges trimmed, centre kept), a veil and semi-transparent field rows (:root.has-mat).
   Display only: nothing here touches the rules.
   --------------------------------------------------------------------- */
const MAT_KEY = '~playmat';
const MAT = { blob: null, url: '' };
function matUse(blob) {
  if (MAT.url) URL.revokeObjectURL(MAT.url);
  MAT.blob = blob || null; MAT.url = blob ? URL.createObjectURL(blob) : '';
  if (typeof document === 'undefined') return;
  const r = document.documentElement;
  r.classList.toggle('has-mat', !!MAT.url);
  if (MAT.url) r.style.setProperty('--ae-mat', `url("${MAT.url}")`); else r.style.removeProperty('--ae-mat');
}
// keep a big playmat light: longest side at most 1600 px, JPEG (the board is at most a full screen)
async function shrinkMat(file, max) {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, (max || 1600) / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return (await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85))) || file;
  } catch (e) { return file; }
}
async function matSet(file) {
  if (!file || !/^image\//.test(file.type)) { setMsg('That file is not an image.', true); return; }
  const blob = await shrinkMat(file);
  matUse(blob); const ok = await idbTx('readwrite', st => st.put(blob, MAT_KEY));
  setMsg(ok ? 'Playmat set. It shows behind the battle board.' : 'Playmat set for this visit (the browser blocks saving).');
  renderSettings();
}
async function matClear() {
  matUse(null); await idbTx('readwrite', st => st.delete(MAT_KEY));
  setMsg('Playmat removed.'); renderSettings();
}
function setMsg(t, bad) { const m = $('set-msg'); if (!m) return; m.textContent = t; m.className = 'lib-msg' + (bad ? ' bad' : ''); }
// section menu: jump to the section and mark it (all sections stay on the page, so every control is reachable by scrolling)
function setSection(id) {
  const s = $('set-s-' + id); if (!s) return;
  dqa('#set-menu [data-a="set-sec"]').forEach(b => { if (b.dataset.v === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  if (s.scrollIntoView) s.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
// Appearance rows + the rest of the page state (called from renderSettings in 13-render.js)
function renderSetPage() {
  const g = $('set-color');
  if (g) g.innerHTML = THEME_COLS.map(c => `<button class="pcol" data-a="theme-color" data-v="${c.id}" aria-pressed="${c.id === THEME.color}" style="--c:${THEME.mode === 'light' ? c.l : c.d}"><i></i>${esc(c.name.replace(/ \(.*\)$/, ''))}</button>`).join('');
  dqa('#set-mode [data-a="theme-mode"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === THEME.mode)));
  const cc = $('set-cpucol'); if (cc) cc.textContent = THEME.color === 'red' ? 'Blue' : 'Crimson';
  const ou = $('set-online-url'); if (ou) ou.value = SETTINGS.onlineUrl || '';
  const mc = $('set-mat-clear'); if (mc) mc.disabled = !MAT.url;
  const im = $('set-imgs'); if (im) { const n = Object.keys(IMG).length; im.textContent = `${n} image${n === 1 ? '' : 's'} loaded. Add or remove them in the Library; they stay on this device.`; }
}
