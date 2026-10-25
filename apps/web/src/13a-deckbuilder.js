/* ---------------------------------------------------------------------
   DECK BUILDER (v0.53.0 redesign; list performance from v0.52.1)
   PC (>= 900 px wide): filter rail | windowed card grid | deck panel. Phone: search bar + grid, filters in a bottom
   sheet, the deck in a bottom bar that opens a full-height sheet. Tap a card = +1 copy; the (i) button or a right-click
   opens the card detail (add / remove there too). Plan: docs/ai/deckbuilder-plan.md.
   --------------------------------------------------------------------- */
const DB_COLORS = ['red', 'purple', 'green', 'white', 'yellow', 'blue'];
const DB_TYPES = ['Spirit', 'Ultimate', 'Brave', 'Nexus', 'Magic', 'Contract'];
const DB_COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
/* v0.119.0: mechanic groupings the Type / Colour filters cannot express (owner: Mirage, Rebirth, all-colour/rainbow + the other modelled groups) */
const DB_GROUPS = [['multi', 'All colour'], ['mirage', 'Mirage'], ['rebirth', 'Rebirth'], ['legacy', 'Legacy'], ['ex', 'EX symbol']];
const DBF = { colors: new Set(), costs: new Set(), types: new Set(), groups: new Set(), set: '', family: '', legal: false, complete: false, sort: 'default' };
const DB_UNDO = [], DB_REDO = [];   // v0.128.0 U14f: Redo; any new change empties it
let DB_IO = '';
const dbArr = v => v == null || v === '' ? [] : Array.isArray(v) ? v : v instanceof Set ? [...v] : [String(v)];
const dbTypeOf = c => c.contract ? 'Contract' : c.type;
const dbSetOf = id => String(id).replace(/-.*$/, '');
/** Deck builder filter test. Each filter is a value, a list or a Set; empty = no filter; cost "10" = 10 or more. */
function dbFilterOK(c, color, cost, type) {
  const cl = dbArr(color), co = dbArr(cost), ty = dbArr(type);
  if (cl.length && !cardColors(c).some(x => cl.includes(x))) return false;
  if (co.length && !co.some(k => (k === '10' ? c.cost >= 10 : c.cost === Number(k)))) return false;
  if (ty.length && !ty.some(t => (t === 'Contract' ? !!c.contract : c.type === t && !c.contract))) return false;
  return true;
}
/* v0.119.0: mechanic-group test. multi = all-colour (rainbow) card; mirage / rebirth / legacy / ex read the modelled card fields. */
function dbGroupOK(c, g) {
  switch (g) {
    case 'multi': return isMulti(c);
    case 'mirage': return !!c.mirage;
    case 'rebirth': return !!(c.rebirthTo || c.rebirthSide);
    case 'legacy': return !!c.legacy;
    case 'ex': return !!c.exSymbols;
    default: return false;
  }
}
/* v0.52.1: a search index is built once per card-data change (CARDS_VER); the filtered list is recomputed only when a
   filter, the sort or the deck (for "In deck only") changes; the grid is windowed (spacer rows keep the scroll height). */
