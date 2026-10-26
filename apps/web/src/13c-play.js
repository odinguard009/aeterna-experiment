/* ---------------------------------------------------------------------
   PLAY SETUP PAGE (v0.67.0, UI/UX overhaul U3; docs/DESIGN.md section 0 "Play = deck chip + mode cards + setup chips")
   Deck chip (slot select + legality line + Edit), mode cards (Match vs CPU, Watch CPU vs CPU),
   setup rows (format toggle, CPU deck select, CPU style and speed chips). Display only: the match code is in 15-match.js.
   --------------------------------------------------------------------- */
const PLAY_SPEEDS = [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']];
function playChips(id, list, cur, act) {
  const el = $(id); if (!el) return;
  el.innerHTML = list.map(([v, l]) => `<button class="ae-chip" data-a="${act}" data-v="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('');
}
let PLAY_MODE = 'cpu';                                  // what Start does: 'cpu' (match), 'watch' (CPU vs CPU) or 'online' (online lobby)
function playGo() { if (PLAY_MODE === 'watch') startNewGame({ watch: true }); else if (PLAY_MODE === 'online') { switchView('view-online'); renderOnlineLobby(); } else startNewGame(); }
function renderPlay() {
  if (typeof document === 'undefined' || !$('pl-style')) return;
  playChips('pl-mode', [['cpu', 'vs CPU'], ['watch', 'Watch CPU vs CPU'], ['online', 'Online vs Bot']], PLAY_MODE, 'play-mode');
  const sl = SLOTS[ACTIVE_SLOT];
  $('pl-stats').innerHTML = `<span><b>${HISTORY.length}</b> matches played</span>`;
  $('pl-sum').innerHTML = [['Deck', sl ? sl.name : 'Deck'], ['Opponent', PLAY_MODE === 'watch' ? 'CPU vs CPU' : PLAY_MODE === 'online' ? 'Server bot' : cap(cpuProfileName(null)) + ' CPU'], ['Format', fmtTitle()], ['Speed', cap(SETTINGS.speed)]].map(([k, v]) => `<div class="sbox"><span>${k}</span><b>${esc(v)}</b></div>`).join('');
  playChips('pl-style', CPU_PROFILE_NAMES.map(n => [n, cap(n)]), cpuProfileName(null), 'play-style');
  playChips('pl-speed', PLAY_SPEEDS, SETTINGS.speed, 'play-speed');
  const ok = validateDeck(PLAYER_DECK).ok;
  document.querySelectorAll('#view-play .pl-start').forEach(b => b.classList.toggle('blocked', !ok));   // still clickable: start explains why
}
function playSet(kind, v) {
  if (kind === 'mode') PLAY_MODE = v;
  else if (kind === 'style' && CPU_PROFILES[v]) setCpuProfile(v);
  else if (kind === 'speed' && SPEEDS[v]) { SETTINGS.speed = v; saveSettings(); }
  renderPlay();
}
