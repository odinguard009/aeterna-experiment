/* ---------------------------------------------------------------------
   LORE (v0.131.0, U14g; docs/design/mockup-v14.html): the English flavor texts of the cards, read in order by series.
   The index { card id: text } is data (data/index/flavor.json, written by tools/fetch_flavor.py) and rides in the page as a
   compressed blob; this part only reads it. Display only: nothing here touches the rules.
   --------------------------------------------------------------------- */
/*FLAVOR_START*//*FLAVOR_END*/
let LORE_SET = '', LORE_DATA = null;
const lore = () => LORE_DATA || (LORE_DATA = (typeof BUILTIN_FLAVOR === 'string' && BUILTIN_FLAVOR) ? loadFlavor(BUILTIN_FLAVOR) : {});   // decoded on first use (the Library page), not at load
/* Saga reading order (owner review 2026-10-27; docs/saga-map.md, from the VASSAL asset folder): a set code belongs to one of the 17 Sagas.
   Story arcs inside a Saga are NOT listed yet (no source could be opened, see roadmap-open item U); every new card brings a new flavor text, so this index grows with each card release. */
const SAGA_NAMES = ['Booster Set Saga', 'Constellation Saga', 'Heroes Saga', 'Sword Blade Saga', 'Ultimate Saga', 'Burning Legend Saga', 'God King Saga', 'Advent Saga', 'God Advent Saga', 'Ultra Advent Saga', 'Rebirth Saga', 'True Rebirth Saga', 'Contract Saga', 'Contract Saga: Realm Era', 'Contract Saga: True', 'Contract Saga: Cycle', 'Contract Saga: Proof'];
const SAGA_EXTRA = [[1, 'SD', [1, 2]], [2, 'BSC', [5]], [2, 'SD', [3]], [3, 'SD', [6]], [4, 'SD', [10, 17]], [5, 'BSC', [15, 19]], [5, 'SD', [19, 28]], [6, 'BSC', [20, 24]], [6, 'SD', [29, 32]], [7, 'BSC', [25, 29]], [7, 'SD', [33, 36]], [8, 'BSC', [30, 31]], [8, 'CB', [1, 4]], [8, 'SD', [37, 42]], [9, 'BSC', [32, 33]], [9, 'CB', [5, 8]], [9, 'SD', [43, 47]], [10, 'BSC', [34, 35]], [10, 'CB', [9, 12]], [10, 'SD', [48, 51]], [11, 'BSC', [36, 37]], [11, 'CB', [13, 17]], [11, 'SD', [55, 58]], [12, 'BSC', [38, 39]], [12, 'CB', [18, 22]], [12, 'SD', [59, 63]], [13, 'BSC', [40]], [13, 'CB', [23, 27]], [13, 'SD', [64, 65]], [14, 'BSC', [41, 42]], [14, 'CB', [28, 30]], [14, 'SD', [66, 67]], [15, 'BSC', [43, 46]], [15, 'CB', [31, 34]], [15, 'SD', [68, 70]], [16, 'BSC', [47, 51]]];
const BS_SAGA_END = [9, 13, 18, 23, 30, 34, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 76];       // last main set of each Saga (BS01-BS09 = Saga 1, ...)
function sagaOf(set) {                               // 1..17, or 0 when the set is not in the map (promos, tokens, training cards)
  let m = /^BS(\d+)$/.exec(set); if (m) { const n = +m[1]; const i = BS_SAGA_END.findIndex(e => n <= e); return i < 0 ? 0 : i + 1; }
  if (/^26R/.test(set)) return 17;
  m = /^(SD|BSC|CB)(\d+)$/.exec(set); if (m) { const n = +m[2], r = SAGA_EXTRA.find(x => x[1] === m[1] && n >= x[2][0] && n <= (x[2][1] || x[2][0])); return r ? r[0] : 0; }
  return 0;
}
let LORE_BY = 'series';                              // 'series' (one set at a time) or 'saga' (the 17 Sagas)
const loreKeyOf = id => { const set = id.split('-')[0]; if (LORE_BY === 'series') return set; const g = sagaOf(set); return g ? 'Saga ' + String(g).padStart(2, '0') : 'Other'; };
function loreSeries() {                              // [[key, [card ids with a flavor text]]] in reading order
  const m = {};
  const L = lore(); for (const id of Object.keys(L)) if (CARDS[id]) (m[loreKeyOf(id)] = m[loreKeyOf(id)] || []).push(id);
  const keys = Object.keys(m).sort(LORE_BY === 'saga' ? (a, b) => Number(a === 'Other') - Number(b === 'Other') || a.localeCompare(b) : DB_COLL.compare);
  return keys.map(k => [k, m[k].sort(DB_COLL.compare)]);
}
const loreTitle = k => LORE_BY === 'saga' ? (/^Saga (\d+)$/.exec(k) ? SAGA_NAMES[+(/^Saga (\d+)$/.exec(k) || [])[1] - 1] || k : 'Other (promos and extras)') : 'Series ' + k;
let LORE_FS = 1;
function renderLore() {
  const sel = $('lib-lore-set'), out = $('lib-lore'); if (!sel || !out) return;
  const series = loreSeries();
  if (!series.length) { out.innerHTML = '<p class="empty-note">No flavor texts in this build.</p>'; sel.innerHTML = ''; $('lib-lore-nav').innerHTML = ''; return; }
  if (!series.some(s => s[0] === LORE_SET)) LORE_SET = series[0][0];
  sel.innerHTML = series.map(([k, ids]) => `<option value="${esc(k)}">${esc(k)} (${ids.length})</option>`).join(''); sel.value = LORE_SET;
  const at = series.findIndex(s => s[0] === LORE_SET), ids = series[at][1];
  $('lib-lore-nav').innerHTML = series.map(([k, l]) => `<button class="${k === LORE_SET ? 'on' : ''}" data-a="lib-lore-set" data-v="${esc(k)}" aria-pressed="${k === LORE_SET}"><b>${esc(k)}${LORE_BY === 'saga' && /^Saga/.test(k) ? ' <em>' + esc(loreTitle(k).replace(/^Saga \d+\s*[·:-]?\s*/, '')) + '</em>' : ''}</b><span>${l.length} texts</span></button>`).join('');
  $('lib-lore-h').textContent = loreTitle(LORE_SET); $('lib-lore-sub').textContent = `${ids.length} flavor texts · ${LORE_BY === 'saga' ? 'saga' : 'series'} ${at + 1} of ${series.length}`;
  $('lib-lore-by').innerHTML = [['series', 'By series'], ['saga', 'By Saga']].map(([v, l]) => `<button data-a="lib-lore-by" data-v="${v}" aria-pressed="${LORE_BY === v}">${l}</button>`).join(''); $('lib-lore-ord').textContent = LORE_BY === 'saga' ? 'Sagas In Reading Order' : 'Series In Reading Order';
  $('lib-lore-bar').style.width = `${Math.round(100 * (at + 1) / series.length)}%`;
  $('lib-lore-prev').disabled = at === 0; $('lib-lore-next').disabled = at === series.length - 1;
  $('lib-lore-fs').innerHTML = [[0.9, 'A−'], [1, 'A'], [1.15, 'A+']].map(([v, l]) => `<button data-a="lib-lore-fs" data-v="${v}" aria-pressed="${LORE_FS === v}">${l}</button>`).join('');
  out.style.fontSize = `${LORE_FS}em`;
  out.innerHTML = ids.map(id => `<article class="lore-item" data-a="zoom" data-v="${esc(id)}" style="--lc:${colorVar(CARDS[id].symbol)}" tabindex="0"><b>${esc(CARDS[id].name)}</b><span class="lore-id" translate="no">${esc(id)}</span><p>“${esc(lore()[id])}”</p></article>`).join('');
}