const DBV = { idx: null, ver: -1, key: '', list: [], from: -1, to: -1, cols: 0, rowH: 0, raf: 0, timer: 0, pulse: '' };
const DB_GAP = 8, DB_BUF = 2;
const DB_COLL = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
function dbIndex() {
  if (!DBV.idx || DBV.ver !== CARDS_VER) {
    DBV.idx = Object.keys(CARDS).filter(id => !CARDS[id].token).map((id, i) => { const c = CARDS[id]; return { id, i, s: (id + '\n' + c.name + '\n' + (c.desc || '')).toLowerCase(), f: (c.families || []).join(' / ').toLowerCase() }; });
    DBV.ver = CARDS_VER; DBV.key = '';
  }
  return DBV.idx;
}
function dbSets() { return [...new Set(dbIndex().map(e => dbSetOf(e.id)))].sort(DB_COLL.compare); }
function dbActiveCount() { return DBF.colors.size + DBF.costs.size + DBF.types.size + DBF.groups.size + (DBF.set ? 1 : 0) + (DBF.family ? 1 : 0) + (DBF.legal ? 1 : 0) + (DBF.complete ? 1 : 0) + ($('db-only').checked ? 1 : 0); }
const DB_SORTS = {
  cost: (a, b) => CARDS[a.id].cost - CARDS[b.id].cost || DB_COLL.compare(a.id, b.id),
  name: (a, b) => DB_COLL.compare(CARDS[a.id].name, CARDS[b.id].name) || DB_COLL.compare(a.id, b.id),
  colour: (a, b) => DB_COLORS.indexOf(cardColors(CARDS[a.id])[0]) - DB_COLORS.indexOf(cardColors(CARDS[b.id])[0]) || CARDS[a.id].cost - CARDS[b.id].cost || DB_COLL.compare(a.id, b.id),
  set: (a, b) => DB_COLL.compare(a.id, b.id),
};
function dbFilter() {
  const q = ($('db-search').value || '').trim().toLowerCase(), only = $('db-only').checked, fam = DBF.family.trim().toLowerCase();
  const idx = dbIndex(), key = [CARDS_VER, q, only ? Object.keys(PLAYER_DECK).filter(id => PLAYER_DECK[id]).sort().join(',') : '', [...DBF.colors].join(), [...DBF.costs].join(), [...DBF.types].join(), [...DBF.groups].join(), DBF.set, fam, DBF.legal, DBF.complete, DBF.sort, FORMAT].join('|');
  if (key === DBV.key) return DBV.list;
  DBV.key = key;
  let l = idx.filter(e => (!only || PLAYER_DECK[e.id]) && (!q || e.s.includes(q)) && (!fam || e.f.includes(fam)) && (!DBF.set || dbSetOf(e.id) === DBF.set) && dbFilterOK(CARDS[e.id], DBF.colors, DBF.costs, DBF.types) && ([...DBF.groups].every(g => dbGroupOK(CARDS[e.id], g))) && (!DBF.legal || !legalityOf(e.id, FORMAT)) && (!DBF.complete || !fxMarked(CARDS[e.id])));
  if (DB_SORTS[DBF.sort]) l = l.slice().sort(DB_SORTS[DBF.sort]);
  DBV.list = l.map(e => e.id);
  const tr = DBV.list.filter(id => id.startsWith('TRAIN-')).length;      // v0.99 U8a: Home counts real cards only; say which extra cards the builder shows
  $('db-count').textContent = `${DBV.list.length} card(s) shown` + (tr ? ` (${tr} Training)` : '');
  return DBV.list;
}
// v0.79.0 (A1, owner 2026-10-20): a card whose printed effect is not fully implemented carries a "!" mark in the deck builder
// grid and deck rows (and the Library counts); the missing clauses simply do not happen (no manual mode). Built-in training cards count as complete; older hand-wired cards with fxComplete false show the mark too.
const fxMarked = c => !!c && c.implemented === false;
const FX_MARK_LBL = 'Effect not fully implemented';
const fxMarkHTML = c => fxMarked(c) ? `<span class="fx-mark" role="img" aria-label="${FX_MARK_LBL}" title="${FX_MARK_LBL}">!</span>` : '';
function dbCardHTML(id) {
  const c = CARDS[id], n = PLAYER_DECK[id] || 0, bp = c.levels[0] && c.levels[0].bp != null ? c.levels[0].bp : c.brave ? '+' + c.brave.bp : '-';
  return `<div class="tcg-card ${n ? '' : 'dim'}${cardCls(c)}${imgCls(id)}${DBV.pulse === id ? ' db-pulse' : ''}" style="${colorSty(c)}${imgSty(id)}" data-a="dbcard" data-v="${id}" title="${esc(c.name)} (${id})${fxMarked(c) ? ' - ' + FX_MARK_LBL : ''}: tap to add">
      <div class="cost">${c.cost}</div><div class="type-badge">${c.contract ? 'CON' : c.type.substring(0, 3).toUpperCase()}${rebMark(c)}</div>
      <div class="name">${nameHTML(c.name)}</div><div class="bp">${bp}</div>${fxMarkHTML(c)}${symBadgeHTML(id)}${n ? `<div class="qty-badge">×${n}</div>` : ''}${legalityOf(id, FORMAT) ? '<div class="ban-badge" title="Not legal in this format">🚫</div>' : banStatus(id, FORMAT) === 'limit1' ? '<div class="ban-badge lim">1</div>' : ''}<button class="db-info" data-a="dbinfo" data-v="${id}" aria-label="Card detail" title="Card detail">i</button></div>`;
}
function dbWindow(force) {             // renders the rows around the visible part of the grid
  const el = $('db-card-list'), list = DBV.list, n = list.length;
  if (!n) { el.innerHTML = '<div class="empty-note">No cards match.</div>'; DBV.from = DBV.to = -1; return; }
  const cs = getComputedStyle(el), cols = Math.max(1, cs.gridTemplateColumns.split(' ').filter(Boolean).length);
  const rowH = DBV.rowH || 106, rows = Math.ceil(n / cols), top = el.scrollTop, vis = Math.ceil((el.clientHeight || 600) / rowH);
  const r0 = Math.max(0, Math.min(rows - 1, Math.floor(top / rowH) - DB_BUF)), r1 = Math.min(rows, r0 + vis + 2 * DB_BUF + 1);
  const from = r0 * cols, to = Math.min(n, r1 * cols);
  if (!force && from === DBV.from && to === DBV.to && cols === DBV.cols) return;
  DBV.from = from; DBV.to = to; DBV.cols = cols;
  const pad = h => h > 0 ? `<div class="db-spacer" style="grid-column:1/-1;height:${h}px"></div>` : '';
  el.innerHTML = pad(r0 * rowH - DB_GAP) + list.slice(from, to).map(dbCardHTML).join('') + pad((rows - r1) * rowH - DB_GAP);
  el.scrollTop = top;
  const first = elq(el, '.tcg-card'), h = first ? first.offsetHeight + DB_GAP : 0;
  if (h > DB_GAP && Math.abs(h - DBV.rowH) > 0.5) { DBV.rowH = h; dbWindow(true); }   // first measurement (or a layout change)
}
function dbScroll() { if (!DBV.raf) DBV.raf = requestAnimationFrame(() => { DBV.raf = 0; if ($('view-deckbuilder').classList.contains('active')) dbWindow(false); }); }
function dbSearchInput() { clearTimeout(DBV.timer); DBV.timer = setTimeout(() => { DBV.timer = 0; renderDeckBuilder(); }, 120); }

