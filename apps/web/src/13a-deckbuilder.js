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
const DB_GROUP_ALL = [['multi', 'All colour'], ['mirage', 'Mirage'], ['rebirth', 'Rebirth'], ['legacy', 'Legacy'], ['ex', 'EX symbol'], ['burst', 'Burst'], ['trueRelease', 'True Release'], ['manifest', 'Manifest'], ['highSpeed', 'High Speed'], ['token', 'Token']];
const DB_TYPE_GROUPS = DB_GROUP_ALL.filter(([g]) => g === 'mirage' || g === 'rebirth');          // v0.155.0 (owner review): Mirage and Rebirth sit with the types
const DB_GROUPS = DB_GROUP_ALL.filter(([g]) => !['multi', 'mirage', 'rebirth'].includes(g));      // the Group menu; "All colour" has the rainbow pip
const RAINBOW = 'conic-gradient(#e53935,#fdd835,#43a047,#1e88e5,#8e24aa,#e53935)';
/** the colour pips, then the rainbow "All colour" pip; the chips of the types row, then Mirage / Rebirth (shared by the deck builder and the Library) */
const filterPipsHTML = (S, act) => DB_COLORS.map(c => `<button class="pip${S.colors.has(c) ? ' on' : ''}" style="--c:${colorVar(c)}" data-a="${act}" data-v="colors:${c}" aria-label="${cap(c)}" aria-pressed="${S.colors.has(c)}" title="${cap(c)}"><i></i></button>`).join('')
  + `<button class="pip rainbow${S.groups.has('multi') ? ' on' : ''}" style="--c:${RAINBOW}" data-a="${act}" data-v="groups:multi" aria-label="All colour (cards with more than one colour)" aria-pressed="${S.groups.has('multi')}" title="All colour (more than one colour)"><i></i></button>`;
const filterTypesHTML = (S, act) => DB_TYPES.map(t => `<button class="chip${S.types.has(t) ? ' on' : ''}" data-a="${act}" data-v="types:${t}" aria-pressed="${S.types.has(t)}">${t}</button>`).join('')
  + DB_TYPE_GROUPS.map(([g, l]) => `<button class="chip${S.groups.has(g) ? ' on' : ''}" data-a="${act}" data-v="groups:${g}" aria-pressed="${S.groups.has(g)}">${l}</button>`).join('');
/* v0.158.0 (owner review, phone): one dropdown per filter group - Colour, Type, Cost and Group - shared by the Deck Builder and the Library.
   Each entry knows the Set it toggles in (colors / types / costs / groups), so the menu, the button label and Clear work the same everywhere. */
