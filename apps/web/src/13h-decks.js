/* ---------------------------------------------------------------------
   v0.93.0 U6 MY DECKS (docs/DESIGN.md section 0, mockup docs/design/mockup-v11.html "My decks PC / phone")
   A page on top of the 8 deck slots of packages/engine/src/04-decks.js: PC tiles / phone rows with sleeve, colours, status and
   the ACTIVE badge; Edit, Play (disabled while the deck is not ready) and a more menu (PC) / action sheet (phone): Set active,
   Rename, Duplicate, Deck look, Copy deck code, Delete (asks first). Import code and New deck use the first free slot.
   The read-only ready-made decks are two lists (v0.201.0): STARTER DECKS (the ten official 26RSD starters) and OFFICIAL READY
   DECKS (the deck-feature recipes of the Standard sets); both have Recipe (full list + source link) and Copy. A slot is listed
   when it has cards, a name of its own or the used mark (New / Import / Copy); a wiped slot is not listed even while active.
   --------------------------------------------------------------------- */
let DK_MENU = -1, DK_Q = '', DK_SORT = 'slot';                                   // slot whose more menu / action sheet is open
const dkCards = i => (i === ACTIVE_SLOT ? PLAYER_DECK : SLOTS[i].cards);
function dkUsed(i) { return !!SLOTS[i].used || deckTotal(dkCards(i)) > 0 || !/^Deck \d+$/.test(SLOTS[i].name); }   // v0.201.0 fix: a wiped slot is no longer listed just because it is the active one (Delete left the deck on screen)
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
/* Deck cover (owner review 2026-10-30): the deck's key card is the front of its cover. Order of preference: the marked Key Spirit, then a
   Grandwalker / Contract Nexus (Grandwalker family, a "...Contractor" name or a CX Nexus), then the most-played card. The two other cover
   cards follow the same order. Display only. */