/* ---------- filter rail (PC column / phone bottom sheet) ---------- */
function dbChip(group, v, label, on, sty) { return `<button class="db-chip${on ? ' on' : ''}" data-a="db-chip" data-v="${group}:${v}" aria-pressed="${on}"${sty ? ` style="${sty}"` : ''}>${label}</button>`; }
function renderDbRail() {
  $('db-f-colors').innerHTML = DB_COLORS.map(c => dbChip('colors', c, cap(c), DBF.colors.has(c), `--chip:${colorVar(c)}`)).join('');
  $('db-f-costs').innerHTML = DB_COSTS.map(k => dbChip('costs', k, k === '10' ? '10+' : k, DBF.costs.has(k))).join('');
  $('db-f-types').innerHTML = DB_TYPES.map(t => dbChip('types', t, t, DBF.types.has(t))).join('');
  $('db-f-groups').innerHTML = DB_GROUPS.map(([g, l]) => dbChip('groups', g, l, DBF.groups.has(g))).join('');
  const st = $('db-set'), sets = dbSets(), sig = sets.join();
  if (st.dataset.sig !== sig) { st.innerHTML = '<option value="">All sets</option>' + sets.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join(''); st.dataset.sig = sig; }
  st.value = DBF.set; $('db-sort').value = DBF.sort; $('db-legal').checked = DBF.legal; $('db-complete').checked = DBF.complete;
  if (document.activeElement !== $('db-family')) $('db-family').value = DBF.family;
  const n = dbActiveCount(); $('db-filter-btn').innerHTML = n ? `FILTERS <em class="badge">${n}</em>` : 'FILTERS';
  renderDbChips();
}
/* v0.94.0 U7: the active filters as removable chips under the search, with Clear all (mockup v11 deck builder) */
function renderDbChips() {
  const c = [], chip = (g, v, l) => c.push(`<button class="db-achip" data-a="db-unchip" data-v="${g}:${esc(v)}" aria-label="Remove filter ${esc(l)}">${esc(l)} <b aria-hidden="true">×</b></button>`);
  DBF.colors.forEach(v => chip('colors', v, cap(v))); DBF.costs.forEach(v => chip('costs', v, 'Cost ' + (v === '10' ? '10+' : v))); DBF.types.forEach(v => chip('types', v, v));
  DBF.groups.forEach(v => chip('groups', v, (DB_GROUPS.find(g => g[0] === v) || [v, v])[1]));
  if (DBF.set) chip('set', DBF.set, 'Set ' + DBF.set); if (DBF.family) chip('family', DBF.family, 'Family: ' + DBF.family);
  if (DBF.legal) chip('legal', 1, 'Legal in format'); if (DBF.complete) chip('complete', 1, 'Complete effects'); if ($('db-only').checked) chip('only', 1, 'In deck only');
  $('db-achips').innerHTML = c.length ? c.join('') + '<button class="db-aclear" data-a="db-freset">Clear all</button>' : '';
}
function dbUnchip(v) {
  const i = v.indexOf(':'), g = v.slice(0, i), x = v.slice(i + 1);
  if (DBF[g] instanceof Set) DBF[g].delete(x); else if (g === 'set' || g === 'family') DBF[g] = ''; else if (g === 'only') $('db-only').checked = false; else DBF[g] = false;
  renderDeckBuilder();
}
/* v0.94.0 U7: deck panel tabs and the Deck look (sleeve tint, core and Soul Core colours; saved per deck slot, used on the board) */
let DB_TAB = 'list';
function dbTab(v) {
  DB_TAB = ['list', 'curve', 'look'].includes(v) ? v : 'list';
  const d = $('db-deck'); ['list', 'curve', 'look'].forEach(k => d.classList.toggle('tab-' + k, k === DB_TAB));
  dqa('[data-a="db-tab"]', d).forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === DB_TAB)));
  if (DB_TAB === 'look') renderDbLook();
}
function renderDbLook() {
  const L = deckLook(ACTIVE_SLOT), grid = (k, list, sw) => `<div class="db-lk"><div class="db-stat-h">${k === 'soul' ? 'Soul Core' : k === 'core' ? 'Core' : 'Sleeve'}</div><div class="db-lkg">${Object.keys(list).map(n =>
    `<button class="db-lkb" data-a="db-look" data-v="${k}:${n}" aria-pressed="${L[k] === n}" title="${cap(n)}">${sw(n)}<span>${cap(n)}</span></button>`).join('')}</div></div>`;
  $('db-look').innerHTML = `<div class="db-lkup"><label class="ae-ghost ae-upl"><span>UPLOAD SLEEVE</span><input id="db-sl-up" type="file" accept="image/*" aria-label="Upload a sleeve picture"></label>${SLEEVE_IMG[ACTIVE_SLOT] ? '<span class="db-mini"><span class="sleeve" aria-hidden="true"></span></span><button class="ae-ghost" data-a="db-sl-clear">REMOVE</button>' : ''}</div>` + grid('sleeve', SLEEVE_TINTS, n => `<span class="sleeve" style="--sl-tint:${SLEEVE_TINTS[n]}" aria-hidden="true"></span>`)
    + grid('core', CORE_LOOKS, n => `<i class="g-core" style="${coreVars('core', n)}" aria-hidden="true"></i>`)
    + grid('soul', CORE_LOOKS, n => `<i class="g-soul" style="${coreVars('soul', n)}" aria-hidden="true"></i>`);
}
const SLEEVE_BLOB = {};
async function dbSleeveSet(file) {                   // v0.95.0: longest side 600 px; same store as the card images and the playmat
  if (!file || !/^image\//.test(file.type)) return uiInfo('Not an image', 'Choose a picture file (PNG, JPEG, WebP) for the sleeve.');
  const i = ACTIVE_SLOT, blob = await shrinkMat(file, 600);
  if (SLEEVE_IMG[i]) URL.revokeObjectURL(SLEEVE_IMG[i]);
  SLEEVE_IMG[i] = URL.createObjectURL(blob); SLEEVE_BLOB[i] = blob; await idbTx('readwrite', st => st.put(blob, '~sleeve:' + i));
  applyLook(); renderDbLook();
}
async function dbSleeveClear() {
  const i = ACTIVE_SLOT; if (SLEEVE_IMG[i]) URL.revokeObjectURL(SLEEVE_IMG[i]); delete SLEEVE_IMG[i]; delete SLEEVE_BLOB[i];
  await idbTx('readwrite', st => st.delete('~sleeve:' + i)); applyLook(); renderDbLook();
}
function dbLook(v) {
  const [k, n] = v.split(':'); if (!['sleeve', 'core', 'soul'].includes(k) || !(k === 'sleeve' ? SLEEVE_TINTS : CORE_LOOKS)[n]) return;
  SLOTS[ACTIVE_SLOT].look = Object.assign(deckLook(ACTIVE_SLOT), { [k]: n }); saveDeck(); applyLook(); renderDbLook();
}
function dbToggle(group, v) { const s = DBF[group]; if (s.has(v)) s.delete(v); else s.add(v); renderDeckBuilder(); }
function dbResetFilters() {
  DBF.colors.clear(); DBF.costs.clear(); DBF.types.clear(); DBF.groups.clear(); DBF.set = ''; DBF.family = ''; DBF.legal = false; DBF.complete = false; DBF.sort = 'default';
  $('db-only').checked = false; $('db-search').value = ''; $('db-card-list').scrollTop = 0; renderDeckBuilder();
}
/* v0.119.0: an explicit Save (the deck already auto-saves, but the owner wanted a visible button). It also captures the
   name input before persisting, and flashes "SAVED ✓" unless silent (the back button calls it silently). */
let DB_SAVE_T = 0;
function dbSave(silent) {
  const nm = $('db-name');
  if (nm) { SLOTS[ACTIVE_SLOT].name = (nm.value.trim() || 'Deck ' + (ACTIVE_SLOT + 1)).slice(0, 24); nm.value = SLOTS[ACTIVE_SLOT].name; }
  saveDeck();
  if (silent) return;
  const b = $('db-save');
  if (b) { b.textContent = 'SAVED ✓'; b.classList.add('saved'); clearTimeout(DB_SAVE_T); DB_SAVE_T = setTimeout(() => { b.textContent = 'SAVE'; b.classList.remove('saved'); }, 1400); }
}

/* ---------- deck changes (with undo) ---------- */
function dbSnap() { DB_UNDO.push(JSON.stringify(PLAYER_DECK)); DB_REDO.length = 0; if (DB_UNDO.length > 30) DB_UNDO.shift(); }
function dbCanAdd(id) { const n = PLAYER_DECK[id] || 0; return !legalityOf(id, FORMAT) && n < maxCopies(id, FORMAT); }
function dbChange(id, d) {
  const n = PLAYER_DECK[id] || 0;
  if (d > 0 && !dbCanAdd(id)) return false;
  if (d < 0 && n <= 0) return false;
  dbSnap();
  if (n + d > 0) PLAYER_DECK[id] = n + d; else { delete PLAYER_DECK[id]; if (SLOTS[ACTIVE_SLOT].key === id) delete SLOTS[ACTIVE_SLOT].key; }   // the last copy leaves: the Key mark goes with it (v0.103.0)
  saveDeck(); DBV.pulse = d > 0 ? id : ''; renderDeckBuilder(); DBV.pulse = '';
  return true;
}
function dbReplace(deck) { dbSnap(); PLAYER_DECK = deck; saveDeck(); renderDeckBuilder(); }
async function dbClear() {                       // v0.99 U8a: Clear asks first (Undo still brings the deck back)
  const n = Object.values(PLAYER_DECK).reduce((t, x) => t + x, 0);
  if (n && !(await modal({ uiOnly: true, title: 'Clear the deck?', html: `All ${n} cards leave this deck. Undo brings them back.`, buttons: [{ label: 'Clear deck', cls: 'danger', value: 1 }, { label: 'Cancel', cls: 'cancel', value: 0 }] }))) return;
  dbSheet(''); SLOTS[ACTIVE_SLOT].key = null; dbReplace({});
}
function dbUndo() { if (!DB_UNDO.length) return; DB_REDO.push(JSON.stringify(PLAYER_DECK)); PLAYER_DECK = JSON.parse(DB_UNDO.pop()); saveDeck(); renderDeckBuilder(); }
function dbRedo() { if (!DB_REDO.length) return; DB_UNDO.push(JSON.stringify(PLAYER_DECK)); PLAYER_DECK = JSON.parse(DB_REDO.pop()); saveDeck(); renderDeckBuilder(); }
/* v0.128.0 U14f: Test hand = the starting Hand of 4 drawn from this deck (never the match RNG); Draw again reshuffles */
async function dbTestHand() {
  const all = []; for (const [id, n] of Object.entries(PLAYER_DECK)) for (let i = 0; i < n; i++) all.push(id);
  if (all.length < 4) { await uiInfo('Test hand', 'Add at least 4 cards to this deck first.'); return; }
  for (;;) {
    const a = all.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const v = await modal({ uiOnly: true, title: 'Test hand', html: `Starting Hand: 4 of ${all.length} cards` + cardStripHTML(a.slice(0, 4).map(id => ({ id, uid: 0 }))), buttons: [{ label: 'Draw again', cls: 'primary', value: 1 }, { label: 'Close', cls: 'cancel', value: null }] });
    if (!v) return;
  }
}
/* card size S / M / L (saved per device) */
const DB_SIZE_KEY = 'aeterna.dbsize.v1', DB_SIZES = { s: 56, m: 70, l: 96 };
let DB_SIZE = (() => { try { const v = localStorage.getItem(DB_SIZE_KEY); return DB_SIZES[v] ? v : 'm'; } catch (e) { return 'm'; } })();
function dbSize(v) {
  if (!DB_SIZES[v]) return; DB_SIZE = v;
  try { localStorage.setItem(DB_SIZE_KEY, v); } catch (e) { /* blocked: this visit only */ }
  dqa('[data-a="db-size"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  const g = $('db-card-list'); g.style.setProperty('--db-cw', DB_SIZES[v] + 'px'); DBV.rowH = 0; renderDeckBuilder();
}
/* hover peek (PC): the card enlarged beside the pointer after a short pause */
let DB_PEEK = 0;
function dbPeekHide() { clearTimeout(DB_PEEK); const p = $('db-peek'); if (p) p.remove(); }
document.addEventListener('mouseover', e => {
  const c = evC(e, '#db-card-list [data-a="dbcard"]'); dbPeekHide();
  if (!c || !isPC() || !CARDS[c.dataset.v]) return;
  DB_PEEK = setTimeout(() => {
    const r = c.getBoundingClientRect(), p = document.createElement('div'); p.id = 'db-peek';
    p.innerHTML = `<div class="dbp-face">${cardFaceHTML(CARDS[c.dataset.v], true)}</div><div class="dbp-fx">${effectTextHTML(CARDS[c.dataset.v], false)}</div>`;
    p.style.left = Math.min(innerWidth - 270, r.right + 8) + 'px'; p.style.top = Math.max(8, Math.min(innerHeight - 340, r.top - 40)) + 'px';
    document.body.appendChild(p);
  }, 350);
});
document.addEventListener('scroll', dbPeekHide, true);
function dbTap(id) { if (!dbChange(id, 1)) showCardDetail(id, 'deck'); }   // illegal or at max: the detail says why
function dbKey(id) {                // the deck's Key Spirit mark: one Spirit per deck; unmark by pressing again (v0.103.0)
  if (!CARDS[id] || CARDS[id].type !== 'Spirit') return;
  if (SLOTS[ACTIVE_SLOT].key === id) delete SLOTS[ACTIVE_SLOT].key;
  else SLOTS[ACTIVE_SLOT].key = PLAYER_DECK[id] > 0 ? id : undefined;
  saveDeck(); renderDeckBuilder();
}
async function dbImport() {
  DB_IO = '';
  const v = await modal({ uiOnly: true, title: 'Import deck list', html: '<div class="db-io-hint">One card per line: <b>3 BS44-001</b> or <b>3x Card Name</b>. The current cards in this slot are replaced (Undo brings them back).</div><textarea id="db-io" class="lib-area" spellcheck="false"></textarea>', buttons: [{ label: 'Import', cls: 'primary', value: 'ok' }, { label: 'Cancel', cls: 'cancel', value: null }] });
  if (v !== 'ok') return;
  const r = textToDeck(DB_IO);
  if (!deckTotal(r.deck)) { uiInfo('Nothing imported', 'No cards recognised.' + (r.bad.length ? '<br>' + r.bad.slice(0, 8).map(esc).join('<br>') : '')); return; }
  SLOTS[ACTIVE_SLOT].key = r.key && CARDS[r.key] ? r.key : null;      // the KEY line marks the deck's Key Spirit (v0.103.0)
  dbReplace(r.deck);
  if (r.bad.length) uiInfo('Imported with skipped lines', esc(r.bad.slice(0, 8).join('\n')).replace(/\n/g, '<br>'));
}
async function dbExport(d) {
  const txt = deckToText(d, SLOTS[ACTIVE_SLOT].key);
  const v = await modal({ uiOnly: true, title: 'Export deck list', html: `<textarea id="db-io" class="lib-area" spellcheck="false" readonly>${esc(txt)}</textarea>`, buttons: [{ label: 'Copy', cls: 'primary', value: 'copy' }, { label: 'Close', cls: 'cancel', value: null }] });
  if (v === 'copy') { try { await navigator.clipboard.writeText(txt); } catch (e) { /* clipboard blocked: the text stays selectable in the box */ } }
}

/* ---------- deck panel (PC column / phone full-height sheet) ---------- */
function dbStatsHTML(v) {
  const curve = DB_COSTS.map(() => 0), cols = {}, types = {};
  for (const [id, n] of Object.entries(PLAYER_DECK)) {
    const c = CARDS[id]; if (!c || !n) continue;
    curve[Math.min(10, c.cost)] += n;
    for (const k of cardColors(c)) cols[k] = (cols[k] || 0) + n;
    types[dbTypeOf(c)] = (types[dbTypeOf(c)] || 0) + n;
  }
  const mx = Math.max(1, ...curve);
  const bars = curve.map((n, i) => `<div class="db-bar" title="Cost ${i === 10 ? '10+' : i}: ${n}"><span class="db-bar-n">${n || ''}</span><i style="height:${Math.round(n / mx * 100)}%"></i><span class="db-bar-k">${i === 10 ? '10+' : i}</span></div>`).join('');
  const colTxt = DB_COLORS.filter(k => cols[k]).map(k => `<span class="db-split" style="--chip:${colorVar(k)}">${cap(k)} ${cols[k]}</span>`).join('') || '<span class="db-split-none">-</span>';
  const tyTxt = DB_TYPES.filter(t => types[t]).map(t => `<span class="db-split">${t} ${types[t]}</span>`).join('') || '<span class="db-split-none">-</span>';
  return `<div class="db-stat-h">Cost curve</div><div class="db-curve">${bars}</div><div class="db-stat-h">Colours</div><div class="db-splits">${colTxt}</div><div class="db-stat-h">Types</div><div class="db-splits">${tyTxt}</div>`;
}
function dbRowsHTML() {
  const ids = Object.keys(PLAYER_DECK).filter(id => CARDS[id] && PLAYER_DECK[id]);
  if (!ids.length) return '<div class="empty-note db-empty">The deck is empty. Tap a card to add it.</div>';
  return DB_TYPES.map(t => {
    const g = ids.filter(id => dbTypeOf(CARDS[id]) === t).sort((a, b) => CARDS[a].cost - CARDS[b].cost || DB_COLL.compare(CARDS[a].name, CARDS[b].name));
    if (!g.length) return '';
    const tot = g.reduce((s, id) => s + PLAYER_DECK[id], 0);
    return `<div class="db-grp"><div class="db-grp-h">${t} <span>${tot}</span></div>` + g.map(id => {
      const c = CARDS[id], n = PLAYER_DECK[id], bad = legalityOf(id, FORMAT), isKey = SLOTS[ACTIVE_SLOT].key === id;
      const img = cardImgSrc(id);
      const im = img ? `<span class="db-row-img has-img" style="background-image:url('${img}')" aria-hidden="true"></span>` : `<span class="db-row-img" aria-hidden="true">${c.type.substring(0, 1).toUpperCase()}</span>`;
      return `<div class="db-row${bad ? ' bad' : ''}" style="${colorSty(c)}">${im}<span class="db-row-cost">${c.cost}</span><button class="db-row-name" data-a="dbinfo" data-v="${id}" title="${esc(id)}">${esc(c.name)}${fxMarkHTML(c)}${bad ? ' 🚫' : ''}</button>
        ${c.type === 'Spirit' ? `<button class="db-row-key${isKey ? ' on' : ''}" data-a="db-key" data-v="${id}" aria-pressed="${isKey}" aria-label="${isKey ? 'Unmark ' : 'Mark '}${esc(c.name)} as the deck's Key Spirit" title="${isKey ? 'Draws favour this Spirit: tap to unmark' : 'Mark this Spirit: while no copy is in the Hand or on the Field, draws favour it'}">KEY</button>` : ''}<button class="db-row-btn" data-a="db-row" data-v="${id}:-1" aria-label="Remove one ${esc(c.name)}">−</button><span class="db-row-n">${n}</span><button class="db-row-btn" data-a="db-row" data-v="${id}:1" aria-label="Add one ${esc(c.name)}"${dbCanAdd(id) ? '' : ' disabled'}>+</button></div>`;
    }).join('') + '</div>';
  }).join('');
}
function renderDbDeck(v) {
  const ok = v.ok, txt = ok ? `legal in ${fmtName(FORMAT)}` : errSummary(v);
  $('db-counter').innerHTML = `<b>${v.total}</b> / 40+`;
  const st = $('db-status'); st.className = 'db-status ' + (ok ? 'ok' : 'bad'); st.textContent = `${fmtName(FORMAT)} · ${v.total} cards · ${ok ? 'legal' : errSummary(v)}`;
  $('db-dk-list').innerHTML = dbRowsHTML();
  $('db-dk-stats').innerHTML = dbStatsHTML(v);
  const chk = [[v.total >= 40, `${v.total} cards (40 or more)`]].concat(v.errors.filter(e => !/^Needs at least/.test(e)).slice(0, 6).map(e => [false, e]));
  if (v.ok) chk.push([true, `Legal in ${fmtName(FORMAT)}`]);
  $('db-check').innerHTML = chk.map(([ok, t]) => `<li class="${ok ? 'ok' : 'bad'}">${esc(t)}</li>`).join('');
  $('db-undo').disabled = !DB_UNDO.length; $('db-redo').disabled = !DB_REDO.length;
  $('db-topcount').style.setProperty('--p', Math.min(100, Math.round(v.total / 40 * 100)) + '%');
  const L = deckLook(ACTIVE_SLOT);
  $('db-deckbar').innerHTML = `<span class="db-mini" aria-hidden="true"><span class="sleeve mini" style="--sl-tint:${SLEEVE_TINTS[L.sleeve]}"></span><i class="g-core" style="${coreVars('core', L.core)}"></i><i class="g-soul" style="${coreVars('soul', L.soul)}"></i></span><span>Deck <b>${v.total}</b>/40</span><span class="${ok ? 'ok' : 'bad'}">${ok ? 'legal' : 'not legal'}</span><span class="db-deckbar-up">▲</span>`;
  $('db-deckbar').className = 'db-deckbar ' + (ok ? 'ok' : 'bad'); $('db-deckbar').title = txt;
  $('db-topcount').textContent = `${v.total}/40`; $('db-topcount').className = 'db-topcount ' + (ok ? 'ok' : 'bad');
}
function dbSheet(which) {             // phone: open 'filters', 'deck' or 'menu'; '' closes all (PC: FILTERS shows / hides the filter column)
  const vw = $('view-deckbuilder');
  if (which === 'filters' && isPC()) { const off = vw.classList.toggle('db-rail-off'); $('db-filter-btn').setAttribute('aria-expanded', String(!off)); return; }
  vw.classList.toggle('db-open-filters', which === 'filters');
  if (!isPC()) $('db-filter-btn').setAttribute('aria-expanded', String(which === 'filters'));
  vw.classList.toggle('db-open-deck', which === 'deck');
  vw.classList.toggle('db-open-menu', which === 'menu');
}

function renderDeckBuilder() {
  { const g = $('db-card-list'); if (g && !g.style.getPropertyValue('--db-cw')) { g.style.setProperty('--db-cw', DB_SIZES[DB_SIZE] + 'px'); dqa('[data-a="db-size"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === DB_SIZE))); } }
  const v = validateDeck(PLAYER_DECK, null, SLOTS[ACTIVE_SLOT].key);
  const fb = $('db-format'); if (fb) fb.textContent = fmtButton(FORMAT);
  const ds = $('db-slot');
  if (ds) {
    ds.innerHTML = SLOTS.map((sl, i) => `<option value="${i}"${i === ACTIVE_SLOT ? ' selected' : ''}>${i + 1}. ${esc(sl.name)} (${deckTotal(i === ACTIVE_SLOT ? PLAYER_DECK : sl.cards)})</option>`).join('');
    if (document.activeElement !== $('db-name')) $('db-name').value = SLOTS[ACTIVE_SLOT].name;
    $('db-preset').innerHTML = '<option value="">Load ready-made…</option>' + prebuiltOrder(FORMAT).map(({ d }) => `<option value="${d.id}">${esc(prebuiltLabel(d))}</option>`).join('');
  }
  renderDbRail(); renderDbDeck(v); dbTab(DB_TAB);
  dbFilter(); dbWindow(true);
}
document.addEventListener('contextmenu', e => {
  const c = evC(e, '#db-card-list [data-a="dbcard"]');
  if (c) { e.preventDefault(); showCardDetail(c.dataset.v, 'deck'); }
});
document.addEventListener('keydown', e => {
  if (!$('view-deckbuilder').classList.contains('active')) return;
  if ($('action-modal').classList.contains('active')) { // Escape closes a modal that offers Close / Cancel (card detail)
    if (e.key === 'Escape' && MODAL && (MODAL.cfg.buttons || []).some(b => b.value === null && !b.dis)) { e.preventDefault(); closeModal(null); }
    return;
  }
  const t = evT(e), typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
  if (e.key === '/' && !typing) { e.preventDefault(); $('db-search').focus(); }
  else if (e.key === 'Escape' && t.id === 'db-search') { evV(e).value = ''; renderDeckBuilder(); }
  else if (e.key === 'Escape') dbSheet('');
});
document.addEventListener('input', e => {
  const t = evV(e);
  if (t.id === 'db-io') DB_IO = t.value;
  else if (t.id === 'db-family') { DBF.family = t.value; dbSearchInput(); }
});