/* v0.188.0 (R2): Family list, Level-1 BP ranges and top-level core counts; a mode item is a Set-shaped switch (colours / families: any -> all) */
/** @type {[string, number, number][]} */
const DB_BPS = [['≤2,000', 0, 3000], ['3,000–4,000', 3000, 5000], ['5,000–6,000', 5000, 7000], ['7,000–9,000', 7000, 10000], ['10,000+', 10000, 1e9]];
/** @type {[string, number, number][]} */
const DB_CORES = [['≤2', 0, 3], ['3', 3, 4], ['4', 4, 5], ['5', 5, 6], ['6+', 6, 99]];
const DB_FAMS = { ver: -1, list: [] };
const DB_ICONS = ['A', ...Array.from({ length: 11 }, (_, i) => String(i + 3)), 'none'];
/** R3: distinct values of one official card field (rarity or collaboration), in data order of first appearance. */
const DB_VALS = {};
const dbVals = key => { const m = DB_VALS[key]; if (m && m.ver === CARDS_VER) return m.list; const list = [...new Set(Object.values(CARDS).flatMap(c => c[key] || []))].sort(DB_COLL.compare); DB_VALS[key] = { ver: CARDS_VER, list }; return list; };
const dbFamilies = () => { if (DB_FAMS.ver !== CARDS_VER) { DB_FAMS.list = [...new Set(Object.values(CARDS).flatMap(c => c.families || []))].sort(DB_COLL.compare); DB_FAMS.ver = CARDS_VER; } return DB_FAMS.list; };
const ddMode = (S, key, l) => ({ l, mode: 1, v: '@' + key, set: { has: () => S[key], add: () => { S[key] = true; }, delete: () => { S[key] = false; } } });
/** @returns {any[]} */
function ddList(S, kind) {
  if (kind === 'sort') {
    const one = (k, v) => ({ has: x => S[k] === x, add: x => { S[k] = x; }, delete() {} });
    return [{ l: 'Ascending', set: one('sortDir'), v: 'asc', mode: true }, { l: 'Descending', set: one('sortDir'), v: 'desc', mode: true }, ...(S === DBF ? [['default', 'Default']] : []).concat(DB_SORT_KEYS).map(([v, l]) => ({ l, set: one('sort'), v }))];
  }
  if (kind === 'bp') return DB_BPS.map(([l], i) => ({ l, set: S.bps, v: String(i) }));
  if (kind === 'cores') return DB_CORES.map(([l], i) => ({ l, set: S.cores, v: String(i) }));
  if (kind === 'family') return [ddMode(S, 'ffall', 'Match all selected'), ...dbFamilies().map(f => ({ l: f, set: S.fams, v: f }))];
  if (kind === 'icon') return DB_ICONS.map(v => ({ l: v === 'none' ? 'No icon' : v === 'A' ? 'Block A' : 'Block ' + v, set: S.icons, v }));
  if (kind === 'rarity') return dbVals('rcode').concat('none').map(v => ({ l: v === 'none' ? 'No data' : v, set: S.rars, v })); // 'none': cards the official site lacks (BS77, a few X cards)
  if (kind === 'collab') return dbVals('collab').map(v => ({ l: v, set: S.collabs, v }));
  if (kind === 'colour') return [ddMode(S, 'cmode', 'Match all selected'), ...DB_COLORS.map(c => ({ l: cap(c), set: S.colors, v: c, dot: colorVar(c) })), { l: 'All colour', set: S.groups, v: 'multi', dot: RAINBOW }];
  if (kind === 'type') return DB_TYPES.map(t => ({ l: t, set: S.types, v: t })).concat(DB_TYPE_GROUPS.map(([g, l]) => ({ l, set: S.groups, v: g })));
  if (kind === 'cost') return DB_COSTS.map(c => ({ l: c === '10' ? '10+' : c, set: S.costs, v: c }));
  return DB_GROUPS.map(([g, l]) => ({ l, set: S.groups, v: g }));
}
const ddSel = (S, kind) => ddList(S, kind).filter(i => !i.mode && i.set.has(i.v)).map(i => i.l);
const ddSortDef = S => S === DBF ? 'default' : 'set';
const ddButton = (S, kind, label, act) => {
  const srt = kind === 'sort', sel = srt ? (S.sort === ddSortDef(S) ? [] : [DB_SORT_KEYS.find(k => k[0] === S.sort)[1] + (S.sortDir === 'desc' ? ' ↓' : ' ↑')]) : ddSel(S, kind);
  return `<button class="chip ddb${['colour', 'type', 'cost'].includes(kind) ? ' ddphone' : ''}${sel.length ? ' on' : ''}" data-a="${act}" data-v="${kind}" aria-haspopup="true" aria-expanded="${S.dd === kind}">${label}: ${srt && !sel.length ? (S === DBF ? 'Default' : 'Set') : sel.length > 2 && !srt ? sel.length + ' selected' : sel.join(', ') || 'All'} ▾</button>`;
};
function ddMenuEl(S, tb, btn, pick, clear) {
  const items = ddList(S, S.dd), m = document.createElement('div'); m.className = 'ddmenu scroll'; m.setAttribute('role', 'menu');
  m.innerHTML = (S.dd === 'family' ? '<input class="in ddq" type="search" placeholder="Search family" aria-label="Search family" autocomplete="off">' : '') + items.map(i => `<button class="ddi${i.set.has(i.v) ? ' on' : ''}${i.mode ? ' mode' : ''}" data-q="${esc(i.l.toLowerCase())}" data-a="${pick}" data-v="${i.v}" role="menuitemcheckbox" aria-checked="${i.set.has(i.v)}"><span class="ddc">${i.set.has(i.v) ? '✓' : ''}</span>${i.dot ? `<i class="dot" style="background:${i.dot}"></i>` : ''}<span class="grow">${i.l}</span></button>`).join('') + `<button class="ddi clr" data-a="${clear}">Clear</button>`;
  tb.appendChild(m);
  const q = /** @type {HTMLInputElement|null} */ (m.querySelector('.ddq'));
  if (q) { const f = () => { S.fq = q.value; const w = q.value.trim().toLowerCase(); /** @type {NodeListOf<HTMLElement>} */ (m.querySelectorAll('.ddi[data-q]')).forEach(b => { b.hidden = !!w && !b.classList.contains('mode') && !b.dataset.q.includes(w); }); }; q.value = S.fq || ''; q.oninput = f; f(); }
  const r = btn.getBoundingClientRect(), t = tb.getBoundingClientRect(), w = Math.max(r.width, 210);
  m.style.width = w + 'px'; const mw = m.offsetWidth; m.style.left = Math.max(6, Math.min(t.width - mw - 6, r.left - t.left)) + 'px';   // mw: the phone CSS forces another width than w m.style.top = (r.bottom - t.top + 4) + 'px';
}
function ddPick(S, v, clear) { if (clear && S.dd === 'sort') { S.sort = ddSortDef(S); S.sortDir = 'asc'; return; } const items = ddList(S, S.dd); if (clear) items.forEach(i => i.set.delete(i.v)); else { const i = items.find(x => x.v === v); if (i) { if (i.set.has(i.v)) i.set.delete(i.v); else i.set.add(i.v); } } }
const ddReset = S => { ['colors', 'costs', 'types', 'groups', 'bps', 'cores', 'fams', 'icons', 'rars', 'collabs'].forEach(g => S[g].clear()); S.cmode = S.ffall = false; S.fq = ''; };
const DBF = { colors: new Set(), costs: new Set(), types: new Set(), groups: new Set(), bps: new Set(), cores: new Set(), fams: new Set(), icons: new Set(), rars: new Set(), collabs: new Set(), cmode: false, ffall: false, fq: '', set: '', family: '', legal: false, complete: false, only: false, dd: '', sort: 'default', sortDir: 'asc' };
const DB_UNDO = [], DB_REDO = [];   // v0.128.0 U14f: Redo; any new change empties it
let DB_IO = '';
const dbArr = v => v == null || v === '' ? [] : Array.isArray(v) ? v : v instanceof Set ? [...v] : [String(v)];
const dbTypeOf = c => c.contract ? 'Contract' : c.type;
const dbSetOf = id => String(id).replace(/-.*$/, '');
/** Deck builder filter test. Each filter is a value, a list or a Set; empty = no filter; cost "10" = 10 or more. */
function dbFilterOK(c, color, cost, type, all) {
  const cl = dbArr(color), co = dbArr(cost), ty = dbArr(type);
  if (cl.length && !(all ? cl.every(x => cardColors(c).includes(x)) : cardColors(c).some(x => cl.includes(x)))) return false;
  if (co.length && !co.some(k => (k === '10' ? c.cost >= 10 : c.cost === Number(k)))) return false;
  if (ty.length && !ty.some(t => (t === 'Contract' ? !!c.contract : c.type === t && !c.contract))) return false;
  return true;
}
/** R2: Family list (any / all), Level-1 BP range and top core count; a card without BP (Magic, Nexus) drops out when a BP or core filter is set. */
function dbPlusOK(c, S) {
  const l = c.levels || [], bp = l[0] && l[0].bp;
  if ((S.bps.size || S.cores.size) && bp == null) return false;
  if (S.bps.size && ![...S.bps].some(i => bp >= DB_BPS[i][1] && bp < DB_BPS[i][2])) return false;
  const top = Math.max(0, ...l.map(x => x.cores || 0));
  if (S.cores.size && ![...S.cores].some(i => top >= DB_CORES[i][1] && top < DB_CORES[i][2])) return false;
  if (S.fams.size) { const f = c.families || [], has = x => f.includes(x); if (!(S.ffall ? [...S.fams].every(has) : [...S.fams].some(has))) return false; }
  if (S.icons.size) { const b = c.bicon || []; if (!(b.length ? b.some(x => S.icons.has(x)) : S.icons.has('none'))) return false; }
  if (S.rars.size && !S.rars.has(c.rcode || 'none')) return false;
  if (S.collabs.size && !(c.collab || []).some(x => S.collabs.has(x))) return false;
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
    case 'burst': return !!c.burst;
    case 'trueRelease': return !!c.trueRelease;
    case 'manifest': return !!c.manifest;
    case 'highSpeed': return !!c.highSpeed;
    case 'token': return !!c.token;
    default: return false;
  }
}
/* v0.52.1: a search index is built once per card-data change (CARDS_VER); the filtered list is recomputed only when a
   filter, the sort or the deck (for "In deck only") changes; the grid is windowed (spacer rows keep the scroll height). */
