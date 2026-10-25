/* ---------------------------------------------------------------------
   LORE (v0.131.0, U14g; docs/design/mockup-v14.html): the English flavor texts of the cards, read in order by series.
   The index { card id: text } is data (data/index/flavor.json, written by tools/fetch_flavor.py) and rides in the page as a
   compressed blob; this part only reads it. Display only: nothing here touches the rules.
   --------------------------------------------------------------------- */
/*FLAVOR_START*//*FLAVOR_END*/
let LORE_SET = '', LORE_DATA = null;
const lore = () => LORE_DATA || (LORE_DATA = (typeof BUILTIN_FLAVOR === 'string' && BUILTIN_FLAVOR) ? loadFlavor(BUILTIN_FLAVOR) : {});   // decoded on first use (the Library page), not at load
function loreSeries() {                              // { set prefix: [card ids with a flavor text] } in series order
  const m = {};
  const L = lore(); for (const id of Object.keys(L)) if (CARDS[id]) (m[id.split('-')[0]] = m[id.split('-')[0]] || []).push(id);
  const keys = Object.keys(m).sort(DB_COLL.compare);
  return keys.map(k => [k, m[k].sort(DB_COLL.compare)]);
}
function renderLore() {
  const sel = $('lib-lore-set'), out = $('lib-lore'); if (!sel || !out) return;
  const series = loreSeries();
  if (!series.length) { out.innerHTML = '<p class="empty-note">No flavor texts in this build.</p>'; sel.innerHTML = ''; return; }
  if (!series.some(s => s[0] === LORE_SET)) LORE_SET = series[0][0];
  sel.innerHTML = series.map(([k, ids]) => `<option value="${esc(k)}">${esc(k)} (${ids.length})</option>`).join(''); sel.value = LORE_SET;
  const ids = (series.find(s => s[0] === LORE_SET) || [LORE_SET, []])[1];
  out.innerHTML = ids.map(id => `<article class="lore-item" data-a="zoom" data-v="${esc(id)}" style="--lc:${colorVar(CARDS[id].symbol)}" tabindex="0"><b>${esc(CARDS[id].name)}</b><span class="lore-id" translate="no">${esc(id)}</span><p>“${esc(lore()[id])}”</p></article>`).join('');
}
