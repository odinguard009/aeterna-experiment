/* ---------------------------------------------------------------------
   CARD IMAGES  (user supplied files kept in IndexedDB, never uploaded)
   --------------------------------------------------------------------- */
const IMG = {};           // card id -> blob: URL
let IDB = null;
const normKey = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
function idbOpen() {
  return new Promise(res => {
    try { const r = indexedDB.open('bse-images', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = r.onblocked = () => res(null); }
    catch (e) { res(null); }
  });
}
function idbTx(mode, fn) {
  return new Promise(res => {
    if (!IDB) return res(false);
    try { const tx = IDB.transaction('img', mode); fn(tx.objectStore('img')); tx.oncomplete = () => res(true); tx.onerror = tx.onabort = () => res(false); }
    catch (e) { res(false); }
  });
}
function setImg(id, blob) { if (IMG[id]) URL.revokeObjectURL(IMG[id]); IMG[id] = URL.createObjectURL(blob); }
async function loadImages() {
  IDB = await idbOpen(); if (!IDB) return;
  await new Promise(res => {
    try {
      const tx = IDB.transaction('img', 'readonly'), rq = tx.objectStore('img').openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { if (c.key === MAT_KEY) matUse(c.value); else if (c.key === LOBBYBG_KEY) lobbyBgUse(c.value); else if (/^~sleeve:\d$/.test(c.key)) { SLEEVE_IMG[+c.key.slice(8)] = URL.createObjectURL(c.value); SLEEVE_BLOB[+c.key.slice(8)] = c.value; } else if (CARDS[c.key]) setImg(c.key, c.value); c.continue(); } };   // v0.68.0: the playmat shares the store
      tx.oncomplete = tx.onerror = tx.onabort = () => res();
    } catch (e) { res(); }
  });
  applyLook(); refreshViews();
}
async function shrinkImage(file) {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 440 / bmp.height);
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
    return blob || file;
  } catch (e) { return file; }
}
const stripExt = n => String(n).replace(/\.[^./\\]+$/, '');
function findCardByFile(fileName) {                 // 1) the card's own "image" field (any file name), 2) ID, 3) card name
  const k = normKey(stripExt(fileName)); if (!k) return null;
  for (const id in CARDS) if (normKey(id) === k) return id;      // a serial number in the file name is exact
  const hit = fileCandidates(fileName, true);
  if (hit.length) return hit.length === 1 ? hit[0] : null;     // several different cards share this picture name: ask for the serial number
  return findCardByKey(stripExt(fileName));
}
function fileCandidates(fileName, imageOnly) {           // cards a file name could mean: by the "image" field first, else by serial/name
  const k = normKey(stripExt(fileName)); if (!k) return [];
  const seen = new Set(), out = [];
  for (const id in CARDS) if (CARDS[id].image && normKey(stripExt(CARDS[id].image)) === k) { const sig = printSig(CARDS[id]); if (!seen.has(sig)) { seen.add(sig); out.push(id); } }
  return out.length || imageOnly ? out : cardsByKey(stripExt(fileName));
}
/* v0.185: a serial number is exact; a name may match several different cards (same name, different serial). Identical
   reprints collapse to the first; genuinely different cards stay in the list, so the importers can report them. */