const DBV = { idx: null, ver: -1, key: '', list: [], from: -1, to: -1, cols: 0, rowH: 0, raf: 0, timer: 0, pulse: '' };
const DB_GAP = 16, DB_BUF = 2;
const DB_COLL = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
function dbIndex() {
  if (!DBV.idx || DBV.ver !== CARDS_VER) {
    DBV.idx = Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')).map((id, i) => { const c = CARDS[id]; return { id, i, s: (id + '\n' + c.name + '\n' + (c.desc || '')).toLowerCase(), f: (c.families || []).join(' / ').toLowerCase() }; });
    DBV.ver = CARDS_VER; DBV.key = '';
  }
  return DBV.idx;
}
function dbSets() { return [...new Set(dbIndex().map(e => dbSetOf(e.id)))].sort(DB_COLL.compare); }
function dbActiveCount() { return DBF.colors.size + DBF.costs.size + DBF.types.size + DBF.groups.size + DBF.bps.size + DBF.cores.size + DBF.fams.size + DBF.icons.size + DBF.rars.size + DBF.collabs.size + (DBF.set ? 1 : 0) + (DBF.family ? 1 : 0) + (DBF.legal ? 1 : 0) + (DBF.complete ? 1 : 0) + (DBF.only ? 1 : 0) + ((($('db-search') || {}).value) ? 1 : 0); }
/** R9: Sort menu. A value of null (no BP on a Magic, no rarity, ...) sorts last in both directions; ties fall back to the card code. */
const DB_RARITY_ORDER = ['C', 'CP', 'U', 'R', 'M', 'X', 'XX', 'XV', 'NX', 'AX'];
const DB_SORT_VAL = {
  set: (c, id) => id, name: c => c.name, cost: c => c.cost,
  colour: c => { const i = DB_COLORS.indexOf(cardColors(c)[0]); return i < 0 ? null : i; },
  type: c => { const i = DB_TYPES.indexOf(dbTypeOf(c)); return i < 0 ? null : i; },
  bp: c => c.levels && c.levels[0] ? c.levels[0].bp : null,
  cores: c => c.levels && c.levels[0] ? c.levels[0].cores : null,
  red: c => c.reduction ? DB_COLORS.reduce((n, k) => n + (c.reduction[k] || 0), 0) : null,
  family: c => (c.families || [])[0] || null,
  complete: c => fxMarked(c) ? 1 : 0,
  rarity: c => c.rcode ? (DB_RARITY_ORDER.indexOf(c.rcode) + 1 || 99) : null,
  block: c => (c.bicon || [])[0] || null,
};
const DB_SORT_KEYS = [['set', 'Set'], ['name', 'Name'], ['cost', 'Cost'], ['colour', 'Colour'], ['type', 'Type'], ['bp', 'BP (Lv1)'], ['cores', 'Cores (Lv1)'], ['red', 'Reduction'], ['family', 'Family'], ['complete', 'Complete first'], ['rarity', 'Rarity'], ['block', 'Block']];
function dbSortCmp(key, dir) {
  const f = DB_SORT_VAL[key], sg = dir === 'desc' ? -1 : 1; if (!f) return null;
  return (a, b) => {
    const x = f(CARDS[a.id], a.id), y = f(CARDS[b.id], b.id);
    const r = x == null || y == null ? Number(x == null) - Number(y == null) : sg * (typeof x === 'string' ? DB_COLL.compare(x, y) : x - y);
    return r || DB_COLL.compare(a.id, b.id);
  };
}
function dbFilter() {
  const q = ($('db-search').value || '').trim().toLowerCase(), only = DBF.only, fam = DBF.family.trim().toLowerCase();
  const idx = dbIndex(), key = [CARDS_VER, q, only ? Object.keys(PLAYER_DECK).filter(id => PLAYER_DECK[id]).sort().join(',') : '', [...DBF.colors].join(), [...DBF.costs].join(), [...DBF.types].join(), [...DBF.groups].join(), [...DBF.bps].join(), [...DBF.cores].join(), [...DBF.fams].join('~'), [...DBF.icons].join(), [...DBF.rars].join(), [...DBF.collabs].join(), DBF.cmode, DBF.ffall, DBF.set, fam, DBF.legal, DBF.complete, DBF.sort, DBF.sortDir, FORMAT].join('|');
  if (key === DBV.key) return DBV.list;
  DBV.key = key;
  let l = idx.filter(e => (!only || PLAYER_DECK[e.id]) && (!q || e.s.includes(q)) && (!fam || e.f.includes(fam)) && (!DBF.set || dbSetOf(e.id) === DBF.set) && dbFilterOK(CARDS[e.id], DBF.colors, DBF.costs, DBF.types, DBF.cmode) && dbPlusOK(CARDS[e.id], DBF) && ([...DBF.groups].every(g => dbGroupOK(CARDS[e.id], g))) && (!DBF.legal || !legalityOf(e.id, FORMAT)) && (!DBF.complete || !fxMarked(CARDS[e.id])));
  const cmp = dbSortCmp(DBF.sort, DBF.sortDir); if (cmp) l = l.slice().sort(cmp);
  DBV.list = l.map(e => e.id);
  const tr = DBV.list.filter(id => id.startsWith('TRAIN-')).length;      // v0.99 U8a: Home counts real cards only; say which extra cards the builder shows
  $('db-count').textContent = `${DBV.list.length.toLocaleString('en-US')} card(s) shown` + (tr ? ` (${tr} Training)` : '');
  return DBV.list;
}
// v0.79.0 (A1, owner 2026-10-20): a card whose printed effect is not fully implemented carries a "!" mark in the deck builder
// grid and deck rows (and the Library counts); the missing clauses simply do not happen (no manual mode). Built-in training cards count as complete; older hand-wired cards with fxComplete false show the mark too.
const fxMarked = c => !!c && c.implemented === false;
const FX_MARK_LBL = 'Effect not fully implemented';
const fxMarkHTML = c => fxMarked(c) ? `<span class="fx-mark" role="img" aria-label="${FX_MARK_LBL}" title="${FX_MARK_LBL}">!</span>` : '';
function dbCardHTML(id) {             // v0.137.0: the mockup tile (card face, hover buttons - / i / +, copy pips, "max" ring)
  const c = CARDS[id], n = PLAYER_DECK[id] || 0, mx = maxCopies(id, FORMAT), banned = legalityOf(id, FORMAT);
  const bd = [0, 1, 2].map(i => `<i${i < n ? ' class="f"' : ''}></i>`).join('');
  return `<div class="tile${n && n >= mx ? ' max' : ''}${DBV.pulse === id ? ' pulse' : ''}" data-a="dbcard" data-v="${id}" title="${esc(c.name)} (${id})${fxMarked(c) ? ' - ' + FX_MARK_LBL : ''}: tap to add" tabindex="0">${cardFaceHTML(c, false)}${fxMarkHTML(c)}${banned ? '<div class="ban-badge" title="Not legal in this format">🚫</div>' : banStatus(id, FORMAT) === 'limit1' ? '<div class="ban-badge lim">1</div>' : ''}<div class="ov"><button class="m" data-a="db-row" data-v="${id}:-1" aria-label="Remove one copy">−</button><button class="m" data-a="dbinfo" data-v="${id}" aria-label="Card details" style="font-size:15px">i</button><button data-a="db-row" data-v="${id}:1" aria-label="Add one copy">+</button></div><button class="inf" data-a="dbinfo" data-v="${id}" aria-label="Card details">i</button><div class="bd">${bd}</div></div>`;
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
  const first = elq(el, '.tile'), h = first ? first.offsetHeight + DB_GAP : 0;
  if (h > DB_GAP && Math.abs(h - DBV.rowH) > 0.5) { DBV.rowH = h; dbWindow(true); }   // first measurement (or a layout change)
}
function dbScroll() { if (!DBV.raf) DBV.raf = requestAnimationFrame(() => { DBV.raf = 0; if ($('view-deckbuilder').classList.contains('active')) dbWindow(false); }); }
function dbSearchInput() { clearTimeout(DBV.timer); DBV.timer = setTimeout(() => { DBV.timer = 0; renderDeckBuilder(); }, 120); }

