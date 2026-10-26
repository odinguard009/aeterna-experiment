/* ---------------------------------------------------------------------
   v0.93.0 U6 MY DECKS (docs/DESIGN.md section 0, mockup docs/design/mockup-v11.html "My decks PC / phone")
   A page on top of the 8 deck slots of packages/engine/src/04-decks.js: PC tiles / phone rows with sleeve, colours, status and
   the ACTIVE badge; Edit, Play (disabled while the deck is not ready) and a more menu (PC) / action sheet (phone): Set active,
   Rename, Duplicate, Deck look, Copy deck code, Delete (asks first). Import code and New deck use the first free slot; the
   prebuilt decks are read-only starters with Copy. A slot is listed when it has cards, a name of its own, the used mark
   (New / Import / Copy) or is the active slot.
   --------------------------------------------------------------------- */
let DK_MENU = -1, DK_Q = '', DK_SORT = 'slot';                                   // slot whose more menu / action sheet is open
const dkCards = i => (i === ACTIVE_SLOT ? PLAYER_DECK : SLOTS[i].cards);
const dkUsed = i => i === ACTIVE_SLOT || !!SLOTS[i].used || deckTotal(dkCards(i)) > 0 || !/^Deck \d+$/.test(SLOTS[i].name);
const dkFree = () => SLOTS.findIndex((s, i) => !dkUsed(i));
function dkStatus(cards, key) {
  const t = deckTotal(cards), v = validateDeck(cards, FORMAT, key);
  if (v.ok) return { ok: true, txt: `${t} cards · Ready` };
  if (t < 40) return { ok: false, txt: `${t} / 40 · add ${40 - t} card${40 - t === 1 ? '' : 's'}` };
  return { ok: false, txt: 'Not ready: ' + errSummary(v) };
}
function dkColors(cards) {                          // the deck's colours, most cards first (at most 3)
  const n = {};
  for (const [id, k] of Object.entries(cards)) { const c = CARDS[id]; if (c && k) for (const col of cardColors(c)) if (COLORS.includes(col)) n[col] = (n[col] || 0) + k; }
  return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 3);
}
function dkFan(cards) {                              // PC tile art: the deck's three most-played cards, fanned (mockup-v14 .stack)
  const top = Object.keys(cards).filter(id => CARDS[id] && cards[id]).sort((a, b) => cards[b] - cards[a]).slice(0, 3);
  return `<div class="dk-fan" aria-hidden="true">${top.map(id => `<div class="dk-fc">${cardFaceHTML(CARDS[id], false)}</div>`).join('')}</div>`;
}
function dkTile(i, name, cards, starter) {
  const key = starter ? ((PREBUILT[i] || {}).key || null) : (SLOTS[i] && SLOTS[i].key || null);
  const st = dkStatus(cards, key), act = !starter && i === ACTIVE_SLOT, open = !starter && DK_MENU === i, nm = esc(name), kb = key && CARDS[key] ? '<span class="dk-key" title="Key Spirit: draws favour it">KEY</span>' : '';
  const dots = dkColors(cards).map(c => `<i class="dk-dot" style="--c:${colorVar(c)}" title="${cap(c)}"></i>`).join('');
  const item = (a, l, cls) => `<button class="${cls || ''}" role="menuitem" data-a="${a}" data-v="${i}">${l}</button>`;
  const menu = open ? `<div class="dk-menu" role="menu" aria-label="${nm}"><div class="dk-mh">${nm}</div>${item('dk-edit', 'Edit cards')}${item('dk-play', 'Play with this deck')}${act ? '' : item('dk-active', 'Set active')}${item('dk-rename', 'Rename…')}${item('dk-dup', 'Duplicate')}${item('dk-look', 'Deck look')}${item('dk-code', 'Copy deck code')}${item('dk-del', 'Delete…', 'del')}<button class="dk-x" data-a="dk-more" data-v="-1">Cancel</button></div>` : '';
  const btns = starter ? `<button class="ae-ghost primary" data-a="dk-copy" data-v="${i}" aria-label="Copy ${nm} to my decks">COPY</button>`
    : `<button class="ae-ghost" data-a="dk-edit" data-v="${i}" aria-label="Edit ${nm}">EDIT</button><button class="ae-ghost primary" data-a="dk-play" data-v="${i}" aria-label="Play with ${nm}"${st.ok ? '' : ' disabled'}>PLAY</button><button class="dk-more" data-a="dk-more" data-v="${i}" aria-label="More actions for ${nm}" aria-haspopup="menu" aria-expanded="${open}">⋯</button>`;
  return `<article class="dk-tile${starter ? ' st' : ''}${act ? ' on' : ''}${open ? ' open' : ''}" data-v="${i}">${dkFan(cards)}<span class="sleeve dk-sl" style="--sl-tint:${SLEEVE_TINTS[starter ? 'silver' : deckLook(i).sleeve]}" aria-hidden="true"></span><div class="dk-main"><div class="dk-top"><b class="dk-name" title="${nm}">${nm}</b>${kb}${act ? '<span class="dk-act">Active</span>' : ''}</div><div class="dk-dots">${dots}</div><div class="dk-st ${st.ok ? 'ok' : 'bad'}">${esc(st.txt)}</div></div><div class="dk-btns">${btns}</div>${menu}</article>`;
}
function renderDecks() {
  if (!$('dk-list')) return;
  applyLook();
  const used = SLOTS.map((s, i) => i).filter(dkUsed);
  $('dk-count').textContent = `${used.length} / ${SLOTS.length}`;
  const q = DK_Q.trim().toLowerCase(), shown = used.filter(i => !q || SLOTS[i].name.toLowerCase().includes(q));
  if (DK_SORT === 'name') shown.sort((a, b) => SLOTS[a].name.localeCompare(SLOTS[b].name));
  else if (DK_SORT === 'cards') shown.sort((a, b) => deckTotal(dkCards(b)) - deckTotal(dkCards(a)));
  $('dk-list').innerHTML = shown.map(i => dkTile(i, SLOTS[i].name, dkCards(i))).join('') + (!q && dkFree() >= 0 ? '<button class="dk-add" data-a="dk-new"><span>+</span><b>New Deck</b><i>Blank, from a starter, or import</i></button>' : '');
  if ($('dk-sub')) $('dk-sub').textContent = `${used.includes(ACTIVE_SLOT) ? 1 : 0} active`;
  $('dk-starters').innerHTML = prebuiltOrder(FORMAT).map(({ d, i }) => dkTile(i, prebuiltLabel(d), d.cards, true)).join('');
  $('dk-fmt').textContent = fmtTitle();
}
function dkMenu(i) {
  DK_MENU = DK_MENU === i ? -1 : i; renderDecks();
  const m = document.querySelector('#dk-list .dk-menu'); if (!m) return;
  if (m.scrollIntoView && getComputedStyle(m).position !== 'fixed') m.scrollIntoView({ block: 'nearest' });   // PC: the last tile's menu stays on screen
  const f = m.querySelector('button'); if (f) f.focus({ preventScroll: true });
}
function dkNewSlot(name, cards, keep, key) {        // the first free slot (made active unless keep); false when all 8 are in use
  const i = dkFree();
  if (i < 0) { uiInfo('No free deck slot', `All ${SLOTS.length} deck slots are in use. Delete a deck first.`); return false; }
  const sl = { name: (name || SLOTS[i].name).slice(0, 24), cards: cleanDeck(cards || {}), used: true };
  const k = keyOfDeck(sl.cards, key); if (k) sl.key = k;   // copied starters / duplicates bring their Key Spirit (v0.103.0)
  if (keep) { SLOTS[i] = sl; saveDeck(); return true; }
  switchSlot(i); SLOTS[i] = sl; PLAYER_DECK = Object.assign({}, sl.cards); saveDeck();
  return true;
}
async function dkAct(a, v) {
  const i = Number(v); if (a !== 'dk-more') DK_MENU = -1;
  if (a === 'dk-more') return dkMenu(i);
  if (a === 'dk-new') { if (dkNewSlot()) switchView('view-deckbuilder'); return; }
  if (a === 'dk-import') {
    const back = ACTIVE_SLOT; if (!dkNewSlot()) return;
    await dbImport();
    if (!deckTotal(PLAYER_DECK)) { SLOTS[ACTIVE_SLOT].used = false; switchSlot(back); }
    return renderDecks();
  }
  if (a === 'dk-copy') { const d = PREBUILT[i]; if (d) dkNewSlot(d.name, d.cards, true, d.key); return renderDecks(); }
  if (!(i >= 0 && i < SLOTS.length)) return renderDecks();
  if (a === 'dk-edit' || a === 'dk-look') { switchSlot(i); return switchView('view-deckbuilder'); }   // Deck look: the builder's Look tab comes with U7
  if (a === 'dk-play') { if (!dkStatus(dkCards(i), SLOTS[i] && SLOTS[i].key).ok) return; switchSlot(i); return switchView('view-play'); }
  if (a === 'dk-active') { switchSlot(i); renderHome(); return renderDecks(); }
  if (a === 'dk-dup') { dkNewSlot(SLOTS[i].name.slice(0, 17) + ' (copy)', Object.assign({}, dkCards(i)), true, SLOTS[i].key); return renderDecks(); }
  if (a === 'dk-code') { try { await navigator.clipboard.writeText(deckToText(dkCards(i), SLOTS[i].key)); $('dk-msg').textContent = `Deck code of ${SLOTS[i].name} copied. Paste it into Import code on any device.`; } catch (e) { dbExport(dkCards(i)); } return renderDecks(); }
  if (a === 'dk-rename') {
    const ok = await modal({ uiOnly: true, title: 'Rename deck', html: `<input id="dk-name-in" class="dk-in" maxlength="24" autocomplete="off" aria-label="Deck name" value="${esc(SLOTS[i].name)}">`, buttons: [{ label: 'Save', cls: 'primary', value: 1 }, { label: 'Cancel', cls: 'cancel', value: null }] });
    const nv = ($('dk-name-in') || {}).value || '';
    if (ok && nv.trim()) { SLOTS[i].name = nv.trim().slice(0, 24); SLOTS[i].used = true; saveDeck(); renderHome(); }
    return renderDecks();
  }
  if (a === 'dk-del') {
    const ok = await modal({ uiOnly: true, title: 'Delete this deck?', html: `<b>${esc(SLOTS[i].name)}</b> (${deckTotal(dkCards(i))} cards) is removed from this device. This cannot be undone.`, buttons: [{ label: 'Delete', cls: 'danger', value: 1 }, { label: 'Cancel', cls: 'cancel', value: null }] });
    if (ok) {
      SLOTS[i] = { name: 'Deck ' + (i + 1), cards: {} };
      if (i === ACTIVE_SLOT) { PLAYER_DECK = {}; const o = SLOTS.findIndex((s, k) => k !== i && dkUsed(k)); if (o >= 0) switchSlot(o); else saveDeck(); } else saveDeck();
      renderHome();
    }
    return renderDecks();
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('input', e => { const t = /** @type {HTMLInputElement} */ (evT(e)); if (t.id === 'dk-q') { DK_Q = t.value; renderDecks(); const q = /** @type {HTMLInputElement} */ ($('dk-q')); if (q) { q.focus({ preventScroll: true }); q.setSelectionRange(DK_Q.length, DK_Q.length); } } });
  document.addEventListener('change', e => { const t = /** @type {HTMLSelectElement} */ (evT(e)); if (t.id === 'dk-sort') { DK_SORT = t.value; renderDecks(); } });
  document.addEventListener('keydown', e => {   // Rename: Enter saves; Escape closes the Rename / Delete dialogs (not engine decisions)
    if (MODAL && /^(Rename deck|Delete this deck\?)$/.test(MODAL.cfg.title)) { if (e.key === 'Escape') closeModal(null); else if (e.key === 'Enter' && evT(e).id === 'dk-name-in') modalPress(0); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && DK_MENU >= 0) { const i = DK_MENU; DK_MENU = -1; renderDecks(); const b = dq(`#dk-list [data-a="dk-more"][data-v="${i}"]`); if (b) b.focus(); } });
  document.addEventListener('click', e => { if (DK_MENU >= 0 && !evC(e, '.dk-menu, [data-a="dk-more"]')) { DK_MENU = -1; renderDecks(); } });
}
