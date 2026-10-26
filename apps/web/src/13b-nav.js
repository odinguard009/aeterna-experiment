/* ---------------------------------------------------------------------
   APP NAVIGATION + HOME (v0.65.0, UI/UX overhaul U2; docs/DESIGN.md section 0, mockup docs/design/mockup-v11.html)
   One header for the menu screens: PC = top bar (brand, tabs, colour diamond, Dark/Light, history, sound, settings);
   phone = header (brand, colour, Dark/Light, settings) + the same tabs as a bottom tab bar with our own icons.
   Hidden on the battle screen and in the deck builder (its own layout until U6). Display only: no rules here.
   --------------------------------------------------------------------- */
const NAV_HIDDEN = ['view-playmat', 'view-deckbuilder'];
function navSync(id) {
  if (typeof document === 'undefined') return;
  const v = id || (document.querySelector('.app-view.active') || {}).id || 'view-lobby';
  document.body.dataset.view = v;
  document.body.classList.toggle('has-nav', !NAV_HIDDEN.includes(v));
  dqa('#app-tabs .ae-tab').forEach(b => { if (b.dataset.nav === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.querySelectorAll('.ae-tools [data-a="go-settings"]').forEach(b => { if (v === 'view-settings') b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
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
// Home: playable count, last deck line, version
function renderHome() {
  if (typeof document === 'undefined' || !$('home-sub')) return;
  const n = Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')).length;   // training cards are not real cards
  $('home-sub').textContent = `${n.toLocaleString('en-US')} playable cards in Eternal and Standard. Decks and card images stay on this device.`;
  const sl = SLOTS[ACTIVE_SLOT], t = deckTotal(PLAYER_DECK), ok = t && validateDeck(PLAYER_DECK).ok;
  $('home-last').innerHTML = `Last deck: <b>${esc(sl ? sl.name : 'Deck')}</b> · ${fmtTitle()} · ${t} cards · ${ok ? 'legal' : 'not ready'}`;
  const tp = $('tile-play-sub'); if (tp) tp.textContent = `${sl ? sl.name : 'Deck'} · ${fmtTitle()}`;
  const tl = $('tile-lib-sub'); if (tl) tl.textContent = `${n.toLocaleString('en-US')} cards, your card images`;
  $('home-ver').textContent = 'Aeterna v' + VERSION;
  renderHomeMore();
}
// v0.133.0 U14h: Card of the Day (the same card all day, from the date), the three-step summary and the deck tiles
function cardOfDay(d = new Date()) {
  const ids = Object.keys(CARDS).filter(id => !CARDS[id].token && !id.startsWith('TRAIN-')).sort(DB_COLL.compare);
  return ids.length ? ids[(Math.floor(d.getTime() / 864e5) * 7919) % ids.length] : '';
}
function renderHomeMore() {
  const id = cardOfDay(), c = CARDS[id], ok = validateDeck(PLAYER_DECK, FORMAT).ok;
  $('home-cotd').innerHTML = c ? `<button class="hm-cotd" data-a="zoom" data-v="${esc(id)}" style="--lc:${colorVar(c.symbol)}"><b>${esc(c.name)}</b><span translate="no">${esc(id)} · ${esc(c.contract ? 'Contract' : c.type)} · Cost ${c.cost}</span></button>` : '';
  $('home-sum').textContent = `Deck: ${SLOTS[ACTIVE_SLOT].name} (${ok ? 'legal' : 'not ready'}) · Format: ${fmtTitle()} · CPU: ${SETTINGS.cpuDeck}`;
  $('home-decks').innerHTML = SLOTS.map((s, i) => { const t = deckTotal(s.cards); return `<button class="hm-deck${i === ACTIVE_SLOT ? ' on' : ''}" data-a="home-deck" data-v="${i}"><b>${esc(s.name)}</b><span>${t ? t + ' cards' : 'empty'}${t && validateDeck(s.cards, FORMAT).ok ? ' · legal' : ''}</span></button>`; }).join('');
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('theme-pop') && !$('theme-pop').hidden) { themePop(false); $('theme-btn').focus(); } });
  document.addEventListener('click', e => { const p = $('theme-pop'); if (p && !p.hidden && !evC(e, '#theme-pop, #theme-btn')) themePop(false); });
}
