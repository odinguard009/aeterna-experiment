/* ---------------------------------------------------------------------
   CARD PANEL (v0.122.0, U14b battle PC; docs/design/mockup-v14.html)
   PC only: a panel left of the board shows the card under the pointer (hand or field), or the last one you pointed at.
   Display only: nothing here touches the rules. Tap the picture for the full card (the zoom).
   --------------------------------------------------------------------- */
let PANEL_ID = null;
function cardPanelHTML() {
  const card = PANEL_ID && CARDS[PANEL_ID];
  const body = card ? `<div class="cp-face" data-a="zoom" data-v="${esc(card.id)}" title="Tap to enlarge">${cardFaceHTML(card, true)}</div><div class="cp-info">${cardDetailHTML(card, true)}</div>`
    : '<div class="cp-ph" aria-hidden="true"></div><div class="cp-hint">Hover Or Tap A Card To Read It Here.</div>';
  const lines = G ? G.history.slice(-3) : [];      // v0.152.0: the last three log lines at the bottom of the panel (mockup)
  const log = lines.length ? `<div class="cp-log"><div class="cp-lh">Log</div>${lines.map(t => `<div>${esc(t)}</div>`).join('')}</div>` : '';
  return `<aside id="card-panel" aria-label="Card panel"><span class="cp-title">Card Panel</span>${body}${log}</aside>`;
}
/** @param {HTMLElement} el */
function panelCardOf(el) {
  const a = el.dataset.a, v = el.dataset.v || '';
  if (!G) return null;
  if (a === 'hand') { const i = G.p.player.hand.find(x => String(x.uid) === v); return i ? i.id : null; }
  const uid = v.split(':')[2], f = fieldList(G.p.player).concat(fieldList(G.p.opponent)).find(x => String(x.uid) === uid);
  return f ? f.id : null;
}
if (typeof document !== 'undefined') document.addEventListener('mouseover', e => {
  const t = /** @type {HTMLElement|null} */ ((/** @type {HTMLElement} */ (e.target)).closest('#view-playmat [data-a="hand"], #view-playmat [data-a="field"]')), p = $('card-panel');
  if (!t || !p) return;
  const id = panelCardOf(t); if (!id || id === PANEL_ID) return;
  PANEL_ID = id; p.outerHTML = cardPanelHTML();
});
