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
let LORE_FS = 1;
function renderLore() {
  const sel = $('lib-lore-set'), out = $('lib-lore'); if (!sel || !out) return;
  const series = loreSeries();
  if (!series.length) { out.innerHTML = '<p class="empty-note">No flavor texts in this build.</p>'; sel.innerHTML = ''; $('lib-lore-nav').innerHTML = ''; return; }
  if (!series.some(s => s[0] === LORE_SET)) LORE_SET = series[0][0];
  sel.innerHTML = series.map(([k, ids]) => `<option value="${esc(k)}">${esc(k)} (${ids.length})</option>`).join(''); sel.value = LORE_SET;
  const at = series.findIndex(s => s[0] === LORE_SET), ids = series[at][1];
  $('lib-lore-nav').innerHTML = series.map(([k, l]) => `<button class="${k === LORE_SET ? 'on' : ''}" data-a="lib-lore-set" data-v="${esc(k)}" aria-pressed="${k === LORE_SET}"><b>${esc(k)}</b><span>${l.length} texts</span></button>`).join('');
  $('lib-lore-h').textContent = `Series ${LORE_SET}`; $('lib-lore-sub').textContent = `${ids.length} flavor texts · series ${at + 1} of ${series.length}`;
  $('lib-lore-bar').style.width = `${Math.round(100 * (at + 1) / series.length)}%`;
  $('lib-lore-prev').disabled = at === 0; $('lib-lore-next').disabled = at === series.length - 1;
  $('lib-lore-fs').innerHTML = [[0.9, 'A−'], [1, 'A'], [1.15, 'A+']].map(([v, l]) => `<button data-a="lib-lore-fs" data-v="${v}" aria-pressed="${LORE_FS === v}">${l}</button>`).join('');
  out.style.fontSize = `${LORE_FS}em`;
  out.innerHTML = ids.map(id => `<article class="lore-item" data-a="zoom" data-v="${esc(id)}" style="--lc:${colorVar(CARDS[id].symbol)}" tabindex="0"><b>${esc(CARDS[id].name)}</b><span class="lore-id" translate="no">${esc(id)}</span><p>“${esc(lore()[id])}”</p></article>`).join('');
}
