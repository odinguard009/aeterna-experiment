/* ---------------------------------------------------------------------
   CARD PAGE (v0.132.0, U14g2; docs/design/mockup-v14.html): what the Library's card zoom adds under the card detail: the same
   card printed elsewhere (related), the saved decks that hold it, an art picker (any printing's picture, kept per card in this
   browser) and a light tilt of the card face. Display only: nothing here touches the rules.
   --------------------------------------------------------------------- */
const ART_KEY = 'bse.art.v1';
/* v0.185 same-name fix: cards that share a name are NOT the same card. Only a reprint with identical game data
   (type, colour, cost, reduction, symbols, levels, families, text) may share a picture; any other same-name card
   is listed as "Other printings" and opens as its own card. */
const normTxt = t => String(t || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim();
const printSig = c => JSON.stringify([c.type, c.color, c.cost, c.symbols, c.reduction, c.levels, c.families, normTxt(c.text)]);
const sameName = id => Object.keys(CARDS).filter(x => x !== id && !CARDS[x].token && CARDS[x].name === CARDS[id].name).sort(DB_COLL.compare);
const sameArt = id => { const sig = printSig(CARDS[id]); return sameName(id).filter(x => printSig(CARDS[x]) === sig); };     // identical reprints: the only valid art swaps
const artOk = (id, a) => !!(a && a !== id && CARDS[id] && CARDS[a] && CARDS[a].name === CARDS[id].name && printSig(CARDS[a]) === printSig(CARDS[id]));
const artOf = id => artOk(id, ART_ALT[id]) ? ART_ALT[id] : id;   // the card whose picture shows for id
let ART_ALT = (() => {
  let o; try { o = JSON.parse(localStorage.getItem(ART_KEY)); } catch (e) { o = null; }
  if (!o || typeof o !== 'object') return {};
  let dirty = false;                                   // drop art picks that point at a different card (saved before this fix)
  for (const id of Object.keys(o)) if (!artOk(id, o[id])) { delete o[id]; dirty = true; }
  if (dirty) { try { localStorage.setItem(ART_KEY, JSON.stringify(o)); } catch (e) { /* blocked */ } }
  return o;
})();
const usedInDecks = id => SLOTS.map((s, i) => [s.name, (s.cards || {})[id] || 0, i]).filter(x => x[1] > 0);
function setArt(id, from) {                          // from '' = back to the card's own picture
  if (artOk(id, from)) ART_ALT[id] = from; else delete ART_ALT[id];
  try { localStorage.setItem(ART_KEY, JSON.stringify(ART_ALT)); } catch (e) { /* blocked: this visit only */ }
}
function cardPageHTML(id) {
  const rel = sameName(id), arts = sameArt(id), used = usedInDecks(id), cur = artOf(id) === id ? '' : ART_ALT[id];
  const chip = (x, on) => `<button class="cp-chip${on ? ' on' : ''}" data-a="${on === undefined ? 'zoom' : 'art'}" data-v="${esc(x)}" translate="no">${esc(x)}</button>`;
  return `<div class="cpage" data-a="zoominfo">
    <h4>Other printings</h4>${rel.length ? `<div class="cp-row">${rel.map(x => chip(x)).join('')}</div>` : '<p class="empty-note">No other printing of this card.</p>'}
    <h4>Used in decks</h4>${used.length ? `<div class="cp-row">${used.map(([n, k]) => `<span class="cp-chip">${esc(n)} ×${k}</span>`).join('')}</div>` : '<p class="empty-note">Not in any saved deck.</p>'}
    ${arts.length ? `<h4>Alternative art</h4><div class="cp-row">${chip(id, !cur)}${arts.map(x => chip(x, cur === x)).join('')}</div>` : ''}</div>`;
}
function cardTilt(el) {                              // pointer tilt of the card face; off when animations are reduced or off
  if (animMode() !== 'full') return;
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `perspective(700px) rotateY(${((e.clientX - r.left) / r.width - .5) * 14}deg) rotateX(${(.5 - (e.clientY - r.top) / r.height) * 14}deg)`; });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}