/* ---------- toolbar (mockup: colour pips, type chips, cost buttons, group / colour dropdowns, flag chips, Clear N) ---------- */
function dbBar() {
  const on = (s, v) => s.has(v), set = $('db-set'), sets = dbSets(), sig = sets.join();
  $('db-pips').innerHTML = filterPipsHTML(DBF, 'db-chip');
  $('db-types').innerHTML = filterTypesHTML(DBF, 'db-chip');
  $('db-costs').innerHTML = DB_COSTS.map(k => `<button class="cbtn${on(DBF.costs, k) ? ' on' : ''}" data-a="db-chip" data-v="costs:${k}" aria-pressed="${on(DBF.costs, k)}" aria-label="Cost ${k}">${k === '10' ? '10+' : k}</button>`).join('');
  $('db-colbtn').innerHTML = ddButton(DBF, 'colour', 'Colour', 'db-dd') + ddButton(DBF, 'type', 'Type', 'db-dd') + ddButton(DBF, 'cost', 'Cost', 'db-dd');
  $('db-groups').innerHTML = ddButton(DBF, 'group', 'Group', 'db-dd') + ddButton(DBF, 'family', 'Family', 'db-dd') + ddButton(DBF, 'bp', 'BP', 'db-dd') + ddButton(DBF, 'cores', 'Cores', 'db-dd') + ddButton(DBF, 'icon', 'Block', 'db-dd') + ddButton(DBF, 'rarity', 'Rarity', 'db-dd') + ddButton(DBF, 'collab', 'Collab', 'db-dd');
  $('db-sortbtn').innerHTML = ddButton(DBF, 'sort', 'Sort', 'db-dd');            // owner review 2026-10-30: Sort shares a row with the three flag chips
  [['db-play', 'complete'], ['db-in', 'only'], ['db-legal', 'legal']].forEach(([id, k]) => { const b = $(id); b.classList.toggle('on', DBF[k]); b.setAttribute('aria-pressed', String(DBF[k])); });
  dbMenu();
  if (set.dataset.sig !== sig) { set.innerHTML = '<option value="">All sets</option>' + sets.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join(''); set.dataset.sig = sig; }
  set.value = DBF.set;
  if (document.activeElement !== $('db-family')) $('db-family').value = DBF.family;
  $('db-size').innerHTML = DB_SIZE_LIST.map(([v, l]) => `<button data-a="db-size" data-v="${v}" aria-pressed="${DB_SIZE === v}">${l}</button>`).join('');
  const n = dbActiveCount(); $('db-clear-f').innerHTML = n ? `<button class="chip" data-a="db-freset">Clear ${n} ✕</button>` : '';
  dbMinApply(n);
}
/* Hide / show filters (owner review 2026-10-30): everything in the toolbar except the search box folds away, like the Library's "Hide filters". Remembered on this device. */
let DB_MIN = false; try { DB_MIN = localStorage.getItem('bse.dbmin') === '1'; } catch (e) { /* blocked: this visit only */ }
function dbMinApply(n) {
  const b = $('db-min'), v = $('bld'); if (!b || !v) return;
  v.classList.toggle('db-min', DB_MIN); b.setAttribute('aria-pressed', String(DB_MIN));
  if (n === undefined) n = dbActiveCount();
  b.textContent = DB_MIN ? '▼ Show filters' + (n ? ` (${n})` : '') : '▲ Hide filters';
}
function dbMinToggle() { DB_MIN = !DB_MIN; try { localStorage.setItem('bse.dbmin', DB_MIN ? '1' : '0'); } catch (e) { /* blocked */ } dbMinApply(); }
function dbMenu() {                   // the dropdown menu (Colour, Type and Cost on phone, Group everywhere)
  document.querySelectorAll('#db-tbar .ddmenu').forEach(m => m.remove());
  const tb = $('db-tbar'), btn = DBF.dd && tb.querySelector(`[data-a="db-dd"][data-v="${DBF.dd}"]`); if (!btn) return;
  ddMenuEl(DBF, tb, btn, 'db-ddpick', 'db-ddclear');
}
document.addEventListener('click', e => { if (DBF.dd && !(/** @type {Element} */ (e.target)).closest('.ddmenu,[data-a="db-dd"]')) { DBF.dd = ''; dbMenu(); } });
function dbDd(a, v) {
  if (a === 'db-dd') { DBF.dd = DBF.dd === v ? '' : v; dbBar(); return; }
  if (a === 'db-ddpick') { ddPick(DBF, v, false); if (DBF.dd === 'sort') $('db-card-list').scrollTop = 0; } else { ddPick(DBF, v, true); DBF.dd = ''; }
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
  const L = deckLook(ACTIVE_SLOT), tint = SLEEVE_TINTS[L.sleeve] || '#aab3c2', sp = Object.keys(PLAYER_DECK).filter(id => CARDS[id] && PLAYER_DECK[id] && CARDS[id].type === 'Spirit' && !CARDS[id].contract).slice(0, 6), cov = SLOTS[ACTIVE_SLOT].cover;
  const grid = (k, list, sw) => `<div class="dgrp"><span>${k === 'soul' ? 'Soul Core' : 'Core'}</span></div><div class="db-lkg">${Object.keys(list).map(n =>
    `<button class="db-lkb" data-a="db-look" data-v="${k}:${n}" aria-pressed="${L[k] === n}" title="${cap(n)}">${sw(n)}<span>${cap(n)}</span></button>`).join('')}</div>`;
  const img = SLEEVE_IMG[ACTIVE_SLOT];
  $('db-look').innerHTML = `<div class="dgrp"><span>Sleeve</span><b>${cap(L.sleeve)}</b></div><div class="row" style="gap:12px;flex-wrap:wrap"><div style="width:74px"><div class="cf back${img ? ' up' : ''}" style="--sl:${tint};${img ? `--sleeveimg:url('${img}')` : ''}"></div></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;flex:1">${Object.keys(SLEEVE_TINTS).map(n => `<button class="pip${L.sleeve === n ? ' on' : ''}" style="--c:${SLEEVE_TINTS[n]}" data-a="db-look" data-v="sleeve:${n}" aria-pressed="${L.sleeve === n}" aria-label="Sleeve ${cap(n)}" title="${cap(n)}"><i></i></button>`).join('')}
    <label class="btn sm ae-upl"><span>Upload</span><input id="db-sl-up" type="file" accept="image/*" aria-label="Upload a sleeve picture"></label>${img ? '<button class="btn sm" data-a="db-sl-clear">Remove</button>' : ''}</div></div>`
    + `<div class="dgrp"><span>Deck cover</span><b>shown in My decks</b></div>` + (sp.length ? `<div class="row" style="gap:8px;overflow:auto;padding:4px 2px 10px">${sp.map(id => `<button style="border:0;background:none;padding:0;width:58px;flex:none;${cov === id ? 'outline:3px solid var(--yes);outline-offset:2px;border-radius:7px' : ''}" data-a="db-cover" data-v="${id}" aria-pressed="${cov === id}" aria-label="Cover: ${esc(CARDS[id].name)}">${cardFaceHTML(CARDS[id], false)}</button>`).join('')}</div>` : '<div class="sub">Add a Spirit to pick a cover.</div>')
    + grid('core', CORE_LOOKS, n => `<i class="g-core" style="${coreVars('core', n)}" aria-hidden="true"></i>`)
    + grid('soul', CORE_LOOKS, n => `<i class="g-soul" style="${coreVars('soul', n)}" aria-hidden="true"></i>`)
    + `<div class="dgrp"><span>Preview on the playmat</span></div><div class="card flat" style="padding:12px;display:flex;gap:10px;align-items:flex-end;background:linear-gradient(180deg,var(--bg1),var(--bg2))"><div style="width:56px"><div class="cf back${img ? ' up' : ''}" style="--sl:${tint};${img ? `--sleeveimg:url('${img}')` : ''}"></div></div>${sp.slice(0, 3).map(id => `<div style="width:56px">${cardFaceHTML(CARDS[id], false)}</div>`).join('')}</div>`;
}
function dbCover(id) { const sl = SLOTS[ACTIVE_SLOT]; if (sl.cover === id) delete sl.cover; else if (PLAYER_DECK[id]) sl.cover = id; saveDeck(); renderDbLook(); }
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
function dbToggle(group, v) {
  if (group === 'flag') { if (v in { complete: 1, only: 1, legal: 1 }) DBF[v] = !DBF[v]; }
  else { const s = DBF[group]; if (s.has(v)) s.delete(v); else s.add(v); }
  renderDeckBuilder();
}
function dbResetFilters() {
  ddReset(DBF); DBF.set = ''; DBF.family = ''; DBF.legal = false; DBF.complete = false; DBF.only = false; DBF.dd = ''; DBF.sort = 'default'; DBF.sortDir = 'asc';
  $('db-search').value = ''; $('db-card-list').scrollTop = 0; renderDeckBuilder();
}
/* v0.119.0: an explicit Save (the deck already auto-saves, but the owner wanted a visible button). It also captures the
   name input before persisting, and flashes "SAVED ✓" unless silent (the back button calls it silently). */
