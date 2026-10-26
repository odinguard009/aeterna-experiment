/* ---------------------------------------------------------------------
   PLAY SETUP PAGE (v0.67.0, UI/UX overhaul U3; docs/DESIGN.md section 0 "Play = deck chip + mode cards + setup chips")
   Deck chip (slot select + legality line + Edit), mode cards (Match vs CPU, Watch CPU vs CPU),
   setup rows (format toggle, CPU deck select, CPU style and speed chips). Display only: the match code is in 15-match.js.
   --------------------------------------------------------------------- */
const PLAY_SPEEDS = [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']];
const PLAY_STYLES = [['balanced', 'Balanced', 'Plays a bit of everything.'], ['aggressive', 'Aggro', 'Attacks early and often.'], ['defensive', 'Control', 'Holds cards, blocks, waits.'], ['random', 'Random', 'Surprises you.']];
const PLAY_LEVELS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
const PLAY_FIRST = [['coin', 'Coin toss'], ['me', 'Me first'], ['cpu', 'CPU first']];
function playChips(id, list, cur, act) {
  const el = $(id); if (!el) return;
  el.innerHTML = list.map(([v, l]) => `<button class="chip${v === cur ? ' on' : ''}" data-a="${act}" data-v="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('');
}
let PLAY_MODE = 'cpu';                                  // what Start does: 'cpu' (match), 'watch' (CPU vs CPU) or 'online' (online lobby)
function playGo() { if (PLAY_MODE === 'watch') startNewGame({ watch: true }); else if (PLAY_MODE === 'online') { switchView('view-online'); renderOnlineLobby(); } else startNewGame(); }
function renderPlay() {
  if (typeof document === 'undefined' || !$('pl-style')) return;
  playChips('pl-mode', [['cpu', 'vs CPU'], ['watch', 'Watch CPU vs CPU'], ['online', 'Online vs Bot']], PLAY_MODE, 'play-mode');
  const sl = SLOTS[ACTIVE_SLOT], prof = SETTINGS.cpuRandom ? 'random' : cpuProfileName(null), lvl = SETTINGS.cpuLevel || 'normal', first = SETTINGS.firstTurn || 'coin';
  $('pl-stats').innerHTML = `<span><b>${HISTORY.length}</b> matches played</span>`;
  const sty = PLAY_STYLES.find(x => x[0] === prof) || PLAY_STYLES[0];
  $('pl-sum').innerHTML = [['Deck', sl ? sl.name : 'Deck'], ['Opponent', PLAY_MODE === 'watch' ? 'CPU vs CPU' : PLAY_MODE === 'online' ? 'Server bot' : sty[1] + ' CPU · ' + cap(lvl)], ['Format', fmtTitle()], ['First Turn', (PLAY_FIRST.find(x => x[0] === first) || PLAY_FIRST[0])[1]], ['Speed', cap(SETTINGS.speed)]].map(([k, v]) => `<div class="sbox"><span>${k}</span><b>${esc(v)}</b></div>`).join('');
  $('play-decks').innerHTML = SLOTS.map((x, i) => { const t = deckTotal(x.cards), ok = t && validateDeck(x.cards, FORMAT).ok, top = Object.keys(x.cards).filter(id => CARDS[id] && x.cards[id]).sort((a, b) => x.cards[b] - x.cards[a])[0];
    return `<button class="dbox${i === ACTIVE_SLOT ? ' on' : ''}" data-a="play-slot" data-v="${i}" aria-pressed="${i === ACTIVE_SLOT}">${top ? cardFaceHTML(CARDS[top], false) : '<div class="cf"></div>'}<b>${esc(x.name)}</b><small>${t}/40 · ${t ? (ok ? 'legal' : 'not ready') : 'empty'}</small></button>`; }).join('');
  $('pl-style').innerHTML = PLAY_STYLES.map(([v, l, d]) => `<button class="opt${v === prof ? ' on' : ''}" data-a="play-style" data-v="${v}" aria-pressed="${v === prof}"><span><b>${l}</b><span>${d}</span></span></button>`).join('');
  $('pl-level').innerHTML = PLAY_LEVELS.map(([v, l]) => `<button data-a="play-level" data-v="${v}" aria-pressed="${v === lvl}" style="flex:1">${l}</button>`).join('');
  playChips('pl-fmt', [['standard', 'Standard'], ['eternal', 'Eternal']], FORMAT, 'play-fmt');
  playChips('pl-first', PLAY_FIRST, first, 'play-first');
  playChips('pl-speed', PLAY_SPEEDS, SETTINGS.speed, 'play-speed');
  $('pl-hints').setAttribute('aria-pressed', String(SETTINGS.hints !== false));
  const ok = validateDeck(PLAYER_DECK).ok;
  document.querySelectorAll('#view-play .pl-start').forEach(b => b.classList.toggle('blocked', !ok));   // still clickable: start explains why
}
function playSet(kind, v) {
  if (kind === 'mode') PLAY_MODE = v;
  else if (kind === 'style' && v === 'random') { SETTINGS.cpuRandom = true; saveSettings(); }
  else if (kind === 'style' && CPU_PROFILES[v]) { SETTINGS.cpuRandom = false; setCpuProfile(v); }
  else if (kind === 'level' && PLAY_LEVELS.some(x => x[0] === v)) { SETTINGS.cpuLevel = v; saveSettings(); }
  else if (kind === 'first' && PLAY_FIRST.some(x => x[0] === v)) { SETTINGS.firstTurn = v; saveSettings(); }
  else if (kind === 'fmt') setFormat(v);
  else if (kind === 'hints') { SETTINGS.hints = SETTINGS.hints === false; saveSettings(); }
  else if (kind === 'slot') { switchSlot(Number(v)); renderLobby(); return; }
  else if (kind === 'speed' && SPEEDS[v]) { SETTINGS.speed = v; saveSettings(); }
  renderPlay();
}