function cardsByKey(key) {
  const k = normKey(key); if (!k) return [];
  for (const id in CARDS) if (normKey(id) === k) return [id];
  const seen = new Set(), out = [];
  for (const id in CARDS) {
    if (normKey(CARDS[id].name) !== k) continue;
    const sig = printSig(CARDS[id]); if (seen.has(sig)) continue;
    seen.add(sig); out.push(id);
  }
  return out;
}
const ambiguousMsg = (what, ids) => `${what} matches ${ids.length} different cards - use the serial number: ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ', ...' : ''}`;
function findCardByKey(key) { const l = cardsByKey(key); return l.length === 1 ? l[0] : null; }
async function importImages(files) {
  let ok = 0; const miss = [];
  for (const f of files) {
    const id = f.type.startsWith('image/') ? findCardByFile(f.name) : null;
    if (!id) { const c = f.type.startsWith('image/') ? fileCandidates(f.name) : []; miss.push(c.length > 1 ? `${f.name} (${ambiguousMsg('name', c)})` : f.name); continue; }
    const blob = await shrinkImage(f);
    setImg(id, blob); await idbTx('readwrite', st => st.put(blob, id)); ok++;
  }
  return { ok, miss };
}
async function clearImages() { Object.keys(IMG).forEach(id => { URL.revokeObjectURL(IMG[id]); delete IMG[id]; }); await idbTx('readwrite', st => { st.clear(); if (MAT.blob) st.put(MAT.blob, MAT_KEY); if (LOBBYBG.blob) st.put(LOBBYBG.blob, LOBBYBG_KEY); for (const i of Object.keys(SLEEVE_BLOB)) st.put(SLEEVE_BLOB[i], '~sleeve:' + i); }); }   // the playmat is not a card image: it stays
/* v0.112.0 (card images online): the card image URL for an id. The player's own image (IndexedDB
   blob) always wins; otherwise, when an online server is present, the official art mirrored at
   /assets/card-images/<card.id> (Aegis-style). v0.114.0: the key is the card id (not the Fandom
   File: name) because the official battlespirits.com image URL is derived directly from it.
   Empty when neither is available (offline, no image). */
function cardImgSrc(id) {
  const k = artOf(id);           // v0.132.0 U14g2: the picture picked for this card
  if (IMG[k]) return IMG[k];
  const c = CARDS[k];
  if (!c || !c.id) return '';
  const origin = (typeof onlineOrigin === 'function') ? onlineOrigin() : null;
  return origin ? `${origin}/assets/card-images/${encodeURIComponent(c.id)}` : '';
}
const imgCls = id => (cardImgSrc(id) ? ' has-img' : '');
const imgSty = id => { const s = cardImgSrc(id); return s ? `;background-image:url('${s}')` : ''; };
function refreshViews() {
  renderLobby();
  if ($('view-deckbuilder').classList.contains('active')) renderDeckBuilder();
  if ($('view-library').classList.contains('active')) renderLibrary();
  if (G && $('view-playmat').classList.contains('active')) render();
}

/* ---------- library page ---------- */
function libMsg(t, bad) { const m = $('lib-msg'); m.textContent = t; m.className = 'lib-msg' + (bad ? ' bad' : ''); }
function renderLibrary() {
  const ids = Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')), part = ids.filter(id => fxMarked(CARDS[id])).length;      // v0.79.0 (A1): two counts; v0.80.1: built-in Training cards are not counted
  $('lib-imgcount').textContent = `${Object.keys(IMG).length} image(s) loaded · ${ids.length.toLocaleString('en-US')} card(s) known: ${(ids.length - part).toLocaleString('en-US')} complete, ${part.toLocaleString('en-US')} marked "!" (effect not fully implemented)`;
  libBar();
  renderLore();                                            // v0.131.0 U14g: the Lore section
  renderLibraryGrid();                                     // v0.111.0 (card images): the browsable card grid below
}

/* ---------- library card grid (v0.111.0, card images) ----------
   A browsable, searchable grid of every card (the deck builder's `dbIndex`/`dbWindow` pattern, reusing its card
   index and grid CSS). It shows the player's card images where they were added and zooms a card on tap. */