let DB_SAVE_T = 0, DB_NAME_T = 0;
function dbSaved(ok) { const d = $('db-savedot'); if (d) { d.classList.toggle('busy', !ok); d.lastElementChild.textContent = ok ? 'Saved' : 'Saving…'; } }
function dbNameInput(v) {                            // the deck name saves while you type (mockup: Saving… / Saved)
  dbSaved(false); clearTimeout(DB_NAME_T);
  DB_NAME_T = setTimeout(() => { SLOTS[ACTIVE_SLOT].name = (v.trim() || 'Deck ' + (ACTIVE_SLOT + 1)).slice(0, 24); saveDeck(); dbSaved(true); }, 400);
}
function dbSave(silent) {
  const nm = $('db-name');
  if (nm) { SLOTS[ACTIVE_SLOT].name = (nm.value.trim() || 'Deck ' + (ACTIVE_SLOT + 1)).slice(0, 24); nm.value = SLOTS[ACTIVE_SLOT].name; }
  saveDeck(); dbSaved(true);
  if (silent) return;
  const b = $('db-save');
  if (b) { b.textContent = 'Saved ✓'; b.classList.add('saved'); clearTimeout(DB_SAVE_T); DB_SAVE_T = setTimeout(() => { b.textContent = 'Save'; b.classList.remove('saved'); }, 1400); }
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
  const from = d > 0 ? dbFlyFrom(id) : null;
  saveDeck(); DBV.pulse = d > 0 ? id : ''; renderDeckBuilder(); DBV.pulse = '';
  if (from) dbFlyTo(id, from);
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
const DB_SIZE_KEY = 'aeterna.dbsize.v1', DB_SIZES = { s: 8, m: 6, l: 4 }, DB_SIZE_LIST = [['s', 'S'], ['m', 'M'], ['l', 'L']];   // columns of the card grid (the phone always shows 3)
let DB_SIZE = (() => { try { const v = localStorage.getItem(DB_SIZE_KEY); return DB_SIZES[v] ? v : 'm'; } catch (e) { return 'm'; } })();
function dbSize(v) {
  if (!DB_SIZES[v]) return; DB_SIZE = v;
  try { localStorage.setItem(DB_SIZE_KEY, v); } catch (e) { /* blocked: this visit only */ }
  DBV.rowH = 0; renderDeckBuilder();
}
/* v0.129.0 U14f2: a small card flies from the grid to the deck panel when you add it (Full animations only) */
function dbFlyFrom(id) { if (animMode() !== 'full') return null; const e = document.querySelector(`#db-card-list [data-v="${id}"]`); return e ? rectOf(e) : null; }
function dbFlyTo(id, a) {
  const t = rectOf(visEl('#db-dk-list')) || rectOf(visEl('#db-deckbar')) || rectOf(visEl('#db-deck')), L = $('ae-fx'); if (!t || !L) return;
  const d = document.createElement('div'); d.className = 'ae-a-flyc'; d.style.cssText = `left:${a.x + a.w / 2 - 14}px;top:${a.y + a.h / 2 - 19}px;--card-color:${colorVar(CARDS[id].symbol)}`; L.appendChild(d);
  const run = d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${t.x + 30 - a.x - a.w / 2}px,${t.y + 20 - a.y - a.h / 2}px) scale(.5)`, opacity: .6 }], { duration: 380, easing: 'ease-in' });
  run.onfinish = () => d.remove(); setTimeout(() => d.remove(), 800);
}
/* long-press (touch): hold a grid card to read it; the tap that follows is ignored (setting "Long-press for card info") */
let DB_LP = 0, DB_LP_AT = 0;
document.addEventListener('pointerdown', e => {
  const c = evC(e, '#db-card-list [data-a="dbcard"]'); clearTimeout(DB_LP);
  if (!c || e.pointerType !== 'touch' || SETTINGS.longpress === 'off') return;
  DB_LP = setTimeout(() => { DB_LP_AT = Date.now(); showCardDetail(c.dataset.v, 'deck'); }, 550);
});
['pointerup', 'pointercancel', 'pointermove', 'scroll'].forEach(n => document.addEventListener(n, () => clearTimeout(DB_LP), true));
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
function dbTap(id) { if (Date.now() - DB_LP_AT < 800) return; if (!dbChange(id, 1)) showCardDetail(id, 'deck'); }   // illegal or at max: the detail says why
function dbKey(id) {                // the deck's Key Spirit mark: one Spirit per deck; unmark by pressing again (v0.103.0)
  if (!CARDS[id] || CARDS[id].type !== 'Spirit') return;
  if (SLOTS[ACTIVE_SLOT].key === id) delete SLOTS[ACTIVE_SLOT].key;
  else SLOTS[ACTIVE_SLOT].key = PLAYER_DECK[id] > 0 ? id : undefined;
  saveDeck(); renderDeckBuilder();
}
/* v0.155.0 (batch 4, mockup DLG.import / DLG.export): Import shows the detected format live; Export has Text / Code / Image / CSV tabs */
function dbDetect(t) {
  t = String(t || '').trim(); if (!t) return '';
  const n = t.split(/\r?\n/).filter(x => x.trim()).length;
  if (/^AET-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(t)) return '✓ Format detected: deck code';
  if (/^\s*(qty|count|id)\b.*,/i.test(t) || t.split(/\r?\n/).filter(x => x.trim()).every(l => /^\s*\d+\s*,/.test(l))) return `✓ Format detected: CSV · ${n} lines`;
  return `✓ Format detected: list · ${n} line${n === 1 ? '' : 's'}`;
}
function dbCsv(d) { return 'qty,id,name\n' + Object.keys(d).filter(id => d[id] && CARDS[id]).map(id => `${d[id]},${id},"${CARDS[id].name.replace(/"/g, '""')}"`).join('\n'); }
function dbDeckPng(d, name) {          // a plain deck sheet drawn on a canvas (no card art, so it works without images)
  const ids = Object.keys(d).filter(id => d[id] && CARDS[id]), cv = document.createElement('canvas'), W = 640, H = 90 + ids.length * 26; cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); c.fillStyle = '#0f1218'; c.fillRect(0, 0, W, H); c.fillStyle = '#e8ecf2'; c.font = 'bold 22px sans-serif'; c.fillText(name, 20, 38);
  c.font = '13px sans-serif'; c.fillStyle = '#8b94a3'; c.fillText(`${deckTotal(d)} cards · Aeterna`, 20, 60); c.font = '15px sans-serif';
  ids.forEach((id, i) => { c.fillStyle = '#e8ecf2'; c.fillText(`${d[id]}×  ${CARDS[id].name}`, 20, 94 + i * 26); c.fillStyle = '#8b94a3'; c.fillText(id, W - 120, 94 + i * 26); });
  return cv.toDataURL('image/png');
}
async function dbImport() {
  DB_IO = '';
  const p = modal({ uiOnly: true, title: 'Import deck list', html: '<div class="db-io-hint">Paste a deck code or a plain list (one card per line: <b>3 BS44-001</b> or <b>3x Card Name</b>). The current cards in this slot are replaced (Undo brings them back).</div><textarea id="db-io" aria-label="Deck list to import" class="lib-area" spellcheck="false"></textarea><div class="vc" id="db-fmt" aria-live="polite"></div>', buttons: [{ label: 'Import', cls: 'primary', value: 'ok' }, { label: 'Cancel', cls: 'cancel', value: null }] });
  const ta = $('db-io'); if (ta) ta.addEventListener('input', () => { const f = $('db-fmt'); if (f) f.textContent = dbDetect(ta.value); });
  const v = await p;
  if (v !== 'ok') return;
  const r = textToDeck(dbShareResolve(DB_IO));
  if (!deckTotal(r.deck)) { uiInfo('Nothing imported', 'No cards recognised.' + (r.bad.length ? '<br>' + r.bad.slice(0, 8).map(esc).join('<br>') : '')); return; }
  SLOTS[ACTIVE_SLOT].key = r.key && CARDS[r.key] ? r.key : null;      // the KEY line marks the deck's Key Spirit (v0.103.0)
  dbReplace(r.deck);
  if (r.bad.length) uiInfo('Imported with skipped lines', esc(r.bad.slice(0, 8).join('\n')).replace(/\n/g, '<br>'));
}
async function dbExport(d) {
  d = d || PLAYER_DECK;
  const nm = SLOTS[ACTIVE_SLOT].name || 'Deck', txt = deckToText(d, SLOTS[ACTIVE_SLOT].key), code = dbShareCode(txt);
  try { localStorage.setItem('aeterna.share.' + code, txt); } catch (e) { /* storage blocked: the code still shows */ }
  const tabs = { text: ['Text list', txt], code: ['Deck code', code], image: ['Image', ''], csv: ['CSV', dbCsv(d)] };
  let tab = 'text';
  const body = () => tab === 'image' ? `<img id="db-img" alt="Deck sheet" style="width:100%;max-height:260px;object-fit:contain;background:#0f1218" src="${dbDeckPng(d, nm)}">` : `<textarea id="db-io" aria-label="Deck list" class="lib-area" spellcheck="false" readonly>${esc(tabs[tab][1])}</textarea>`;
  const html = () => `<div class="row db-xtabs" role="tablist" style="gap:8px;flex-wrap:wrap">${Object.keys(tabs).map(k => `<button class="chip${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-x="${k}">${tabs[k][0]}</button>`).join('')}</div><div id="db-xbody" style="margin-top:8px">${body()}</div>`;
  const cfg = { uiOnly: true, title: `Export “${nm}”`, html: html(), buttons: [{ label: 'Copy', cls: 'primary', value: 'copy' }, { label: 'Close', cls: 'cancel', value: null }] };
  const p = modal(cfg);
  const wire = () => dqa('.db-xtabs [data-x]').forEach(b => b.addEventListener('click', () => { tab = /** @type {HTMLElement} */ (b).dataset.x || 'text'; cfg.html = html(); $('modal-card-desc').innerHTML = cfg.html; cfg.buttons[0].label = tab === 'image' ? 'Save PNG' : 'Copy'; const pb = dq('#modal-actions .modal-btn.primary'); if (pb) pb.textContent = cfg.buttons[0].label; wire(); }));
  wire();
  const v = await p;
  if (v === 'copy' && tab === 'image') { const a = document.createElement('a'); a.href = dbDeckPng(d, nm); a.download = nm.replace(/[^\w-]+/g, '_') + '.png'; a.click(); }
  else if (v === 'copy') { try { await navigator.clipboard.writeText(tabs[tab][1]); } catch (e) { /* clipboard blocked: the text stays selectable in the box */ } }
}