const dkKeyNexus = id => { const c = CARDS[id]; return !!c && c.type === 'Nexus' && ((c.families || []).includes('Grandwalker') || /Contractor/.test(c.name) || /-CX\d+$/.test(id)); };
function dkCover(cards, key) {                       // up to 3 card ids, the key card first
  const have = Object.keys(cards).filter(id => CARDS[id] && cards[id] > 0);
  const rank = id => (key && id === key ? 0 : dkKeyNexus(id) ? 1 : 2);
  return have.sort((a, b) => rank(a) - rank(b) || cards[b] - cards[a] || DB_COLL.compare(a, b)).slice(0, 3);
}
function dkFan(cards, key) {                         // tile art: the cover cards, fanned (mockup .stack); the key card is the middle, front one
  const top = dkCover(cards, key), kid = top[0]; if (top.length === 3) top.splice(1, 0, top.shift());   // key card to the middle slot
  return `<div class="stack" aria-hidden="true">${top.map(id => `<div class="cf${id === kid ? ' key' : ''}">${cardFaceHTML(CARDS[id], false)}</div>`).join('')}</div>`;
}
function dkStats(name) {                             // win rate and last played from the match history, matched by deck name
  const h = HISTORY.filter(m => m.you === name);
  if (!h.length) return { wr: null, last: 0, n: 0 };
  return { wr: Math.round(100 * h.filter(m => m.won).length / h.length), last: h[h.length - 1].t || 0, n: h.length };
}
function dkAgo(t) {
  if (!t) return '—';
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : 'Long ago';
}
function dkTile(i, name, cards, starter) {
  const key = starter ? ((PREBUILT[i] || {}).key || null) : (SLOTS[i] && SLOTS[i].key || null);
  const st = dkStatus(cards, key), act = !starter && i === ACTIVE_SLOT, open = !starter && DK_MENU === i, nm = esc(name), kb = key && CARDS[key] ? '<span class="tag dim" title="Key Spirit: draws favour it">Key</span>' : '';
  const dots = dkColors(cards).map(c => `<i class="dot" style="display:inline-block;width:11px;height:11px;background:${colorVar(c)};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)" title="${cap(c)}"></i>`).join('');
  const item = (a, l, cls) => `<button class="opt ${cls || ''}" role="menuitem" data-a="${a}" data-v="${i}"><b>${l}</b></button>`;
  const menu = open ? `<div class="dk-menu" role="menu" aria-label="${nm}"><div class="dk-mh">${nm}</div>${item('dk-edit', 'Edit cards')}${item('dk-play', 'Play with this deck')}${act ? '' : item('dk-active', 'Set active')}${item('dk-rename', 'Rename…')}${item('dk-dup', 'Duplicate')}${item('dk-look', 'Deck look')}${item('dk-code', 'Copy deck code')}${item('dk-del', 'Delete…', 'del')}<button class="btn sm dk-x" data-a="dk-more" data-v="-1">Cancel</button></div>` : '';
  const ds = starter ? null : dkStats(name);
  const stat = `<div class="stat"><span>${deckTotal(cards)}/40 cards</span>${ds ? `<span>${ds.wr == null ? 'No matches' : 'Win ' + ds.wr + '%'}</span><span>${dkAgo(ds.last)}</span>` : ''}</div>`;
  const btns = starter ? `<div class="row dk-st-btns" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-a="dk-recipe" data-v="${i}" aria-label="View the recipe of ${nm}">Recipe</button><button class="btn sm grow" data-a="dk-copy" data-v="${i}" aria-label="Copy ${nm} to my decks">Copy</button></div>`
    : `<button class="btn sm grow" data-a="dk-edit" data-v="${i}" aria-label="Edit ${nm}">Edit</button><button class="btn sm pri grow" data-a="dk-play" data-v="${i}" aria-label="Play with ${nm}"${st.ok ? '' : ' disabled'}>Play</button><button class="ibtn sq dk-more" data-a="dk-more" data-v="${i}" aria-label="More actions for ${nm}" aria-haspopup="menu" aria-expanded="${open}">⋯</button>`;
  if (starter) { const kc = dkCover(cards, key)[0];   // the thumbnail is the Key Spirit (else the most played card)
    return `<div class="card flat dk-st-row" data-v="${i}"><div class="dk-st-th">${kc ? cardFaceHTML(CARDS[kc], false) : ''}</div><div class="dk-st-nm"><b>${nm}</b> ${kb}<span class="dk-st-sub">${esc(st.ok ? st.txt : deckTotal(cards) + ' cards')}</span></div>${btns}</div>`; }
  return `<div class="card dtile${act ? ' on' : ''}${open ? ' open' : ''}" data-v="${i}">${dkFan(cards, key)}<div class="row"><b class="grow" style="font-size:1.02em" title="${nm}">${nm}</b>${kb}${act ? '<span class="tag">Active</span>' : ''}</div><div class="row" style="gap:6px">${dots}<span class="grow"></span><span class="${st.ok ? 'vc' : 'vc warn'}">${st.ok ? '✓ Legal' : deckTotal(cards) < 40 ? 'Needs ' + (40 - deckTotal(cards)) + ' more' : 'Not legal'}</span></div>${stat}<div class="row" style="gap:6px">${btns}</div>${menu}</div>`;
}
function renderDecks() {
  if (!$('dk-list')) return;
  applyLook();
  const used = SLOTS.map((s, i) => i).filter(dkUsed);
  $('dk-count').textContent = `${used.length} / ${SLOTS.length}`;
  const q = DK_Q.trim().toLowerCase(), shown = used.filter(i => !q || SLOTS[i].name.toLowerCase().includes(q));
  const sk = i => dkStats(SLOTS[i].name);
  if (DK_SORT === 'name') shown.sort((a, b) => SLOTS[a].name.localeCompare(SLOTS[b].name));
  else if (DK_SORT === 'cards') shown.sort((a, b) => deckTotal(dkCards(b)) - deckTotal(dkCards(a)));
  else if (DK_SORT === 'played') shown.sort((a, b) => sk(b).last - sk(a).last);
  else if (DK_SORT === 'wr') shown.sort((a, b) => (sk(b).wr == null ? -1 : sk(b).wr) - (sk(a).wr == null ? -1 : sk(a).wr));
  $('dk-list').innerHTML = shown.map(i => dkTile(i, SLOTS[i].name, dkCards(i))).join('') + (!q && dkFree() >= 0 ? '<button class="card flat dtile dk-add" data-a="dk-new" style="border:2px dashed var(--line2);align-items:center;justify-content:center;min-height:250px;color:var(--text2);background:transparent"><span style="font-size:42px">+</span><b>New deck</b><span class="sub" style="font-size:.8em">Blank, from a starter, or import</span></button>' : '');
  if ($('dk-sub')) $('dk-sub').textContent = `${used.includes(ACTIVE_SLOT) ? 1 : 0} active`;
  const rows = kind => prebuiltOrder(FORMAT).filter(({ d }) => (d.kind || 'starter') === kind).map(({ d, i }) => dkTile(i, prebuiltLabel(d), d.cards, true)).join('');
  $('dk-starters').innerHTML = rows('starter');
  if ($('dk-ready')) $('dk-ready').innerHTML = rows('ready');
  if ($('dk-ready-sec')) $('dk-ready-sec').style.display = rows('ready') ? '' : 'none';
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
  if (a === 'dk-new') {                 // mockup New Deck dialog: Blank / From a starter deck / Import a list
    if (dkFree() < 0) { uiInfo('No free deck slot', `All ${SLOTS.length} deck slots are in use. Delete a deck first.`); return; }
    const c = await modal({ uiOnly: true, title: 'New deck', html: 'Start from an empty list, copy one of the starter decks, or paste a deck list.', buttons: [{ label: 'Blank deck', cls: 'primary', value: 'blank' }, { label: 'From a starter deck', value: 'starter' }, { label: 'Import a list', value: 'import' }, { label: 'Cancel', cls: 'cancel', value: null }] });
    if (c === 'blank') { if (dkNewSlot()) switchView('view-deckbuilder'); }
    else if (c === 'import') return dkAct('dk-import', v);
    else if (c === 'starter') {
      const k = await modal({ uiOnly: true, title: 'Choose a starter deck', html: 'The copy is yours to edit; the starter itself stays unchanged.', buttons: /** @type {any[]} */ (PREBUILT.map((d, n) => ({ d, n })).filter(e => !e.d.hidden).map(({ d, n }) => ({ label: d.name, value: 's' + n }))).concat([{ label: 'Cancel', cls: 'cancel', value: null }]) });
      const d = PREBUILT[Number(String(k).slice(1))]; if (k && d) { if (dkNewSlot(d.name, d.cards, false, d.key)) switchView('view-deckbuilder'); }
    }
    return;
  }
  if (a === 'dk-import') {
    const back = ACTIVE_SLOT; if (!dkNewSlot()) return;
    await dbImport();
    if (!deckTotal(PLAYER_DECK)) { SLOTS[ACTIVE_SLOT].used = false; switchSlot(back); }
    return renderDecks();
  }
  if (a === 'dk-copy') { const d = PREBUILT[i]; if (d) dkNewSlot(d.name, d.cards, true, d.key); return renderDecks(); }
  if (a === 'dk-recipe') { if (PREBUILT[i]) openRecipe(i); return; }
  if (a === 'dk-rc-copy') { const d = PREBUILT[i]; if (d && dkNewSlot(d.name, d.cards, true, d.key)) { RC_MSG = `Copied to My decks: ${d.name}.`; renderRecipe(); } return; }
  if (a === 'dk-rc-back') return switchView('view-decks');
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

/* ---------------------------------------------------------------------
   DECK RECIPE (owner review 2026-10-30, Aegis-style deck page): every ready-made deck opens a page that lists its full recipe
   (copies per card, grouped by type), the colours, the cost spread and the cards still missing from the library, with Copy.
   Display only: nothing here touches the rules. The recipe of a starter is its full official list (`recipe`), not only the
   cards that are already playable (`cards`); the other ready-made decks have no separate recipe, so their cards are the recipe.
   --------------------------------------------------------------------- */
let RC_ID = -1, RC_MSG = '';
function openRecipe(i) { if (!PREBUILT[i]) return; RC_ID = i; RC_MSG = ''; switchView('view-recipe'); }
const RC_TYPES = ['Spirit', 'Brave', 'Ultimate', 'Nexus', 'Magic'];
function renderRecipe() {
  const el = $('rc-page'), d = PREBUILT[RC_ID]; if (!el) return; if (!d) { el.innerHTML = '<p class="empty-note">No deck selected.</p>'; return; }
  const rec = d.recipe || d.cards, ids = Object.keys(rec).filter(id => rec[id] > 0);
  const total = deckTotal(rec), have = ids.filter(id => CARDS[id]).reduce((n, id) => n + rec[id], 0), miss = total - have;
  const grp = {}; for (const id of ids) { const c = CARDS[id], t = c ? (RC_TYPES.includes(c.type) ? c.type : 'Other') : 'Missing'; (grp[t] = grp[t] || []).push(id); }
  for (const t of Object.keys(grp)) grp[t].sort((a, b) => (CARDS[a] && CARDS[b] ? CARDS[a].cost - CARDS[b].cost : 0) || DB_COLL.compare(a, b));
  const cnt = t => (grp[t] || []).reduce((n, id) => n + rec[id], 0);
  const curve = {}; for (const id of ids) { const c = CARDS[id]; if (c) { const k = Math.min(c.cost, 9); curve[k] = (curve[k] || 0) + rec[id]; } }
  const mx = Math.max(1, ...Object.values(curve)), cols = dkColors(d.cards).map(c => `<span class="tag dim" style="display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:10px;height:10px;background:${colorVar(c)};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></i>${cap(c)}</span>`).join('');
  const key = d.key && CARDS[d.key] ? `<span class="tag dim" title="Key Spirit: draws favour it">Key · ${esc(CARDS[d.key].name)}</span>` : '';
  const src = d.source ? `<a class="tag dim" href="${esc(d.source)}" target="_blank" rel="noopener" title="Official deck-feature page on battlespirits.com">Official recipe ↗</a>` : '';
  const row = id => { const c = CARDS[id], n = rec[id]; return c
    ? `<button class="rc-row" data-a="cp-open" data-v="${esc(id)}" aria-label="Open ${esc(c.name)}"><b class="rc-n">${n}×</b><span class="rc-nm" translate="no">${esc(c.name)}</span><span class="rc-id">${esc(id)}</span><span class="rc-c">${c.type === 'Magic' || c.type === 'Nexus' ? '' : 'Cost '}${c.cost}</span></button>`
    : `<div class="rc-row miss"><b class="rc-n">${n}×</b><span class="rc-nm">Not in the library yet</span><span class="rc-id">${esc(id)}</span><span class="rc-c"></span></div>`; };
  const sec = t => grp[t] ? `<div class="card flat rc-sec"><span class="cp-h">${t === 'Missing' ? 'Not in the library yet' : t} · ${cnt(t)}</span>${grp[t].map(row).join('')}</div>` : '';
  const bars = Array.from({ length: 10 }, (_, k) => `<div class="rc-bar"><i style="height:${Math.round(100 * (curve[k] || 0) / mx)}%"></i><b>${curve[k] || 0}</b><span>${k === 9 ? '9+' : k}</span></div>`).join('');
  const fmt = prebuiltFmt(d) === 'standard' ? 'Standard' : 'Eternal';
  el.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn sm" data-a="dk-rc-back">← My decks</button><span class="grow"></span><button class="btn sm pri" data-a="dk-rc-copy" data-v="${RC_ID}" aria-label="Copy ${esc(d.name)} to my decks">Copy to my decks</button></div>
    <div class="card hdcard"><div class="grow"><span class="eyebrow">Deck recipe</span><h2 class="hd" translate="no">${esc(d.name)}</h2><div class="row" style="gap:6px;flex-wrap:wrap"><span class="tag">${fmt}</span>${cols}${key}${src}<span class="tag dim">${total} cards</span></div></div></div>
    ${miss ? `<div class="card flat" role="status" style="padding:10px 14px"><b>${have} of ${total} cards are playable.</b> <span class="sub">${miss} card${miss === 1 ? ' is' : 's are'} not in the library yet; the copy fills in as card updates add them.</span></div>` : ''}
    <div class="rc-grid"><div class="col" style="gap:12px">${RC_TYPES.concat(['Other', 'Missing']).map(sec).join('')}</div>
      <div class="col" style="gap:12px"><div class="card flat" style="padding:10px 14px"><span class="cp-h">Cost spread</span><div class="rc-curve">${bars}</div></div>
        <div class="card flat" style="padding:10px 14px"><span class="cp-h">Types</span><div class="col" style="gap:4px">${RC_TYPES.filter(t => grp[t]).map(t => `<div class="row"><span class="grow">${t}</span><b>${cnt(t)}</b></div>`).join('')}</div></div></div></div>
    <span id="rc-msg" class="sub" role="status" aria-live="polite" style="font-size:.84em">${esc(RC_MSG)}</span>`;
}