// v0.137.0 (mockup parity): the Library card opens as a page (card with tilt, name, tags, effect text, art picker, level table, Add to deck, Copy Link, related)
let CP_ID = '';
const cpIds = id => { const l = typeof LIBV !== 'undefined' && LIBV.list.includes(id) ? LIBV.list : Object.keys(CARDS).filter(x => !CARDS[x].token && !x.startsWith('TRAIN-')).sort(DB_COLL.compare); return l; };
function openCardPage(id) { if (!CARDS[id]) return; CP_ID = id; if (!$('view-card').classList.contains('active')) switchView('view-card'); else renderCardPage(); }
function renderCardPage() {
  const el = $('cp-page'), c = CARDS[CP_ID]; if (!el || !c) return;
  const ids = cpIds(CP_ID), at = Math.max(0, ids.indexOf(CP_ID)), art = CARDS[artOf(CP_ID)];
  const lv = c.type !== 'Magic' && c.levels && c.levels.some(L => L.bp != null) ? c.levels : null;
  const std = !legalityOf(CP_ID, 'standard'), ete = !legalityOf(CP_ID, 'eternal');
  const tags = `<span class="tag${std ? '' : ' cpu'}">${std ? 'Standard Legal' : 'Not Standard Legal'}</span><span class="tag${ete ? ' dim' : ' cpu'}">${ete ? 'Eternal Legal' : 'Not Eternal Legal'}</span><span class="tag dim">Cost ${c.cost}</span>${c.implemented ? '<span class="tag dim">Effects Complete</span>' : '<span class="tag yes">! Partly Implemented</span>'}`;
  const sl = SLOTS[ACTIVE_SLOT], used = usedInDecks(CP_ID), can = dbCanAdd(CP_ID);
  const rel = sameName(CP_ID), cur = artOf(CP_ID) === CP_ID ? '' : ART_ALT[CP_ID], arts = [CP_ID].concat(sameArt(CP_ID)), fl = lore()[CP_ID];
  const flv = fl ? `<blockquote class="flv">“${esc(fl).replace(/\n/g, '<br>')}”<cite>Flavor Text · ${esc(c.name)}</cite></blockquote>` : '';
  const artBlock = `<div class="card flat" style="padding:10px 14px"><span class="cp-h">Art · ${arts.length} available</span><div class="cp-arts">${arts.map(x => { const on = x === CP_ID ? !cur : cur === x; return `<button class="cp-art${on ? ' on' : ''}" data-a="art" data-v="${esc(x)}" aria-pressed="${on}" aria-label="Use the art of ${esc(x)}"><span class="cp-art-f">${cardFaceHTML(CARDS[x], false)}</span><span translate="no">${esc(x)}</span></button>`; }).join('')}</div><span class="mut" style="font-size:.72em">${arts.length > 1 ? 'The picture you pick shows for this card everywhere in this browser (needs card images on this device).' : 'No identical reprint of this card.'}</span></div>`;
  const fams = c.families || [], same = x => !CARDS[x].token && !x.startsWith('TRAIN-') && x !== CP_ID && CARDS[x].name !== c.name;
  const othBlock = rel.filter(x => !arts.includes(x)).length ? `<div class="card flat" style="padding:10px 14px"><span class="cp-h">Other printings · different cards with the same name</span><div class="cp-row">${rel.filter(x => !arts.includes(x)).map(x => `<button class="cp-chip" data-a="cp-open" data-v="${esc(x)}" translate="no">${esc(x)}</button>`).join('')}</div></div>` : '';
  const relCards = Object.keys(CARDS).filter(x => same(x) && fams.length && (CARDS[x].families || []).some(f => fams.includes(f))).slice(0, 7);
  const relBlock = relCards.length ? `<div class="sec">Related cards</div><div class="row scroll" style="gap:10px;padding:6px 2px 12px">${relCards.map(x => `<button class="cp-rel" data-a="cp-open" data-v="${esc(x)}" aria-label="${esc(CARDS[x].name)}">${cardFaceHTML(CARDS[x], false)}</button>`).join('')}</div>` : '';
  const usedBlock = `<div class="sec">Used in your decks</div>${used.length ? `<div class="cp-row">${used.map(([n, k]) => `<span class="cp-chip">${esc(n)} ×${k}</span>`).join('')}</div>` : '<span class="sub">Not in any deck yet.</span>'}`;
  const rows = lv ? lv.map((L, i) => `<tr><td><b>LV${i + 1}</b></td><td>${c.countLv ? 'Count ' : ''}${L.cores} ${L.cores === 1 ? 'Core' : 'Cores'}</td><td>${L.bp == null ? '-' : L.bp}</td></tr>`).join('') : '';
  el.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn sm" data-a="go-lib">‹ Library</button><span class="grow"></span><button class="ibtn sq" data-a="cp-nav" data-v="-1" aria-label="Previous card">‹</button><span class="mut" style="font-size:.8em">${at + 1} / ${ids.length}</span><button class="ibtn sq" data-a="cp-nav" data-v="1" aria-label="Next card">›</button></div>
  <div class="ciw" style="display:grid;grid-template-columns:330px 1fr;gap:30px;align-items:start"><div class="tilt" id="cp-tilt"><div class="cibig" style="width:300px;margin:0 auto">${cardFaceHTML(art, true)}</div><span class="mut hidem" style="display:block;text-align:center;font-size:.74em;margin-top:10px">Move the pointer over the card - it tilts and shines.</span></div>
  <div class="col" style="gap:12px;min-width:0"><div><span class="eyebrow">${esc(c.token ? 'Token Spirit' : c.type)} · ${esc(cap(c.symbol))}</span><h2 class="hd" style="font-size:1.9em">${esc(c.name)}</h2><span class="mut">${esc(c.id)}${(c.families || []).length ? ' · ' + esc(c.families.join(', ')) : ''}</span></div>
   <div class="row" style="gap:6px;flex-wrap:wrap">${tags}</div>
   <div class="card flat" style="padding:14px 16px;line-height:1.6">${effectTextHTML(c, false)}${c.implemented ? '' : residualHTML(c)}</div>${flv}${artBlock}${othBlock}
   ${lv ? `<div class="card flat" style="padding:8px 12px"><table class="tb"><tr><th>Level</th><th>Cores To Reach</th><th>BP</th></tr>${rows}</table></div>` : ''}
   <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn pri" data-a="cp-add"${can ? '' : ' disabled'}>+ Add To “${esc(sl.name)}”</button><button class="btn" data-a="cp-link">Copy Link</button></div><span class="sub" id="cp-msg" role="status" style="font-size:.84em"></span>${usedBlock}${relBlock}</div></div>`;
  cardTilt(elq(el, '#cp-tilt .cibig'));
}