/* Share code (mockup DLG.share): AET-XXXX-XXXX-XXXX from the deck list; the list stays on this device until online play exists. */
function dbShareCode(txt) {
  let h = 2166136261, h2 = 5381;
  for (let i = 0; i < txt.length; i++) { h = Math.imul(h ^ txt.charCodeAt(i), 16777619) >>> 0; h2 = (Math.imul(h2, 33) + txt.charCodeAt(i)) >>> 0; }
  const a = (h.toString(36).toUpperCase() + h2.toString(36).toUpperCase() + '000000000000').replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return `AET-${a.slice(0, 4)}-${a.slice(4, 8)}-${a.slice(8, 12)}`;
}
function dbShareResolve(t) {            // a pasted share code gives back the list saved on this device; anything else passes through
  const m = /^\s*AET-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\s*$/i.exec(t || '');
  if (!m) return t;
  try { return localStorage.getItem('aeterna.share.' + m[0].trim().toUpperCase()) || t; } catch (e) { return t; }
}
async function dbShare(d) {
  const txt = deckToText(d, SLOTS[ACTIVE_SLOT].key), code = dbShareCode(txt);
  try { localStorage.setItem('aeterna.share.' + code, txt); } catch (e) { /* storage blocked: the code still shows */ }
  const v = await modal({ uiOnly: true, title: 'Share this deck', html: `<div class="db-share"><div class="db-qr" role="img" aria-label="QR code placeholder"></div><div><div class="db-io-hint">Anyone with the code can copy the deck into their own decks.</div><input id="db-code" aria-label="Deck code" class="lib-area" readonly value="${code}"><div class="db-io-hint">Stays on this device until online play exists.</div></div></div>`, buttons: [{ label: 'Copy code', cls: 'primary', value: 'copy' }, { label: 'Close', cls: 'cancel', value: null }] });
  if (v === 'copy') { try { await navigator.clipboard.writeText(code); } catch (e) { /* clipboard blocked: the code stays selectable */ } uiInfo('Share code', 'Code copied.'); }
}

