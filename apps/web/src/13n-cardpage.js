/* ---------------------------------------------------------------------
   CARD PAGE (v0.132.0, U14g2; docs/design/mockup-v14.html): what the Library's card zoom adds under the card detail: the same
   card printed elsewhere (related), the saved decks that hold it, an art picker (any printing's picture, kept per card in this
   browser) and a light tilt of the card face. Display only: nothing here touches the rules.
   --------------------------------------------------------------------- */
const ART_KEY = 'bse.art.v1';
let ART_ALT = (() => { try { const o = JSON.parse(localStorage.getItem(ART_KEY)); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } })();
const sameName = id => Object.keys(CARDS).filter(x => x !== id && !CARDS[x].token && CARDS[x].name === CARDS[id].name).sort(DB_COLL.compare);
const usedInDecks = id => SLOTS.map((s, i) => [s.name, (s.cards || {})[id] || 0, i]).filter(x => x[1] > 0);
function setArt(id, from) {                          // from '' = back to the card's own picture
  if (from && from !== id && CARDS[from]) ART_ALT[id] = from; else delete ART_ALT[id];
  try { localStorage.setItem(ART_KEY, JSON.stringify(ART_ALT)); } catch (e) { /* blocked: this visit only */ }
}
function cardPageHTML(id) {
  const rel = sameName(id), used = usedInDecks(id), cur = ART_ALT[id] || '';
  const chip = (x, on) => `<button class="cp-chip${on ? ' on' : ''}" data-a="${on === undefined ? 'zoom' : 'art'}" data-v="${esc(x)}" translate="no">${esc(x)}</button>`;
  return `<div class="cpage" data-a="zoominfo">
    <h4>Related cards</h4>${rel.length ? `<div class="cp-row">${rel.map(x => chip(x)).join('')}</div>` : '<p class="empty-note">No other printing of this card.</p>'}
    <h4>Used in decks</h4>${used.length ? `<div class="cp-row">${used.map(([n, k]) => `<span class="cp-chip">${esc(n)} ×${k}</span>`).join('')}</div>` : '<p class="empty-note">Not in any saved deck.</p>'}
    ${rel.length ? `<h4>Alternative art</h4><div class="cp-row">${chip(id, !cur)}${rel.map(x => chip(x, cur === x)).join('')}</div>` : ''}</div>`;
}
function cardTilt(el) {                              // pointer tilt of the card face; off when animations are reduced or off
  if (animMode() !== 'full') return;
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `perspective(700px) rotateY(${((e.clientX - r.left) / r.width - .5) * 14}deg) rotateX(${(.5 - (e.clientY - r.top) / r.height) * 14}deg)`; });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}
