/* ---------------------------------------------------------------------
   APP NAVIGATION + HOME (v0.65.0, UI/UX overhaul U2; docs/DESIGN.md section 0, mockup docs/design/mockup-v11.html)
   One header for the menu screens: PC = top bar (brand, tabs, colour diamond, Dark/Light, history, sound, settings);
   phone = header (brand, colour, Dark/Light, settings) + the same tabs as a bottom tab bar with our own icons.
   Hidden on the battle screen and in the deck builder (its own layout until U6). Display only: no rules here.
   --------------------------------------------------------------------- */
const NAV_HIDDEN = ['view-playmat'];
const MK_OFF = ['view-playmat'];   // not ported yet (battle)
const MK_TITLES = { 'view-lobby': 'Home', 'view-play': 'Play', 'view-decks': 'My decks', 'view-library': 'Library', 'view-settings': 'Settings', 'view-howto': 'Learn', 'view-online': 'Online' };
function navSync(id) {
  if (typeof document === 'undefined') return;
  const v = id || (document.querySelector('.app-view.active') || {}).id || 'view-lobby';
  document.body.dataset.view = v;
  document.body.classList.toggle('has-nav', !NAV_HIDDEN.includes(v));
  document.body.classList.toggle('mk', !MK_OFF.includes(v));         // v0.137.0: the pages ported from the mockup take its stylesheet; the others keep the old one until ported
  const pt = $('pb-title'); if (pt) pt.textContent = MK_TITLES[v] || '';
  dqa('#app-tabs [data-nav], #mk-tabbar [data-nav]').forEach(b => { if (b.dataset.nav === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
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
  const h = $('set-hist'); if (h && h.scrollIntoView) h.scrollIntoView({ block: 'start' });
}
const fmtTitle = () => cap(String(fmtButton(FORMAT)).toLowerCase());
// Home (v0.137.0, mockup parity): hero, "Continue with" deck panel, four tiles, Daily missions / What's new / Last match cards
/** @type {Array<[string, string, string, () => string]>} */
const MK_TILES = [['⚔', 'Match vs CPU', 'go-play', () => `${SLOTS[ACTIVE_SLOT].name} · ${fmtTitle()}`], ['▦', 'My decks', 'go-decks', () => `${SLOTS.filter(s => deckTotal(s.cards)).length} of ${SLOTS.length} slots used`],
  ['▣', 'Library', 'go-lib', () => `${Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')).length.toLocaleString('en-US')} cards, search and filters`], ['?', 'Learn the game', 'go-howto', () => 'Rules, glossary and keywords']];
function renderHome() {
  if (typeof document === 'undefined' || !$('home-sub')) return;
  const sl = SLOTS[ACTIVE_SLOT], t = deckTotal(PLAYER_DECK), ok = t && validateDeck(PLAYER_DECK, FORMAT).ok;
  const top = sl && Object.keys(sl.cards).filter(id => CARDS[id] && sl.cards[id]).sort((a, b) => sl.cards[b] - sl.cards[a])[0];
  $('home-cont').innerHTML = `${top ? `<div style="width:36px">${cardFaceHTML(CARDS[top], false)}</div>` : ''}<div><span class="mut" style="font-size:.72em;letter-spacing:.14em;text-transform:uppercase;font-weight:800">Continue with</span><br><b>${esc(sl ? sl.name : 'Deck')}</b> <span class="mut">· ${fmtTitle()} · ${t}/40${ok ? '' : ' · not ready'}</span></div><button class="btn sm" data-a="go-deck">Edit</button>`;
  $('home-tiles').innerHTML = MK_TILES.map(x => `<button class="card tile2" data-a="${x[2]}"><span class="ic">${x[0]}</span><span><b>${x[1]}</b><span>${esc(x[3]())}</span></span></button>`).join('');
  $('home-ver').textContent = 'Aeterna v' + VERSION;
  renderHomeMore();
}
// v0.133.0 U14h: Card of the Day (the same card all day, from the date), the missions and the last match
function cardOfDay(d = new Date()) {
  const ids = Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')).sort(DB_COLL.compare);
  return ids.length ? ids[(Math.floor(d.getTime() / 864e5) * 7919) % ids.length] : '';
}
function renderHomeMore() {
  const id = cardOfDay(), c = CARDS[id], fl = c && lore()[id];
  const cf = c ? `<button class="cfw" style="border:0;background:none;padding:0" data-a="zoom" data-v="${esc(id)}" aria-label="Open ${esc(c.name)}">${cardFaceHTML(c, true)}</button>` : '';
  const left = (() => { const t = Math.max(0, Math.floor((864e5 - (Date.now() % 864e5)) / 1000)); return [Math.floor(t / 3600), Math.floor(t % 3600 / 60), t % 60].map(n => String(n).padStart(2, '0')).join(':'); })();
  const foot = `<span class="sub" style="font-size:.76em">New card at 00:00 UTC · in <span class="cd" id="cd">${left}</span></span>`;
  $('cotd').className = 'cotd' + (fl ? '' : ' solo');
  $('cotd').innerHTML = fl ? `${cf}<div class="card qb"><span class="eyebrow">Card Of The Day</span><div class="qm">“</div><div class="qt">${esc(fl).replace(/\n/g, '<br>')}</div><span class="mut" style="font-size:.8em">Flavor Text · ${esc(c.name)} · ${esc(id)}</span>${foot}</div>`
    : `<div class="col cinfo"><span class="eyebrow">Card Of The Day</span><span class="sub">${c ? 'No flavor text on this card.' : ''}</span>${foot}</div>${cf}`;
  $('home-missions').innerHTML = dailyMissions().map(m => `<div class="mission"><span class="grow">${esc(m.txt)}</span><div class="bar" style="max-width:90px"><i style="width:${Math.min(100, m.v / m.goal * 100)}%"></i></div><b style="width:36px;text-align:right">${m.v}/${m.goal}</b></div>`).join('') + '<span class="mut" style="font-size:.74em">Resets at 00:00 UTC.</span>';
  const h = HISTORY && HISTORY[HISTORY.length - 1];
  $('home-last').innerHTML = h ? `<div class="row"><span class="tag">${esc(h.won ? 'Win' : 'Loss')}</span><b>vs ${esc(h.cpu || 'CPU')}</b></div><span class="sub" style="font-size:.84em">Turn ${h.turns || '?'} · ${esc(h.you || '')}</span><button class="btn sm" style="align-self:flex-start" data-a="go-history">History</button>`
    : '<span class="sub" style="font-size:.84em">No match played yet.</span><button class="btn sm" style="align-self:flex-start" data-a="go-play">Play one</button>';
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('theme-pop') && !$('theme-pop').hidden) { themePop(false); $('theme-btn').focus(); } });
  document.addEventListener('click', e => { const p = $('theme-pop'); if (p && !p.hidden && !evC(e, '#theme-pop, #theme-btn')) themePop(false); });
}
