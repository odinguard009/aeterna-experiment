/* ---------------------------------------------------------------------
   APP NAVIGATION + HOME (v0.65.0, UI/UX overhaul U2; docs/DESIGN.md section 0, mockup docs/design/mockup-v11.html)
   One header for the menu screens: PC = top bar (brand, tabs, colour diamond, Dark/Light, history, sound, settings);
   phone = header (brand, colour, Dark/Light, settings) + the same tabs as a bottom tab bar with our own icons.
   Hidden on the battle screen and in the deck builder (its own layout until U6). Display only: no rules here.
   --------------------------------------------------------------------- */
const NAV_HIDDEN = ['view-playmat'];
const MK_OFF = [];   // v0.160.0: every view is ported; the list stays as the switch for a view that must keep the old stylesheet
const MK_TITLES = { 'view-recipe': 'Recipe', 'view-lobby': 'Home', 'view-play': 'Play', 'view-decks': 'My decks', 'view-library': 'Library', 'view-deckbuilder': 'Deck builder', 'view-settings': 'Settings', 'view-profile': 'Profile', 'view-card': 'Card', 'view-howto': 'Learn', 'view-online': 'Online' };
function navSync(id) {
  if (typeof document === 'undefined') return;
  const v = id || (document.querySelector('.app-view.active') || {}).id || 'view-lobby';
  document.body.dataset.view = v;
  document.body.classList.toggle('has-nav', !NAV_HIDDEN.includes(v));
  document.body.classList.toggle('mk', !MK_OFF.includes(v));         // v0.137.0: the pages ported from the mockup take its stylesheet; the others keep the old one until ported
  const pt = $('pb-title'); if (pt) pt.textContent = MK_TITLES[v] || '';
  dqa('#app-tabs [data-nav], #mk-tabbar [data-nav]').forEach(b => { if (b.dataset.nav === (v === 'view-card' ? 'view-library' : v === 'view-recipe' ? 'view-decks' : v)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.querySelectorAll('#app-nav .ibtn[data-a="go-settings"]').forEach(b => { if (v === 'view-settings') b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  themePop(false);
  navTools();
}
// colour diamond, Dark/Light toggles and the sound button show the saved state
function navTools() {
  if (typeof document === 'undefined') return;
  dqa('[data-a="theme-mode"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === THEME.mode)));
  const sb = $('sound-btn'); if (sb) { sb.setAttribute('aria-pressed', String(!!SETTINGS.sound)); const l = 'Sound: ' + (SETTINGS.sound ? 'on' : 'off'); sb.title = l; sb.setAttribute('aria-label', l); }
  const g = $('theme-grid');
  if (g) g.innerHTML = THEME_COLS.map(c => `<button class="pcol" data-a="theme-color" data-v="${c.id}" aria-pressed="${c.id === THEME.color}" style="--c:${THEME.mode === 'light' ? c.l : c.d}"><i></i>${esc(c.name.replace(/ \(.*\)$/, ''))}</button>`).join('');
}
function themePop(open) {
  const p = $('theme-pop'), b = $('theme-btn'); if (!p || !b) return;
  const on = open === undefined ? p.hidden : !!open;
  p.hidden = !on; b.setAttribute('aria-expanded', String(on));
  if (on && open === undefined) { const f = elq(p, '.pcol[aria-pressed="true"]'); if (f) f.focus(); }   // keyboard users land inside the picker
}
function navTheme(key, val) {
  setTheme(key, val); navTools();
  if (typeof renderSettings === 'function' && $('view-settings').classList.contains('active')) renderSettings();
}
function navSound() {
  SETTINGS.sound = !SETTINGS.sound; saveSettings(); navTools();
  if (SETTINGS.sound) sfx('summon');
  if ($('view-settings').classList.contains('active')) renderSettings();
}
function navHistory() {
  switchView('view-settings');
  setSection('history');
}
const fmtTitle = () => cap(String(fmtButton(FORMAT)).toLowerCase());
// Home (v0.137.0, mockup parity): hero, "Continue with" deck panel, four tiles, Daily missions / What's new / Last match cards
/** @type {Array<[string, string, string, () => string]>} */
const MK_TILES = [['⚔', 'Match vs CPU', 'go-play', () => `${SLOTS[ACTIVE_SLOT].name} · ${fmtTitle()}`], ['▦', 'My decks', 'go-decks', () => `${SLOTS.filter(s => deckTotal(s.cards)).length} of ${SLOTS.length} slots used`],
  ['▣', 'Library', 'go-lib', () => `${Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')).length.toLocaleString('en-US')} cards, search and filters`], ['?', 'Learn the game', 'go-howto', () => 'Rules, glossary and keywords']];
function renderHome() {
  if (typeof document === 'undefined' || !$('home-sub')) return;
  const sl = SLOTS[ACTIVE_SLOT], t = deckTotal(PLAYER_DECK), ok = t && validateDeck(PLAYER_DECK, FORMAT).ok;
  const top = sl && dkCover(sl.cards, sl.key)[0];
  $('home-cont').innerHTML = `${top ? `<div style="width:36px">${cardFaceHTML(CARDS[top], false)}</div>` : ''}<div><span class="mut" style="font-size:.72em;letter-spacing:.14em;text-transform:uppercase;font-weight:800">Continue with</span><br><b>${esc(sl ? sl.name : 'Deck')}</b> <span class="mut">· ${fmtTitle()} · ${t}/40${ok ? '' : ' · not ready'}</span></div><button class="btn sm" data-a="go-deck">Edit</button>`;
  $('home-tiles').innerHTML = MK_TILES.map(x => `<button class="card tile2" data-a="${x[2]}"><span class="ic">${x[0]}</span><span><b>${x[1]}</b><span>${esc(x[3]())}</span></span></button>`).join('');
  $('home-ver').textContent = 'Aeterna v' + VERSION;
  if ($('home-ver2')) $('home-ver2').textContent = 'Aeterna v' + VERSION;
  renderHomeMore();
}
// v0.133.0 U14h: Card of the Day (the same card all day, from the date), the missions and the last match
function cardOfDay(d = new Date()) {
  const ids = Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')).sort(DB_COLL.compare);
  return ids.length ? ids[(Math.floor(d.getTime() / 864e5) * 7919) % ids.length] : '';
}
// v0.141.0: the mockup card face (generated art, cost gem, type chip, name, footer) for the Card of the Day; a real picture still wins
const MK_COL = { red: ['r', '#e5484d'], purple: ['p', '#9b5de5'], green: ['g', '#2fbf71'], white: ['w', '#dfe6ee'], yellow: ['y', '#ffd447'], blue: ['b', '#3aa0ff'] };
function mkMix(a, b, t) { const n = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)), x = n(a), y = n(b); return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join(''); }
function mkArt(card, hex) {
  let h = 7; for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => (h = (h * 1664525 + 1013904223) >>> 0) / 4294967296, dk = mkMix(hex, '#000000', .78), md = mkMix(hex, '#000000', .5), lt = mkMix(hex, '#ffffff', .35), g = 'ma' + h;
  let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${md}"/><stop offset="1" stop-color="${dk}"/></linearGradient><radialGradient id="${g}g" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${lt}" stop-opacity=".85"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient></defs><rect width="100" height="140" fill="url(#${g})"/><circle cx="${40 + r() * 20}" cy="${46 + r() * 8}" r="${30 + r() * 8}" fill="url(#${g}g)"/>`;
  for (let i = 0; i < 3; i++) { let d = 'M0 140 L0 ' + (88 + i * 8 + r() * 10); for (let x = 12; x <= 100; x += 12 + r() * 10) d += ` L${x} ${80 + i * 10 + r() * 22}`; s += `<path d="${d} L100 140Z" fill="${mkMix(hex, '#000000', .55 + i * .14)}" opacity=".85"/>`; }
  if (card.type === 'Magic') { for (let i = 0; i < 4; i++) s += `<circle cx="50" cy="60" r="${10 + i * 9}" fill="none" stroke="${lt}" stroke-width="${1.6 - i * .3}" opacity="${.9 - i * .18}" stroke-dasharray="${4 + i * 3} 3"/>`; }
  else if (card.type === 'Nexus') s += `<path d="M30 112 L30 60 L38 60 L38 44 L46 44 L46 30 L50 22 L54 30 L54 44 L62 44 L62 60 L70 60 L70 112Z" fill="${mkMix(hex, '#000000', .82)}" stroke="${lt}" stroke-width=".8"/><rect x="44" y="70" width="12" height="18" rx="6" fill="${lt}" opacity=".8"/>`;
  else { const w = 12 + r() * 10; s += `<polygon points="50,38 ${50 + w},58 ${68 + w},42 ${48 + w},80 56,96 44,96 ${52 - w},80 ${32 - w},42 ${50 - w},58" fill="${mkMix(hex, '#000000', .86)}" stroke="${lt}" stroke-width=".8"/><circle cx="46" cy="50" r="1.6" fill="${lt}"/><circle cx="54" cy="50" r="1.6" fill="${lt}"/>`; }
  for (let i = 0; i < 14; i++) s += `<circle cx="${r() * 100}" cy="${r() * 90}" r="${r() * 1.1 + .3}" fill="#fff" opacity="${.3 + r() * .6}"/>`;
  return `<svg class="art" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
}
function mkFace(card) {
  if (cardImgSrc(card.id)) return cardFaceHTML(card, false);
  const [k, hex] = MK_COL[card.symbol] || MK_COL.green, sp = card.type === 'Spirit' || card.type === 'Brave', bp = card.levels[0] && card.levels[0].bp != null ? card.levels[0].bp : '';
  const ft = sp ? `<span class="lv">LV1</span><span class="bp">${bp}</span>` : `<span class="lv">${esc(card.type)}</span><span class="bp" style="font-size:.7em;color:var(--text2)">${esc(((card.families || [])[0] || '').slice(0, 14))}</span>`;
  return `<div class="cf foil" data-c="${k}">${mkArt(card, hex)}<span class="cost"><span>${card.cost}</span></span><span class="ty">${esc(card.type)}</span><span class="nm">${esc(card.name)}</span><span class="ft">${ft}</span></div>`;
}
function renderHomeMore() {
  const id = cardOfDay(), c = CARDS[id], fl = c && lore()[id];
  const cf = c ? `<button class="cfw" style="border:0;background:none;padding:0" data-a="cp-open" data-v="${esc(id)}" aria-label="Open ${esc(c.name)}">${mkFace(c)}</button>` : '';
  const left = (() => { const t = Math.max(0, Math.floor((864e5 - (Date.now() % 864e5)) / 1000)); return [Math.floor(t / 3600), Math.floor(t % 3600 / 60), t % 60].map(n => String(n).padStart(2, '0')).join(':'); })();
  const set = String(id).split('-')[0], sg = typeof sagaOf === 'function' ? sagaOf(set) : 0;     // owner review 2026-10-30: the card's name and series sit right under the heading
  const who = c ? `<div class="cd-who"><b class="cd-name" translate="no">${esc(c.name)}</b><span class="cd-series">Series ${esc(set)}${sg ? ' · ' + esc(SAGA_NAMES[Number(sg) - 1] || '') : ''}</span></div>` : '';
  const btns = `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm pri" data-a="cp-open" data-v="${esc(id)}">Card Page</button><button class="btn sm" data-a="dbcard" data-v="${esc(id)}">+ Add To Deck</button></div>`;
  const foot = `<span class="sub" style="font-size:.76em">New card at 00:00 UTC · in <span class="cd" id="cd">${left}</span></span>`;
  $('cotd').className = 'cotd' + (fl ? '' : ' solo');
  $('cotd').innerHTML = fl ? `${cf}<div class="card qb"><span class="eyebrow">Card Of The Day</span>${who}<div class="qm">“</div><div class="qt">${esc(fl).replace(/\n/g, '<br>')}</div><span class="mut" style="font-size:.8em">Flavor Text · ${esc(id)}</span>${btns}${foot}</div>`
    : `<div class="col cinfo"><span class="eyebrow">Card Of The Day</span>${c ? `${who}<span class="sub">No flavor text on this card.</span>${btns}` : ''}${foot}</div>${cf}`;
  $('home-missions').innerHTML = dailyMissions().map(m => `<div class="mission"><span class="grow">${esc(m.txt)}</span><div class="bar" style="max-width:90px"><i style="width:${Math.min(100, m.v / m.goal * 100)}%"></i></div><b style="width:36px;text-align:right">${m.v}/${m.goal}</b></div>`).join('') + '<span class="mut" style="font-size:.74em">Resets at 00:00 UTC.</span>';
  const h = HISTORY && HISTORY[HISTORY.length - 1];
  $('home-last').innerHTML = h ? `<div class="row"><span class="tag">${esc(h.won ? 'Win' : 'Loss')}</span><b>vs ${esc(h.cpu || 'CPU')}</b></div><span class="sub" style="font-size:.84em">Turn ${h.turns || '?'} · ${esc(h.you || '')}</span><button class="btn sm" style="align-self:flex-start" data-a="go-history">History</button>`
    : '<span class="sub" style="font-size:.84em">No match played yet.</span><button class="btn sm" style="align-self:flex-start" data-a="go-play">Play one</button>';
}
if (typeof document !== 'undefined') {
  document.addEventListener('input', e => { if (evC(e, '#gl-q')) renderGlossary(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('theme-pop') && !$('theme-pop').hidden) { themePop(false); $('theme-btn').focus(); } });
  document.addEventListener('click', e => { const p = $('theme-pop'); if (p && !p.hidden && !evC(e, '#theme-pop, #theme-btn')) themePop(false); });
}