/* ---------- deck panel (PC column / phone full-height sheet) ---------- */
const DB_COLCH = { red: 'r', purple: 'p', green: 'g', white: 'w', yellow: 'y', blue: 'b' };
function dbRingHTML(n) { const C = 201.06; return `<svg viewBox="0 0 80 80"><circle class="tr" cx="40" cy="40" r="32" fill="none" stroke-width="8"/><circle class="pr" cx="40" cy="40" r="32" fill="none" stroke-width="8" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - Math.min(n, 40) / 40)).toFixed(2)}"/></svg><b><span>${n}<small>of 40</small></span></b>`; }
function dbChips(v) {                 // the validation chips under the deck name (mockup .vchips)
  const n = v.total, parts = Object.keys(PLAYER_DECK).filter(id => PLAYER_DECK[id] && fxMarked(CARDS[id])).length, cols = new Set(Object.keys(PLAYER_DECK).filter(id => PLAYER_DECK[id] && CARDS[id]).flatMap(id => cardColors(CARDS[id]))).size;
  const over = Object.keys(PLAYER_DECK).some(id => PLAYER_DECK[id] > maxCopies(id, FORMAT)), a = [];
  a.push(n >= 40 ? ['', `✓ ${n} cards`] : ['warn', `Add ${40 - n} more`]);
  a.push(over ? ['bad', '! Over the copy limit'] : ['', '✓ Max 3 copies']);
  a.push(SLOTS[ACTIVE_SLOT].key ? ['', '★ Key Spirit set'] : ['warn', '★ Pick a Key Spirit']);
  a.push(v.ok ? ['', `✓ ${fmtName(FORMAT)} legal`] : ['bad', `! ${fmtName(FORMAT)}: ${v.errors.filter(e => !/^Needs at least/.test(e)).length || 1} issue(s)`, errSummary(v)]);
  if (parts) a.push(['warn', `! ${parts} partly implemented`]);
  if (cols > 2) a.push(['warn', `${cols} colours`]);
  return a.map(([c, t, tt]) => `<span class="vc ${c}"${tt ? ` title="${esc(tt)}"` : ''}>${esc(t)}</span>`).join('');
}
function dbStatsHTML(v) {
  const bins = Array(8).fill(0), cols = {}, types = {}; let sum = 0, soul = 0;
  for (const [id, n] of Object.entries(PLAYER_DECK)) {
    const c = CARDS[id]; if (!c || !n) continue;
    bins[Math.min(7, c.cost)] += n; sum += c.cost * n;
    for (const k of cardColors(c)) cols[k] = (cols[k] || 0) + n;
    types[dbTypeOf(c)] = (types[dbTypeOf(c)] || 0) + n;
    if (/soul core/i.test(c.desc || '')) soul += n;
  }
  const mx = Math.max(1, ...bins), tot = v.total || 1, keyC = CARDS[SLOTS[ACTIVE_SLOT].key], ck = DB_COLORS.filter(k => cols[k]);
  const parts = Object.keys(PLAYER_DECK).filter(id => PLAYER_DECK[id] && fxMarked(CARDS[id])).reduce((t, id) => t + PLAYER_DECK[id], 0);
  return `<div class="dgrp"><span>Cost curve</span><b>avg ${(sum / tot).toFixed(1)}</b></div>
    <div class="curve">${bins.map(n => `<div class="cb"><span>${n || ''}</span><i style="height:${Math.round(n / mx * 96)}px"></i></div>`).join('')}</div>
    <div class="curvelbl">${bins.map((_, i) => `<span>${i === 7 ? '7+' : i}</span>`).join('')}</div>
    <div class="dgrp"><span>Colour split</span></div><div class="split">${ck.map(k => `<i style="--c:${colorVar(k)};flex:${cols[k]}" title="${cap(k)} ${cols[k]}"></i>`).join('')}</div>
    <div class="row" style="gap:12px;flex-wrap:wrap;margin-top:6px;font-size:.78em">${ck.map(k => `<span><i class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${colorVar(k)}"></i> ${cap(k)} <b>${cols[k]}</b></span>`).join('')}</div>
    <div class="dgrp"><span>Card types</span></div>
    <div class="kpi" style="grid-template-columns:repeat(${DB_TYPES.length},1fr);gap:6px">${DB_TYPES.map(t => `<div class="card flat" style="padding:8px 10px"><b style="font-size:1.4em">${types[t] || 0}</b><span class="mut" style="font-size:.74em">${t}s</span></div>`).join('')}</div>
    <div class="dgrp"><span>Checks</span></div><div style="display:flex;flex-direction:column;gap:6px;font-size:.84em">
      <span>Soul Core users: <b>${soul}</b></span><span>★ Key Spirit: <b>${keyC ? esc(keyC.name) : 'none'}</b></span><span>! Partly implemented: <b>${parts}</b></span></div>`;
}
function dbRowsHTML() {
  const ids = Object.keys(PLAYER_DECK).filter(id => CARDS[id] && PLAYER_DECK[id]);
  if (!ids.length) return '<div class="db-empty" style="text-align:center;padding:40px 10px;color:var(--text3)"><div style="font-size:40px">🂠</div>The deck is empty.<br>Tap a card to add it.</div>';
  return DB_TYPES.map(t => {
    const g = ids.filter(id => dbTypeOf(CARDS[id]) === t).sort((a, b) => CARDS[a].cost - CARDS[b].cost || DB_COLL.compare(CARDS[a].name, CARDS[b].name));
    if (!g.length) return '';
    const tot = g.reduce((s, id) => s + PLAYER_DECK[id], 0);
    return `<div class="dgrp"><span>${t === 'Nexus' || t === 'Magic' ? t : t + 's'}</span><b>${tot}</b></div>` + g.map(id => {
      const c = CARDS[id], n = PLAYER_DECK[id], bad = legalityOf(id, FORMAT), isKey = SLOTS[ACTIVE_SLOT].key === id, nm = esc(c.name);
      return `<div class="drow${bad ? ' bad' : ''}" data-c="${cardColors(c).length > 1 ? 'x' : DB_COLCH[cardColors(c)[0]] || 'g'}" data-id="${id}"><button class="thumb" data-a="dbinfo" data-v="${id}" aria-label="Card info: ${nm}">${cardFaceHTML(c, false)}</button><span class="k">${c.cost}</span><button class="n" data-a="dbinfo" data-v="${id}" title="${esc(id)}">${nm}${fxMarkHTML(c)}${bad ? ' 🚫' : ''}</button>${c.type === 'Spirit' ? `<button class="st${isKey ? ' on' : ''}" data-a="db-key" data-v="${id}" aria-pressed="${isKey}" aria-label="${isKey ? 'Unmark ' : 'Mark '}${nm} as the deck's Key Spirit" title="${isKey ? 'Draws favour this Spirit: tap to unmark' : 'Mark this Spirit: while no copy is in the Hand or on the Field, draws favour it'}">${isKey ? '★' : '☆'}</button>` : ''}<button class="pm" data-a="db-row" data-v="${id}:-1" aria-label="Remove one ${nm}">−</button><span class="q">${n}</span><button class="pm" data-a="db-row" data-v="${id}:1" aria-label="Add one ${nm}"${dbCanAdd(id) ? '' : ' disabled'}>+</button></div>`;
    }).join('');
  }).join('');
}
function renderDbDeck(v) {
  const ok = v.ok, n = v.total, rg = $('db-ring');
  rg.className = 'ring' + (n === 40 ? ' full' : ''); rg.innerHTML = dbRingHTML(n);
  $('db-status').innerHTML = dbChips(v);
  $('db-dk-list').innerHTML = dbRowsHTML();
  $('db-dk-stats').innerHTML = dbStatsHTML(v);
  const chk = [[v.total >= 40, `${v.total} cards (40 or more)`]].concat(v.errors.filter(e => !/^Needs at least/.test(e)).slice(0, 6).map(e => [false, e]));
  if (v.ok) chk.push([true, `Legal in ${fmtName(FORMAT)}`]);
  $('db-check').innerHTML = chk.map(([k, t]) => `<li class="${k ? 'ok' : 'bad'}">${esc(t)}</li>`).join('');
  $('db-undo').disabled = !DB_UNDO.length; $('db-redo').disabled = !DB_REDO.length;
  $('db-play-now').disabled = !ok;
  const db = $('db-deckbar'); db.className = 'mbar'; db.title = ok ? '' : errSummary(v);
  db.innerHTML = `<div class="ring${n === 40 ? ' full' : ''}">${dbRingHTML(n)}</div><div class="grow"><b>${esc(SLOTS[ACTIVE_SLOT].name)}</b><br><span class="sub">${ok ? 'Ready to play' : n < 40 ? 'Add ' + (40 - n) + ' more cards' : 'Deck not legal'}</span></div><span class="btn pri sm">View deck ▲</span>`;
}
function dbPlayNow() {                // Play: the same gate as the My decks tile
  const v = validateDeck(PLAYER_DECK, null, SLOTS[ACTIVE_SLOT].key);
  if (!v.ok) return uiInfo('Deck not ready', esc(errSummary(v)));
  dbSave(true); dbSheet(''); switchView('view-play');
}
function dbSheet(which) {             // phone: 'deck' opens the deck sheet, '' closes it; 'menu' (the ... button) toggles the deck options
  const vw = $('view-deckbuilder'), b = $('bld');
  if (which === 'menu') { const o = !b.classList.contains('dopen'); b.classList.toggle('dopen', o); vw.classList.toggle('db-open-menu', o); $('db-menu-btn').setAttribute('aria-expanded', String(o)); return; }
  if (which === 'size') {                // phone deck sheet: normal -> maximized -> minimized (header only) -> normal (owner review 2026-10-27)
    const next = { '': 'max', max: 'min', min: '' }[b.dataset.size || ''] || '', btn = $('db-size-btn');
    b.dataset.size = next; vw.dataset.dsize = next;
    btn.textContent = { '': '⤢', max: '▾', min: '▴' }[next]; btn.setAttribute('aria-label', { '': 'Maximize the deck panel', max: 'Minimize the deck panel', min: 'Restore the deck panel' }[next]);
    return;
  }
  b.classList.remove('dopen'); vw.classList.remove('db-open-menu'); $('db-menu-btn').setAttribute('aria-expanded', 'false');
  b.classList.toggle('sheet', which === 'deck'); vw.classList.toggle('db-open-deck', which === 'deck');
}

function renderDeckBuilder() {
  $('db-card-list').style.setProperty('--cols', String(DB_SIZES[DB_SIZE]));
  const v = validateDeck(PLAYER_DECK, null, SLOTS[ACTIVE_SLOT].key);
  const fb = $('db-format'); if (fb) fb.textContent = fmtButton(FORMAT);
  const ds = $('db-slot');
  if (ds) {
    ds.innerHTML = SLOTS.map((sl, i) => `<option value="${i}"${i === ACTIVE_SLOT ? ' selected' : ''}>${i + 1}. ${esc(sl.name)} (${deckTotal(i === ACTIVE_SLOT ? PLAYER_DECK : sl.cards)})</option>`).join('');
    if (document.activeElement !== $('db-name')) $('db-name').value = SLOTS[ACTIVE_SLOT].name;
    $('db-preset').innerHTML = '<option value="">Load ready-made…</option>' + prebuiltOrder(FORMAT).map(({ d }) => `<option value="${d.id}">${esc(prebuiltLabel(d))}</option>`).join('');
  }
  dbBar(); renderDbDeck(v); dbTab(DB_TAB);
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
  else if (t.id === 'db-name') dbNameInput(t.value);
});