const LIBV = { list: [], from: -1, to: -1, cols: 0, rowH: 0, raf: 0, timer: 0, key: '' };
const LIB_GAP = 16, LIB_BUF = 2;
const libSetOf = id => String(id).replace(/-.*$/, '');
const LIBF = { colors: new Set(), costs: new Set(), types: new Set(), groups: new Set(), bps: new Set(), cores: new Set(), fams: new Set(), icons: new Set(), rars: new Set(), collabs: new Set(), cmode: false, ffall: false, fq: '', family: '', complete: true, partly: false, dd: '', sort: 'set', sortDir: 'asc', size: 'm', tab: 'cards', min: false };   // mockup toolbar state (v0.137.0)
const LIB_SIZES = [['s', 'S', 8], ['m', 'M', 6], ['l', 'L', 4]];
function libActive() { return LIBF.colors.size + LIBF.costs.size + LIBF.types.size + LIBF.groups.size + LIBF.bps.size + LIBF.cores.size + LIBF.fams.size + LIBF.icons.size + LIBF.rars.size + LIBF.collabs.size + (LIBF.family ? 1 : 0) + ((($('lib-set') || {}).value) ? 1 : 0) + (($('lib-search') || {}).value ? 1 : 0); }
function libFilter() {
  const q = (($('lib-search') || {}).value || '').trim().toLowerCase(), fam = LIBF.family.trim().toLowerCase();
  const set = (($('lib-set') || {}).value) || '';
  const key = [CARDS_VER, q, set, fam, [...LIBF.colors], [...LIBF.costs], [...LIBF.types], [...LIBF.groups], [...LIBF.bps], [...LIBF.cores], [...LIBF.fams].join('~'), [...LIBF.icons].join(), [...LIBF.rars].join(), [...LIBF.collabs].join(), LIBF.cmode, LIBF.ffall, LIBF.complete, LIBF.partly, LIBF.sort, LIBF.sortDir].join('|');
  if (key === LIBV.key) return LIBV.list;
  LIBV.key = key;
  let l = dbIndex().filter(e => {
    if (q && !e.s.includes(q)) return false;
    if (fam && !e.f.includes(fam)) return false;
    if (set && libSetOf(e.id) !== set) return false;
    const c = CARDS[e.id];
    if (LIBF.complete && fxMarked(c)) return false;
    if (LIBF.partly && !fxMarked(c)) return false;   // v0.158.0: the "! Partly Implemented" chip is a filter (only the cards marked "!")
    return dbFilterOK(c, LIBF.colors, LIBF.costs, LIBF.types, LIBF.cmode) && dbPlusOK(c, LIBF) && [...LIBF.groups].every(g => dbGroupOK(c, g));
  });
  l = l.slice().sort(dbSortCmp(LIBF.sort, LIBF.sortDir));
  LIBV.list = l.map(e => e.id);
  const cnt = $('lib-count'); if (cnt) cnt.textContent = `${LIBV.list.length.toLocaleString('en-US')} card(s) shown`;
  return LIBV.list;
}
function libBar() {                                   // the mockup toolbar: colour pips, type chips, cost buttons, group chips, clear
  const on = (s, v) => s.has(v);
  $('lib-pips').innerHTML = filterPipsHTML(LIBF, 'lib-f');
  $('lib-types').innerHTML = filterTypesHTML(LIBF, 'lib-f');
  $('lib-costs').innerHTML = DB_COSTS.map(k => `<button class="cbtn${on(LIBF.costs, k) ? ' on' : ''}" data-a="lib-f" data-v="costs:${k}" aria-pressed="${on(LIBF.costs, k)}" aria-label="Cost ${k}">${k === '10' ? '10+' : k}</button>`).join('');
  $('lib-colbtn').innerHTML = ddButton(LIBF, 'colour', 'Colour', 'lib-dd') + ddButton(LIBF, 'type', 'Type', 'lib-dd') + ddButton(LIBF, 'cost', 'Cost', 'lib-dd');
  $('lib-groups').innerHTML = ddButton(LIBF, 'group', 'Group', 'lib-dd') + ddButton(LIBF, 'family', 'Family', 'lib-dd') + ddButton(LIBF, 'bp', 'BP', 'lib-dd') + ddButton(LIBF, 'cores', 'Cores', 'lib-dd') + ddButton(LIBF, 'icon', 'Block', 'lib-dd') + ddButton(LIBF, 'rarity', 'Rarity', 'lib-dd') + ddButton(LIBF, 'collab', 'Collab', 'lib-dd');
  $('lib-sortbtn').innerHTML = ddButton(LIBF, 'sort', 'Sort', 'lib-dd');
  $('lib-play').classList.toggle('on', LIBF.complete);
  libMenu();
  $('lib-size').innerHTML = LIB_SIZES.map(([v, l]) => `<button data-a="lib-size" data-v="${v}" aria-pressed="${LIBF.size === v}">${l}</button>`).join('');
  if (document.activeElement !== $('lib-family')) $('lib-family').value = LIBF.family;
  $('lib-complete').classList.toggle('on', LIBF.complete); $('lib-complete').setAttribute('aria-pressed', String(LIBF.complete));
  $('lib-partly').classList.toggle('on', LIBF.partly); $('lib-partly').setAttribute('aria-pressed', String(LIBF.partly));
  dqa('#lib-lore-pane [data-a="lib-lore-min"]').forEach(b => { const k = b.dataset.v === 'head' ? 'lore-head-min' : 'lore-nav-min', m = $('lib-lore-pane').classList.contains(k); b.setAttribute('aria-pressed', String(m)); b.textContent = (m ? '▼ Show ' : '▲ Hide ') + (b.dataset.v === 'head' ? 'details' : 'list'); });
  const n = libActive(); $('lib-clear').innerHTML = n ? `<button class="chip" data-a="lib-clear">Clear ${n} ✕</button>` : '';
  $('lib-grid').style.setProperty('--cols', String((LIB_SIZES.find(x => x[0] === LIBF.size) || LIB_SIZES[1])[2]));
  $('view-library').classList.toggle('lib-min', !!LIBF.min); { const mb = $('lib-min'); mb.setAttribute('aria-pressed', String(!!LIBF.min)); mb.textContent = LIBF.min ? '▼ Show filters' : '▲ Hide filters'; }
  const tab = LIBF.tab === 'lore';
  $('lib-cards-pane').hidden = tab; $('lib-lore-pane').hidden = !tab; $('lib-chips').hidden = tab;
  $('lib-eyebrow').textContent = tab ? 'Library · Lore' : 'Library'; $('lib-title').textContent = tab ? 'Card Lore' : 'All Cards';
  $('lib-sub').textContent = tab ? 'The flavor texts of the cards, read in series order.' : 'Search and filter the whole card data. Click a card for its page.';
  document.querySelectorAll('#lib-tabs button').forEach(b => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === LIBF.tab)));
}
function libMenu() {                                  // the mockup dropdown menu (Colour, Type and Cost on phone, Group everywhere)
  document.querySelectorAll('#lib-tbar .ddmenu').forEach(m => m.remove());
  const tb = $('lib-tbar'), btn = LIBF.dd && tb.querySelector(`[data-a="lib-dd"][data-v="${LIBF.dd}"]`); if (!btn) return;
  ddMenuEl(LIBF, tb, btn, 'lib-ddpick', 'lib-ddclear');
}
document.addEventListener('click', e => { if (LIBF.dd && !(/** @type {Element} */ (e.target)).closest('.ddmenu,[data-a="lib-dd"]')) { LIBF.dd = ''; libMenu(); } });
function libTool(a, v) {
  if (a === 'lib-dd') { LIBF.dd = LIBF.dd === v ? '' : v; libBar(); return; }
  if (a === 'lib-ddpick') { ddPick(LIBF, v, false); if (LIBF.dd === 'sort') $('lib-grid').scrollTop = 0; }
  else if (a === 'lib-ddclear') { ddPick(LIBF, v, true); LIBF.dd = ''; }
  else if (a === 'lib-f') { const [g, x] = v.split(':'), s = LIBF[g]; if (s) { if (s.has(x)) s.delete(x); else s.add(x); } }
  else if (a === 'lib-size') LIBF.size = v;
  else if (a === 'lib-min') LIBF.min = !LIBF.min;
  else if (a === 'lib-tab') LIBF.tab = v === 'lore' ? 'lore' : 'cards';
  else if (a === 'lib-complete') { LIBF.complete = !LIBF.complete; if (LIBF.complete) LIBF.partly = false; }
  else if (a === 'lib-partly') { LIBF.partly = !LIBF.partly; if (LIBF.partly) LIBF.complete = false; }
  else if (a === 'lib-lore-min') { const k = v === 'head' ? 'lore-head-min' : 'lore-nav-min'; $('lib-lore-pane').classList.toggle(k); }
  else if (a === 'lib-clear') { ddReset(LIBF); LIBF.family = ''; $('lib-set').value = ''; $('lib-search').value = ''; }
  else if (a === 'lib-lore-mv') { const ks = loreSeries().map(x => x[0]), i = ks.indexOf(LORE_SET) + Number(v); if (ks[i]) LORE_SET = ks[i]; }
  else if (a === 'lib-lore-by') { LORE_BY = v === 'saga' ? 'saga' : 'series'; LORE_SET = ''; }
  else if (a === 'lib-lore-set') LORE_SET = v;
  else if (a === 'lib-lore-fs') LORE_FS = Number(v);
  renderLibrary();
}
function libCardHTML(id) {
  const c = CARDS[id];
  return `<div class="tile" data-a="libcard" data-v="${id}" title="${esc(c.name)} (${id})${fxMarked(c) ? ' - ' + FX_MARK_LBL : ''}: tap to open" tabindex="0">${cardFaceHTML(c, false)}</div>`;
}
function libWindow(force) {
  const el = $('lib-grid'); if (!el) return;
  const list = LIBV.list, n = list.length;
  if (!n) { el.innerHTML = '<div class="empty-note">No cards match.</div>'; LIBV.from = LIBV.to = -1; return; }
  const cs = getComputedStyle(el), cols = Math.max(1, cs.gridTemplateColumns.split(' ').filter(Boolean).length);
  const rowH = LIBV.rowH || 106, rows = Math.ceil(n / cols), top = el.scrollTop, vis = Math.ceil((el.clientHeight || 600) / rowH);
  const r0 = Math.max(0, Math.min(rows - 1, Math.floor(top / rowH) - LIB_BUF)), r1 = Math.min(rows, r0 + vis + 2 * LIB_BUF + 1);
  const from = r0 * cols, to = Math.min(n, r1 * cols);
  if (!force && from === LIBV.from && to === LIBV.to && cols === LIBV.cols) return;
  LIBV.from = from; LIBV.to = to; LIBV.cols = cols;
  const pad = h => h > 0 ? `<div class="db-spacer" style="grid-column:1/-1;height:${h}px"></div>` : '';
  el.innerHTML = pad(r0 * rowH - LIB_GAP) + list.slice(from, to).map(libCardHTML).join('') + pad((rows - r1) * rowH - LIB_GAP);
  el.scrollTop = top;
  const first = elq(el, '.tile'), h = first ? first.offsetHeight + LIB_GAP : 0;
  if (h && h !== LIBV.rowH) { LIBV.rowH = h; libWindow(true); }
}
function renderLibraryGrid() {
  if (!dbIndex().length) return;
  const setSel = $('lib-set');
  if (setSel && !setSel.dataset.done) { setSel.dataset.done = '1'; setSel.innerHTML = '<option value="">All sets</option>' + dbSets().map(s => `<option value="${s}">${esc(s)}</option>`).join(''); }
  libFilter();
  libWindow(true);
}
function libScroll() { if (!LIBV.raf) LIBV.raf = requestAnimationFrame(() => { LIBV.raf = 0; if ($('view-library').classList.contains('active')) libWindow(false); }); }
function libSearchInput() { clearTimeout(LIBV.timer); LIBV.timer = setTimeout(() => { LIBV.timer = 0; libBar(); renderLibraryGrid(); }, 120); }
function deckToText(d, key) {          // key: the deck's marked Key Spirit (v0.103.0) becomes a "KEY <id>" line
  d = d || PLAYER_DECK;
  const lines = Object.keys(d).filter(id => d[id] > 0 && CARDS[id]).map(id => `${d[id]} ${id}   # ${CARDS[id].name}`);
  if (key && CARDS[key]) lines.push(`KEY ${key}   # ${CARDS[key].name}`);
  return lines.join('\n');
}
function textToDeck(text) {
  const deck = {}, bad = [];
  let key = null, keyLines = 0;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) return;
    const km = line.match(/^KEY\s+(.+)$/i);
    if (km) {                          // the Key Spirit marker line (v0.103.0); at most one
      if (keyLines) bad.push(`line ${i + 1}: only one KEY line is allowed`);
      else { const kc = cardsByKey(km[1]); if (kc.length > 1) bad.push(`line ${i + 1}: KEY "${km[1].trim()}" ${ambiguousMsg('', kc).trim()}`); else if (!kc.length) bad.push(`line ${i + 1}: KEY "${km[1].trim()}" not found`); else key = kc[0]; }
      keyLines++; return;
    }
    let m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/) || line.match(/^(.+?)\s+[xX](\d+)$/);
    let n, nm;
    if (m && /^\d+$/.test(m[1])) { n = Number(m[1]); nm = m[2]; } else if (m) { nm = m[1]; n = Number(m[2]); } else { nm = line; n = 1; }
    const cs = cardsByKey(nm);
    if (cs.length > 1) { bad.push(`line ${i + 1}: "${nm.trim()}" ${ambiguousMsg('', cs).trim()}`); return; }
    const id = cs[0];
    if (!id) { bad.push(`line ${i + 1}: "${nm.trim()}" not found`); return; }
    deck[id] = Math.min(3, (deck[id] || 0) + n);
  });
  return { deck, bad, key };
}
function downloadText(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function readFileText(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); }); }
document.addEventListener('change', async e => {
  const t = /** @type {HTMLInputElement} */ (e.target);
  if (t.id === 'in-cards' && t.files[0]) {
    try {
      const r = importCards(await readFileText(t.files[0]));
      if (r.fatal) libMsg(r.fatal, true);
      else libMsg(`Imported ${r.ok} card(s).${r.bad.length ? `\nSkipped ${r.bad.length}:\n` + r.bad.slice(0, 12).join('\n') + (r.bad.length > 12 ? '\n…' : '') : ''}`, r.ok === 0 && r.bad.length > 0);
    } catch (err) { libMsg('Could not read that file.', true); }
    t.value = ''; refreshViews();
  } else if (t.id === 'in-imgs' && t.files.length) {
    const r = await importImages(Array.from(t.files));
    libMsg(`Matched ${r.ok} image(s).${r.miss.length ? `\nNo card found for ${r.miss.length} file(s): ` + r.miss.slice(0, 10).join(', ') + (r.miss.length > 10 ? ', …' : '') : ''}`, r.ok === 0);
    t.value = ''; refreshViews();
  } else if (t.id === 'db-set') { DBF.set = t.value; renderDeckBuilder(); }
  else if (t.id === 'play-cpu') { SETTINGS.cpuDeck = t.value; saveSettings(); renderLobby(); }
  else if (t.id === 'db-slot') { switchSlot(Number(t.value)); DB_UNDO.length = 0; renderDeckBuilder(); }
  else if (t.id === 'db-name') { SLOTS[ACTIVE_SLOT].name = (t.value.trim() || 'Deck ' + (ACTIVE_SLOT + 1)).slice(0, 24); saveDeck(); renderDeckBuilder(); }
  else if (t.id === 'db-preset') { const id = t.value; t.value = ''; if (id) { if (deckTotal(PLAYER_DECK) > 0) { const ok = await modal({ uiOnly: true, title: 'Replace this deck?', html: `Load "${esc((PREBUILT.find(d => d.id === id) || {}).name || id)}" into slot ${ACTIVE_SLOT + 1}? The current cards in the slot are replaced.`, buttons: [{ label: 'Replace', cls: 'primary', value: true }, { label: 'Cancel', cls: 'cancel', value: false }] }); if (!ok) return; } dbSnap(); loadPrebuilt(id); renderDeckBuilder(); } }
  else if (t.id === 'db-sl-up' && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; await dbSleeveSet(f); }
  else if (t.id === 'lobby-bg-up' && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; await lobbyBgSet(f); }
  else if (t.id === 'set-mat' && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; await matSet(f); }
  else if (t.id === 'set-speed') { SETTINGS.speed = SPEEDS[t.value] ? t.value : 'normal'; saveSettings(); }
  else if (t.id === 'set-cpu') setCpuProfile(t.value);
  else if (t.id === 'set-color') { setTheme('color', t.value); navTools(); if (G) render(); }
  else if (t.id === 'set-mode') { setTheme('mode', t.value); navTools(); if (G) render(); }
  else if (t.id === 'set-effpop') { if (t.value === 'off') SETTINGS.effPop = 'off'; else delete SETTINGS.effPop; saveSettings(); }
  else if (t.id === 'set-anim') { if (['full', 'reduced', 'off'].includes(t.value)) SETTINGS.anim = t.value; else delete SETTINGS.anim; saveSettings(); }
  else if (t.id === 'set-ts') { if (TEXT_SIZES.includes(t.value) && t.value !== 'normal') SETTINGS.textSize = t.value; else delete SETTINGS.textSize; saveSettings(); applyTextSize(); }
  else if (t.id === 'set-cb' || t.id === 'set-hc') { const k = t.id === 'set-cb' ? 'cbShapes' : 'hiContrast'; if (t.value === 'on') SETTINGS[k] = true; else delete SETTINGS[k]; saveSettings(); applyAccess(); }
  else if (t.id === 'set-lp') { if (t.value === 'off') SETTINGS.longpress = 'off'; else delete SETTINGS.longpress; saveSettings(); }
  else if (t.id === 'set-sound') { SETTINGS.sound = t.value === 'on'; saveSettings(); navTools(); if (SETTINGS.sound) sfx('summon'); }
  else if (t.id === 'lib-set') { $('lib-grid').scrollTop = 0; renderLibrary(); }   // v0.111.0 (card images): the Library browse grid filters
});
document.addEventListener('input', e => { if (evT(e).id === 'db-search') dbSearchInput(); else if (evT(e).id === 'lib-search') libSearchInput(); else if (evT(e).id === 'lib-family') { LIBF.family = /** @type {HTMLInputElement} */ (evT(e)).value; libSearchInput(); } });
document.addEventListener('scroll', e => { const t = /** @type {HTMLElement} */ (e.target); if (t && t.id === 'db-card-list') dbScroll(); else if (t && t.id === 'lib-grid') libScroll(); }, true);
window.addEventListener('resize', () => { if ($('view-deckbuilder').classList.contains('active')) { DBV.rowH = 0; dbWindow(true); } });
function libAction(a) {
  if (a === 'lib-template') {
    downloadText('bs-cards-template.json', JSON.stringify([
      { id: 'EXAMPLE-001', name: 'Example Spirit', type: 'Spirit', color: 'red', cost: 3, reduction: { red: 1 }, symbols: 1, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 6000 }], text: '', families: ['Example'], image: 'any file name.png', block: '76' },
      { id: 'EXAMPLE-M01', name: 'Example Magic', type: 'Magic', color: 'red', cost: 3, reduction: { red: 1 }, text: '[Main][Flash] Destroy 1 opposing Spirit with 6000 BP or less.', magic: { timing: ['MAIN', 'FLASH'], effect: 'DESTROY_BP_LE', value: 6000 } },
      { id: 'EXAMPLE-N01', name: 'Example Nexus', type: 'Nexus', color: 'red', cost: 2, reduction: { red: 1 }, levels: [{ cores: 0 }, { cores: 2 }], text: '' }], null, 2));
    libMsg('Template downloaded. Edit it, then use "Import card data".');
  } else if (a === 'lib-cards-clear') { clearImported(); libMsg('Imported cards removed.'); refreshViews(); }
  else if (a === 'lib-imgs-clear') clearImages().then(() => { libMsg('All images removed.'); refreshViews(); });
  else if (a === 'lib-deck-export') { $('lib-deck').value = deckToText(); libMsg(`Exported ${deckTotal(PLAYER_DECK)} card(s).`); }
  else if (a === 'lib-deck-import') {
    const r = textToDeck($('lib-deck').value);
    if (!deckTotal(r.deck)) { libMsg('No cards recognised.' + (r.bad.length ? '\n' + r.bad.slice(0, 8).join('\n') : ''), true); return; }
    PLAYER_DECK = r.deck; saveDeck();
    const v = validateDeck(PLAYER_DECK);
    libMsg(`Deck set: ${v.total} card(s). ${v.ok ? 'Legal.' : v.errors.join(' ')}${r.bad.length ? '\nNot found:\n' + r.bad.slice(0, 8).join('\n') : ''}`, !v.ok || r.bad.length > 0);
    renderLobby();
  }
}

